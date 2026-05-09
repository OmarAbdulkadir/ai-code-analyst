"""
Performance Analyzer Agent
===========================
Owner: Omer
Sprint: 1, 2

Runs user code in Docker sandbox and measures real performance.
Combines real execution data (timing, memory) with AST analysis (complexity, bottlenecks).
Then sends results to Gemini AI for a deeper natural language summary.
"""
import json
import subprocess
import threading
import time
import psutil
from openai import OpenAI
from core.schemas import UserInput, PerformanceReport
from core.metrics import (
    measure_execution_time,
    estimate_complexity,
    detect_bottlenecks,
)
from core.config import OPENAI_API_KEY


def _measure_process_memory_mb(code_string: str) -> float:
    """Run code in a subprocess and return peak RSS memory in MB."""
    memory_samples = []
    process_ref = [None]

    def sample_memory():
        while process_ref[0] is None:
            time.sleep(0.01)
        proc = process_ref[0]
        try:
            ps_proc = psutil.Process(proc.pid)
            while proc.poll() is None:
                try:
                    mem = ps_proc.memory_info().rss / (1024 * 1024)
                    memory_samples.append(mem)
                except psutil.NoSuchProcess:
                    break
                time.sleep(0.05)
        except Exception:
            pass

    sampler = threading.Thread(target=sample_memory, daemon=True)
    sampler.start()

    try:
        proc = subprocess.Popen(
            ["python3", "-c", code_string],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        process_ref[0] = proc
        proc.wait(timeout=15)
    except Exception:
        return 0.0

    sampler.join(timeout=2)

    if not memory_samples:
        return 0.0
    return round(max(memory_samples), 2)

client = OpenAI(
    api_key=OPENAI_API_KEY,
)


def analyze_performance(user_input: UserInput) -> PerformanceReport:
    """
    Execute code in Docker sandbox and measure real performance metrics.

    Steps:
    1. Run code 3 times via Docker, average the execution time
    2. Measure peak memory usage via tracemalloc inside Docker
    3. Parse AST to estimate time/space complexity
    4. Detect bottlenecks (nested loops, slow membership checks)
    5. Send all data to Gemini AI for deeper analysis and summary

    Returns:
        PerformanceReport with all fields filled from real data
    """
    source_code = user_input.source_code

    # Step 1 — Measure real execution time
    execution_time = measure_execution_time(source_code, runs=3)

    # Step 2 — Measure real memory usage (process RSS, not system total)
    memory_usage = _measure_process_memory_mb(source_code)

    # Step 3 — Static complexity analysis
    complexity = estimate_complexity(source_code)

    # Step 4 — Detect bottlenecks
    bottlenecks = detect_bottlenecks(source_code)

    # Step 5 — Ask AI for deeper analysis
    prompt = f"""You are a performance analysis expert.

Analyze this Python code for performance issues.

STATIC ANALYSIS RESULTS:
- Execution time: {execution_time}ms
- Memory usage: {memory_usage}MB  
- Time complexity: {complexity['time_complexity']}
- Space complexity: {complexity['space_complexity']}
- Nested loop depth: {complexity['nested_loop_depth']}
- Has recursion: {complexity['has_recursion']}
- Detected bottlenecks: {bottlenecks}

CODE:
```python
{source_code}
```

Return ONLY valid JSON:
{{
  "summary": "2-3 sentence performance summary",
  "additional_bottlenecks": ["any bottlenecks not already detected"],
  "space_complexity": "O(...)"
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.choices[0].message.content
        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        ai_data = json.loads(text)
        summary = ai_data.get("summary", "")
        extra_bottlenecks = ai_data.get("additional_bottlenecks", [])
        space_complexity = ai_data.get("space_complexity", complexity["space_complexity"])
        all_bottlenecks = list(dict.fromkeys(bottlenecks + extra_bottlenecks))
    except Exception:
        summary = f"Code has {complexity['time_complexity']} time complexity."
        all_bottlenecks = bottlenecks
        space_complexity = complexity["space_complexity"]

    return PerformanceReport(
        execution_time_ms=execution_time if execution_time else 0.0,
        memory_usage_mb=memory_usage if memory_usage else 0.0,
        time_complexity=complexity["time_complexity"],
        space_complexity=space_complexity,
        bottlenecks=all_bottlenecks if all_bottlenecks else ["No bottlenecks detected"],
        executed_successfully=execution_time is not None,
        execution_error=None if execution_time else "Execution failed",
        summary=summary,
    )