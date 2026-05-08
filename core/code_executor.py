"""
Code Executor
=============
Owner: Omer
Status: REAL IMPLEMENTATION - Docker sandbox with real timing and memory.

This module handles safe execution of arbitrary Python code.
Uses Docker container with resource limits and network isolation.
Memory tracked using tracemalloc injected into user code.
"""

import subprocess
import time
from core.config import SANDBOX_TIMEOUT_SECONDS, SANDBOX_MEMORY_LIMIT_MB


class ExecutionResult:
    """Result of running code in the sandbox."""
    def __init__(self, stdout="", stderr="", exit_code=0,
                 execution_time_ms=0.0, memory_usage_mb=0.0, timed_out=False):
        self.stdout = stdout
        self.stderr = stderr
        self.exit_code = exit_code
        self.execution_time_ms = execution_time_ms
        self.memory_usage_mb = memory_usage_mb
        self.timed_out = timed_out
        self.success = exit_code == 0 and not timed_out


def execute_code(source_code: str) -> ExecutionResult:
    """
    Execute Python code inside a Docker sandbox and return results
    with real timing and memory tracking.

    Args:
        source_code: Python code string to execute

    Returns:
        ExecutionResult with stdout, stderr, timing, memory
    """

    # Wrap user code with resource-based memory tracking (RSS, Linux ru_maxrss is in KB)
    wrapped_code = f"""
import sys
import resource

# USER CODE START
{source_code}
# USER CODE END

_mem_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
print(f"__MEMORY_PEAK_MB__:{{_mem_kb / 1024:.4f}}", file=sys.stderr)
"""

    try:
        start = time.perf_counter()

        result = subprocess.run(
            [
                "docker", "run",
                "--rm",                                     # Delete container after run
            "-i",                                       # Accept input via stdin
            "--network", "none",                        # No internet access
            "--memory", f"{SANDBOX_MEMORY_LIMIT_MB}m", # Memory limit
            "--cpus", "0.5",                            # CPU limit
            "code-sandbox"                              # Docker image name
            ],
            input=wrapped_code,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=SANDBOX_TIMEOUT_SECONDS,
        )

        elapsed_ms = (time.perf_counter() - start) * 1000

        # Extract memory from stderr
        memory_mb = 0.0
        clean_stderr = ""
        for line in result.stderr.splitlines():
            if line.startswith("__MEMORY_PEAK_MB__:"):
                try:
                    memory_mb = float(line.split(":")[1])
                except ValueError:
                    pass
            else:
                clean_stderr += line + "\n"

        return ExecutionResult(
            stdout=result.stdout.strip(),
            stderr=clean_stderr.strip(),
            exit_code=result.returncode,
            execution_time_ms=round(elapsed_ms, 3),
            memory_usage_mb=round(memory_mb, 4),
        )

    except subprocess.TimeoutExpired:
        return ExecutionResult(
            stderr=f"Timed out after {SANDBOX_TIMEOUT_SECONDS}s",
            exit_code=-1,
            timed_out=True,
        )
    except Exception as e:
        return ExecutionResult(
            stderr=str(e),
            exit_code=-1,
        )