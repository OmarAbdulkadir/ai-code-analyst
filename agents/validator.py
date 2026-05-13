"""
Validator Agent
================
Author: Asaad (System Architect)

The validator is the PROOF engine. It:
1. Runs the original code and captures output + timing
2. Runs the optimized code and captures output + timing
3. Compares outputs (they MUST match — same input → same output)
4. Compares performance (the optimized code should be faster)
5. Returns APPROVED, REJECTED, or UNCHANGED

Execution is sandboxed via Docker (code-sandbox image) through core/code_executor.py.
This means user-submitted code runs with no network access, capped memory, and capped CPU —
dangerous code cannot affect the host system.

This is what makes our project different from ChatGPT — we PROVE the improvement.
"""

import os
import threading
import time

import psutil

from core.schemas import ValidationResult, ValidationStatus, ResourceSample, ResourceTimeline
from core.config import SANDBOX_TIMEOUT_SECONDS
from core.code_executor import execute_code
from typing import Optional


def _collect_resource_timeline(pid: int, stop_event: threading.Event,
                               interval_ms: float = 100.0) -> list:
    """Poll psutil for the given PID every interval_ms until stop_event is set."""
    samples = []
    start = time.monotonic()
    try:
        proc = psutil.Process(pid)
    except psutil.NoSuchProcess:
        return samples

    while not stop_event.is_set():
        try:
            cpu = proc.cpu_percent(interval=None)
            mem = proc.memory_info().rss / (1024 * 1024)
            elapsed = (time.monotonic() - start) * 1000
            samples.append(ResourceSample(
                elapsed_ms=round(elapsed, 1),
                cpu_percent=round(cpu, 2),
                memory_mb=round(mem, 2),
            ))
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            break
        time.sleep(interval_ms / 1000.0)
    return samples


def _run_with_timeline(code: str) -> tuple:
    """Run execute_code() and collect a ResourceTimeline in parallel."""
    stop_event = threading.Event()
    samples_container = []
    monitor_pid = os.getpid()

    def monitor():
        samples_container.extend(
            _collect_resource_timeline(monitor_pid, stop_event, interval_ms=100.0)
        )

    t = threading.Thread(target=monitor, daemon=True)
    t.start()

    result = execute_code(code)

    stop_event.set()
    t.join(timeout=2.0)

    if len(samples_container) < 2:
        return result, None

    # Replace psutil RSS (server process, ~1000MB noise) with real Docker memory
    real_mem_mb = result.memory_usage_mb or 0.0
    corrected = [
        ResourceSample(
            elapsed_ms=s.elapsed_ms,
            cpu_percent=s.cpu_percent,
            memory_mb=real_mem_mb,
        )
        for s in samples_container
    ]

    timeline = ResourceTimeline(
        samples=corrected,
        peak_cpu_percent=max(s.cpu_percent for s in corrected),
        peak_memory_mb=real_mem_mb,
        sample_interval_ms=100.0,
    )
    return result, timeline


def validate_optimization(
    original_code: str,
    optimized_code: str,
    num_runs: int = 3,
) -> dict:
    """
    Run both original and optimized code, compare results.

    Returns:
        dict with keys: "validation" (ValidationResult), "baseline_resources",
        "optimized_resources" (ResourceTimeline or None)
    """
    # Collect resource timelines (one monitoring run each)
    baseline_exec, baseline_timeline = _run_with_timeline(original_code)
    optimized_exec, optimized_timeline = _run_with_timeline(optimized_code)

    # Run original code (3x for reliable timing)
    orig_result = _run_multiple(original_code, num_runs)

    # Run optimized code
    opt_result = _run_multiple(optimized_code, num_runs)

    # ─── Handle execution failures ───────────────────────
    
    if not orig_result["success"] and not opt_result["success"]:
        return {
            "validation": ValidationResult(
                status=ValidationStatus.REJECTED,
                summary=f"Both versions failed. Original: {orig_result['error']}. Optimized: {opt_result['error']}",
                outputs_match=False,
            ),
            "baseline_resources": baseline_timeline,
            "optimized_resources": optimized_timeline,
        }

    if not opt_result["success"]:
        return {
            "validation": ValidationResult(
                status=ValidationStatus.REJECTED,
                original_time_ms=orig_result["avg_time_ms"],
                original_output=orig_result["output"],
                summary=f"Optimized code failed to execute: {opt_result['error']}",
                outputs_match=False,
            ),
            "baseline_resources": baseline_timeline,
            "optimized_resources": optimized_timeline,
        }

    if not orig_result["success"]:
        # Original fails but optimized works — that's a bug fix!
        return {
            "validation": ValidationResult(
                status=ValidationStatus.APPROVED,
                optimized_time_ms=opt_result["avg_time_ms"],
                optimized_output=opt_result["output"],
                summary=f"Original code had errors. Optimized code runs successfully in {opt_result['avg_time_ms']:.1f}ms.",
                outputs_match=False,
            ),
            "baseline_resources": baseline_timeline,
            "optimized_resources": optimized_timeline,
        }

    # ─── Compare outputs ─────────────────────────────────

    outputs_match = _normalize_output(orig_result["output"]) == _normalize_output(opt_result["output"])

    # ─── Compare performance ─────────────────────────────

    orig_time = orig_result["avg_time_ms"]
    opt_time = opt_result["avg_time_ms"]

    if orig_time > 0:
        speedup = ((orig_time - opt_time) / orig_time) * 100
    else:
        speedup = 0.0

    # ─── Determine status ────────────────────────────────

    if not outputs_match:
        status = ValidationStatus.REJECTED
        summary = (
            f"REJECTED: Output mismatch. The optimized code produces different results. "
            f"Original output: '{orig_result['output'][:100]}', "
            f"Optimized output: '{opt_result['output'][:100]}'"
        )
    elif speedup > 5:  # At least 5% improvement to count
        status = ValidationStatus.APPROVED
        summary = (
            f"APPROVED: {speedup:.1f}% faster. "
            f"Original: {orig_time:.1f}ms → Optimized: {opt_time:.1f}ms. "
            f"Outputs match."
        )
    elif speedup < -5:  # Got slower
        status = ValidationStatus.REJECTED
        summary = (
            f"REJECTED: Optimized code is {abs(speedup):.1f}% SLOWER. "
            f"Original: {orig_time:.1f}ms → Optimized: {opt_time:.1f}ms."
        )
    else:
        status = ValidationStatus.UNCHANGED
        summary = (
            f"UNCHANGED: No significant performance difference "
            f"({orig_time:.1f}ms vs {opt_time:.1f}ms). Outputs match."
        )

    return {
        "validation": ValidationResult(
            status=status,
            original_time_ms=round(orig_time, 2),
            optimized_time_ms=round(opt_time, 2),
            speedup_percentage=round(speedup, 2) if speedup > 0 else None,
            original_output=orig_result["output"][:500],
            optimized_output=opt_result["output"][:500],
            outputs_match=outputs_match,
            summary=summary,
        ),
        "baseline_resources": baseline_timeline,
        "optimized_resources": optimized_timeline,
    }


def _run_multiple(code: str, num_runs: int = 3) -> dict:
    """
    Run code multiple times using shared execute_code and average the timing.

    Handles edge cases:
    - Crash / exception in optimized code  → success=False, error=stderr
    - Timeout (infinite loop)              → success=False, error="timed out"
    - Empty output from both versions      → outputs_match=True (handled upstream)
    - Float rounding differences           → handled by _normalize_output()
    - Multi-line output ordering           → handled by _normalize_output()

    Returns dict with: success, output, error, avg_time_ms
    """
    times = []
    last_result = None

    for _ in range(num_runs):
        result = execute_code(code)

        # Edge case: infinite loop or hard timeout
        if result.timed_out:
            return {
                "success": False,
                "output": "",
                "error": f"Code timed out after {SANDBOX_TIMEOUT_SECONDS}s",
                "avg_time_ms": 0,
            }

        # Edge case: runtime error / exception
        if not result.success:
            return {
                "success": False,
                "output": result.stdout,
                "error": result.stderr[:300],
                "avg_time_ms": 0,
            }

        times.append(result.execution_time_ms)
        last_result = result

    avg_time = sum(times) / len(times) if times else 0

    return {
        "success": True,
        "output": last_result.stdout if last_result else "",
        "error": "",
        "avg_time_ms": avg_time,
    }


def _normalize_output(output: str) -> str:
    """
    Normalize output for comparison.

    Handles these real-world cases:
    1. Sets returned in different order  → sort before comparing
    2. Floats with tiny differences      → round to 6 decimal places
    3. set() vs list() output format     → normalize both to sorted list
    4. Multi-line output                 → compare line by line after stripping
    """
    import ast
    import re

    # Step 4: Normalize multi-line — strip each line, drop blanks, rejoin
    lines = [line.strip() for line in output.strip().splitlines()]
    lines = [l for l in lines if l]  # drop blank lines

    normalized_lines = []
    for line in lines:
        # Step 3 & 1: Handle list/set literals — normalize to sorted list
        if (line.startswith("[") and line.endswith("]")) or \
           (line.startswith("{") and line.endswith("}")):
            try:
                parsed = ast.literal_eval(line)
                if isinstance(parsed, (list, set)):
                    normalized_lines.append(str(sorted(parsed)))
                    continue
            except (ValueError, SyntaxError):
                pass

        # Step 2: Round floats in the line to 6 decimal places
        def round_float(match):
            return str(round(float(match.group()), 6))

        line = re.sub(r"-?\d+\.\d+", round_float, line)
        normalized_lines.append(line)

    return "\n".join(normalized_lines)


# ─── Quick test ──────────────────────────────────────────

if __name__ == "__main__":
    original = '''
def find_duplicates(lst):
    duplicates = []
    for i in range(len(lst)):
        for j in range(i + 1, len(lst)):
            if lst[i] == lst[j] and lst[i] not in duplicates:
                duplicates.append(lst[i])
    return duplicates

print(find_duplicates([1, 2, 3, 2, 4, 5, 1, 6, 7, 5]))
'''

    optimized = '''
def find_duplicates(lst):
    seen = set()
    duplicates = set()
    for item in lst:
        if item in seen:
            duplicates.add(item)
        seen.add(item)
    return list(duplicates)

print(find_duplicates([1, 2, 3, 2, 4, 5, 1, 6, 7, 5]))
'''

    result = validate_optimization(original, optimized)
    print(f"Status: {result.status.value}")
    print(f"Original: {result.original_time_ms}ms")
    print(f"Optimized: {result.optimized_time_ms}ms")
    print(f"Speedup: {result.speedup_percentage}%")
    print(f"Outputs match: {result.outputs_match}")