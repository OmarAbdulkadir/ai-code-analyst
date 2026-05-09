# MODULE 5 — Pipeline Bug Fix

# Fix all issues found from test run analysis

# Run tasks IN ORDER. One commit per task. Test before moving to next.

---

## WHAT WAS FOUND (from test screenshots)

| Issue                                                | Where                                              | Severity |
| ---------------------------------------------------- | -------------------------------------------------- | -------- |
| Bug Score always 0/100 — bugs not detected           | Ibro: `agents/bug_detector.py` + `core/prompts.py` | CRITICAL |
| Speedup only 5.3% on O(n²) code — optimizer too weak | Ibro: `agents/optimizer.py` + `core/prompts.py`    | HIGH     |
| DNA Fingerprint: baseline (red) line missing         | Abdulkadir: `frontend/` Insights chart             | HIGH     |
| Resource Timeline: Memory stuck at flat 1200MB       | Omer: `agents/performance_analyzer.py`             | HIGH     |
| Execution Speed card shows "%" not real ms value     | Abdulkadir: `frontend/` Insights page              | MEDIUM   |

---

## TASK 5.1 — Fix Bug Detector Prompt (Ibro)

**Owner:** Ibro
**Files:** `core/prompts.py`, `agents/bug_detector.py`

### Problem

Gemini returns bug score 0 on code with clear O(n²) nested loops,
unused variables, and missing error handling. The prompt is too vague
or Gemini's response isn't being parsed correctly.

### Fix Steps

**Step 1 — Update `core/prompts.py`**

Replace the bug detection prompt with this stronger version:

```python
BUG_DETECTION_PROMPT = """You are a senior Python code reviewer.
Analyze the following Python code and return a JSON object only.

Find ALL of the following issues:
- Runtime errors (KeyError, IndexError, TypeError, etc.)
- Missing error handling (no try/except where needed)
- Logic bugs (wrong loop bounds, off-by-one, wrong conditions)
- Performance bugs (O(n²) or worse when O(n) is possible)
- Unused variables or imports
- Any other code quality issues

Return ONLY this JSON structure. No markdown, no explanation, no code blocks:
{{
  "bug_score": <integer 0-100, where 100 = worst possible code>,
  "bugs": [
    {{
      "line": <line number or 0 if unknown>,
      "severity": "<critical|high|medium|low>",
      "type": "<type of bug>",
      "description": "<clear explanation of what is wrong and why>",
      "fix": "<specific suggestion to fix it>"
    }}
  ],
  "has_critical_bugs": <true|false>,
  "summary": "<2-3 sentence summary of the code's overall quality>"
}}

Scoring guide:
- 0-20 = clean code, minor style issues only
- 21-50 = some bugs, nothing critical
- 51-80 = multiple bugs including at least one high severity
- 81-100 = critical bugs, code will crash or produce wrong output

Code to analyze:
{code}
"""
```

**Step 2 — Update `agents/bug_detector.py`**

Make sure the JSON parsing strips markdown fences before parsing:

````python
import re, json
from core.prompts import BUG_DETECTION_PROMPT
from core.schemas import BugReport, Bug

def detect_bugs(user_input):
    prompt = BUG_DETECTION_PROMPT.format(code=user_input.source_code)

    # Call Gemini (keep your existing call pattern)
    raw_response = call_gemini(prompt)  # your existing function

    # Strip markdown fences if present
    cleaned = re.sub(r'```(?:json)?\s*|\s*```', '', raw_response).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to extract JSON from response
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if match:
            data = json.loads(match.group())
        else:
            # Fallback: return a minimal valid report
            return BugReport(
                bug_score=0,
                bugs=[],
                has_critical_bugs=False,
                summary="Could not parse Gemini response."
            )

    bugs = [
        Bug(
            line=b.get("line", 0),
            severity=b.get("severity", "medium"),
            type=b.get("type", "unknown"),
            description=b.get("description", ""),
            fix=b.get("fix", "")
        )
        for b in data.get("bugs", [])
    ]

    return BugReport(
        bug_score=data.get("bug_score", 0),
        bugs=bugs,
        has_critical_bugs=data.get("has_critical_bugs", False),
        summary=data.get("summary", "")
    )
````

### Done When

```
python3 -c "
from agents.bug_detector import detect_bugs
from core.schemas import UserInput
code = '''
def find_duplicates(items):
    for i in range(len(items)):
        for j in range(len(items)):
            pass
unused = 'hello'
'''
result = detect_bugs(UserInput(source_code=code, language='python'))
print('Bug score:', result.bug_score)
print('Bugs found:', len(result.bugs))
assert result.bug_score > 20, 'Bug score should be > 20 for this code'
assert len(result.bugs) >= 2, 'Should detect at least 2 bugs'
print('PASS')
"
```

**Commit:** `"fix: bug detector prompt now returns non-zero scores for real bugs"`

---

## TASK 5.2 — Fix Optimizer Prompt (Ibro)

**Owner:** Ibro
**Files:** `core/prompts.py`, `agents/optimizer.py`

### Problem

The optimizer returned code that was only 5.3% faster on O(n²) code.
This means Gemini kept the nested loop and only made minor style changes.
The prompt must explicitly demand algorithmic improvement.

### Fix Steps

**Step 1 — Update `core/prompts.py`**

Replace the optimizer prompt:

```python
OPTIMIZATION_PROMPT = """You are an expert Python performance engineer.
Your job is to rewrite the given code to be significantly faster.

IMPORTANT RULES:
1. Replace O(n²) algorithms with O(n) or O(n log n) alternatives
2. Replace recursive functions with iterative ones when possible
3. Use built-in Python functions (set, dict, Counter, sum) instead of manual loops
4. Remove unnecessary memory allocations
5. The optimized code MUST produce IDENTICAL output to the original
6. Keep all function names and signatures exactly the same
7. Do NOT add new imports unless absolutely necessary (only stdlib)

Original code:
{original_code}

Bug report summary: {bug_summary}

Performance issues: {performance_bottlenecks}

Return ONLY this JSON structure. No markdown, no explanation, no code blocks:
{{
  "optimized_code": "<complete working Python code as a string>",
  "changes_made": [
    "<description of change 1>",
    "<description of change 2>"
  ],
  "expected_improvement": "<e.g. O(n²) → O(n), expected 10x-50x speedup for large inputs>"
}}
"""
```

**Step 2 — Verify `agents/optimizer.py` passes the right variables**

Make sure you are filling `{original_code}`, `{bug_summary}`, and `{performance_bottlenecks}` from the actual pipeline data:

```python
prompt = OPTIMIZATION_PROMPT.format(
    original_code=user_input.source_code,
    bug_summary=bug_report.summary,
    performance_bottlenecks=", ".join(perf_report.bottlenecks) if perf_report.bottlenecks else "none detected"
)
```

### Done When

Run the full pipeline on the test code and validator shows speedup > 20%:

```
python3 orchestrator.py
# Check: speedup_percentage > 20 in ValidationResult
```

**Commit:** `"fix: optimizer prompt now demands algorithmic improvement not style changes"`

---

## TASK 5.3 — Fix Resource Timeline Memory Chart (Omer)

**Owner:** Omer
**Files:** `agents/performance_analyzer.py`

### Problem

The Resource Timeline shows memory stuck at a flat 1200MB line.
This is the system's total RAM, not the code's actual memory usage.
psutil is measuring the wrong thing — it should measure the process delta,
not total system memory.

### Fix Steps

Update the memory tracking in your performance analyzer to measure
the process's own memory usage, not system-wide:

```python
import psutil
import os
import tracemalloc

def measure_memory_over_time(code_string, n_samples=10):
    """
    Returns list of (timestamp, memory_mb) tuples measured during execution.
    Measures the child process memory, not total system RAM.
    """
    import subprocess, time, threading

    memory_samples = []
    process_ref = [None]

    def sample_memory():
        start = time.time()
        while process_ref[0] is None:
            time.sleep(0.01)
        proc = process_ref[0]
        try:
            ps_proc = psutil.Process(proc.pid)
            while proc.poll() is None:
                try:
                    mem = ps_proc.memory_info().rss / (1024 * 1024)  # MB
                    elapsed = time.time() - start
                    memory_samples.append((round(elapsed, 3), round(mem, 2)))
                except psutil.NoSuchProcess:
                    break
                time.sleep(0.05)
        except Exception:
            pass

    sampler = threading.Thread(target=sample_memory, daemon=True)
    sampler.start()

    proc = subprocess.Popen(
        ["python3", "-c", code_string],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    process_ref[0] = proc
    proc.wait(timeout=30)
    sampler.join(timeout=2)

    # If no samples collected, return a single zero reading
    if not memory_samples:
        memory_samples = [(0.0, 0.0)]

    return memory_samples
```

### Done When

```
python3 -c "
from agents.performance_analyzer import analyze_performance
from core.schemas import UserInput
code = 'numbers = list(range(100000))\nresult = sum(x*x for x in numbers)\nprint(result)'
result = analyze_performance(UserInput(source_code=code, language='python'))
print('Memory:', result.memory_usage_mb, 'MB')
print('Timeline samples:', len(result.resource_timeline) if hasattr(result, 'resource_timeline') else 'N/A')
assert result.memory_usage_mb > 0, 'Memory should be > 0'
assert result.memory_usage_mb < 500, 'Memory should not be full system RAM (1000+MB)'
print('PASS')
"
```

**Commit:** `"fix: memory timeline now measures process RSS not total system RAM"`

---

## TASK 5.4 — Fix DNA Fingerprint Baseline Line Missing (Asaad → tell Abdulkadir)

**Owner:** Abdulkadir (frontend)
**Files:** `frontend/` — Insights page radar chart

### Problem

The DNA Fingerprint radar chart shows only one shape (optimized/green).
The baseline (red) shape is missing. This means the chart is not
receiving or rendering the `baseline` dataset.

### Fix Steps

In the radar chart component, make sure BOTH datasets are passed:

```jsx
// In your InsightsPage or DNAFingerprintChart component
const radarData = {
  labels: [
    "Speed",
    "Memory",
    "Security",
    "Readability",
    "Maintain.",
    "Complexity",
  ],
  datasets: [
    {
      label: "Baseline",
      data: [
        baselineMetrics.speed,
        baselineMetrics.memory,
        baselineMetrics.security,
        baselineMetrics.readability,
        baselineMetrics.maintainability,
        baselineMetrics.complexity,
      ],
      borderColor: "#ff4444", // red
      backgroundColor: "rgba(255, 68, 68, 0.1)",
      pointBackgroundColor: "#ff4444",
    },
    {
      label: "Optimized",
      data: [
        optimizedMetrics.speed,
        optimizedMetrics.memory,
        optimizedMetrics.security,
        optimizedMetrics.readability,
        optimizedMetrics.maintainability,
        optimizedMetrics.complexity,
      ],
      borderColor: "#00e5be", // teal/green
      backgroundColor: "rgba(0, 229, 190, 0.15)",
      pointBackgroundColor: "#00e5be",
    },
  ],
};
```

Check that `baselineMetrics` is populated from the API response
(it should come from the original code's DNA fingerprint score,
not the optimized one).

### Done When

Open the Insights page after an analysis — both a red shape (baseline)
and a green shape (optimized) appear on the radar chart.

**Commit:** `"fix: DNA fingerprint radar now shows both baseline and optimized datasets"`

---

## TASK 5.5 — Fix Execution Speed Card Display (Abdulkadir)

**Owner:** Abdulkadir
**Files:** `frontend/` — Insights page metric cards

### Problem

The Execution Speed card shows "5.3%" (the speedup percentage)
instead of the actual execution time in milliseconds (e.g., "260.3ms").

The speedup % already appears in the page header ("Insights APPROVED +5.3% faster").
The card should show the actual runtime value.

### Fix Steps

In the Execution Speed metric card, use `execution_time_ms` not `speedup_percentage`:

```jsx
// WRONG — currently showing speedup %
<MetricCard title="EXECUTION SPEED" value={`${result.speedup_percentage}%`} />

// CORRECT — show actual runtime
<MetricCard
  title="EXECUTION SPEED"
  value={result.original_execution_time_ms > 0
    ? `${result.original_execution_time_ms.toFixed(1)}ms`
    : "< 1ms"}
  subtext={result.speedup_percentage > 0
    ? `→ ${result.optimized_execution_time_ms.toFixed(1)}ms optimized`
    : null}
/>
```

### Done When

After analysis, Execution Speed card shows something like "260.3ms"
with a subtitle "→ 247.1ms optimized". Not a percentage.

**Commit:** `"fix: execution speed card shows ms value not speedup percentage"`

---

## FINAL VERIFICATION — Run after all 5 tasks complete

Paste this code into your system and confirm ALL checks pass:

```python
# verification_test.py
def find_duplicates(items):
    duplicates = []
    unused_var = "this does nothing"
    for i in range(len(items)):
        for j in range(len(items)):
            if i != j and items[i] == items[j]:
                if items[i] not in duplicates:
                    duplicates.append(items[i])
    return duplicates

def sum_of_squares(n):
    result = 0
    numbers = list(range(n))
    for num in numbers:
        result = result + num * num
    return result

data = [1, 2, 3, 2, 4, 1, 5]
print(find_duplicates(data))
print(sum_of_squares(1000))
```

**Expected results after fix:**

| Metric               | Before Fix  | After Fix                                  |
| -------------------- | ----------- | ------------------------------------------ |
| Bug Score            | 0/100       | 50-80/100                                  |
| Bugs detected        | 0           | 3+ (nested loop, unused var, memory waste) |
| Speedup              | 5.3%        | 20%+                                       |
| Memory MB            | 0.0 or 1200 | 5-50MB (real process memory)               |
| DNA Fingerprint      | 1 shape     | 2 shapes (red + green)                     |
| Execution Speed card | "5.3%"      | "260ms"                                    |

---

## COMMIT ORDER

```
git add agents/bug_detector.py core/prompts.py
git commit -m "fix(5.1): bug detector prompt detects real bugs"

git add agents/optimizer.py core/prompts.py
git commit -m "fix(5.2): optimizer demands algorithmic improvement"

git add agents/performance_analyzer.py
git commit -m "fix(5.3): memory timeline measures process RSS not system RAM"

git add frontend/
git commit -m "fix(5.4): DNA fingerprint shows both baseline and optimized"

git add frontend/
git commit -m "fix(5.5): execution speed card shows ms not percentage"
```
