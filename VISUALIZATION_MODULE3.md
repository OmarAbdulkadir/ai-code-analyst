# VISUALIZATION_MODULE3.md

# Module 3: Advanced Observability & Visualization

# Owner: Asaad (System Architect & Pipeline Lead)

# Files I touch: orchestrator.py, agents/validator.py, core/schemas.py, core/config.py

---

## WHAT THIS MODULE ADDS

Three new observability features surfaced through the existing pipeline:

1. **Code DNA Fingerprint** — Spider/Radar chart with 6 metrics (Complexity, Security,
   Performance, Readability, Bug Density, Optimization). Red = baseline, Green = optimized.
2. **Shadow Sandbox** — UI tab that streams live stdout/stderr while the Validator runs.
3. **Resource Heatmap** — Time-series line graph of CPU % and Memory MB captured with
   `psutil` inside the Docker sandbox during execution.

Asaad's responsibility in this module:

- Add new schema fields to carry the visualization data through the pipeline
- Wire metric collection into `orchestrator.py` and `agents/validator.py`
- Expose streaming endpoint logic hooks in `orchestrator.py`
- **DO NOT** touch: `bug_detector.py`, `optimizer.py`, `prompts.py` (Ibro),
  `performance_analyzer.py`, `code_executor.py`, `Dockerfile` (Omer),
  `api/app.py`, `frontend/` (Abdulkadir)

Dependencies before starting:

- Module 1 fully pushed ✅
- Module 2 executed and pushed (RAG system in place)
- Omer's Docker sandbox running and accepting execution calls

---

## TASK 3.1 — Add DNA Fingerprint schema fields

**Time:** 30–45 min
**File to edit:** `core/schemas.py`

**What to add:**

Add a new Pydantic model `CodeDNAFingerprint` that holds the 6 radar chart scores for
one version of the code (baseline or optimized). Then add two optional fields to
`FinalReport` to carry both versions.

**Exact additions:**

```python
# --- NEW: Code DNA Fingerprint ---

class CodeDNAFingerprint(BaseModel):
    """
    Six normalised scores (0–100) for the radar chart.
    Higher is always better.
    """
    complexity: float       # 100 - cyclomatic_complexity_score (inverted: lower complexity = better)
    security: float         # 100 - (critical_issues * 20 + warnings * 5), clamped 0-100
    performance: float      # derived from execution_time rank vs baseline
    readability: float      # Gemini-supplied or AST heuristic (avg function length, naming)
    bug_density: float      # 100 - (bug_score from BugReport)
    optimization: float     # speedup_percentage mapped to 0-100 scale
    label: str              # "Baseline" or "Optimized"
```

In `FinalReport`, add:

```python
    baseline_dna: Optional[CodeDNAFingerprint] = None
    optimized_dna: Optional[CodeDNAFingerprint] = None
```

**Test:**

```python
from core.schemas import CodeDNAFingerprint, FinalReport

dna = CodeDNAFingerprint(
    complexity=72.0,
    security=85.0,
    performance=60.0,
    readability=78.0,
    bug_density=90.0,
    optimization=55.0,
    label="Baseline"
)
print(dna.model_dump())
# Expected: all 6 float fields present, label="Baseline", no validation errors
```

**Expected:** Schema instantiates cleanly. `FinalReport` accepts `baseline_dna` and
`optimized_dna` as optional fields without breaking existing pipeline tests.

**Commit:** `"schemas: added CodeDNAFingerprint model and dna fields to FinalReport"`

---

## TASK 3.2 — Add resource timeline schema fields

**Time:** 30–45 min
**File to edit:** `core/schemas.py`

**What to add:**

Add `ResourceSample` (one data point) and `ResourceTimeline` (full time series) to
carry CPU + memory traces from the sandbox. Wire into `FinalReport`.

**Exact additions:**

```python
# --- NEW: Resource Timeline (for heatmap) ---

class ResourceSample(BaseModel):
    """One psutil snapshot taken during code execution."""
    elapsed_ms: float       # milliseconds since execution start
    cpu_percent: float      # CPU % at this instant (0–100)
    memory_mb: float        # RSS memory in MB at this instant

class ResourceTimeline(BaseModel):
    """
    Full time-series collected during one code execution run.
    Contains the list of samples and summary stats.
    """
    samples: list[ResourceSample]
    peak_cpu_percent: float
    peak_memory_mb: float
    sample_interval_ms: float = 100.0   # how often psutil polled
```

In `FinalReport`, add:

```python
    baseline_resources: Optional[ResourceTimeline] = None
    optimized_resources: Optional[ResourceTimeline] = None
```

**Test:**

```python
from core.schemas import ResourceSample, ResourceTimeline, FinalReport

samples = [
    ResourceSample(elapsed_ms=0.0, cpu_percent=12.3, memory_mb=45.1),
    ResourceSample(elapsed_ms=100.0, cpu_percent=88.5, memory_mb=46.0),
    ResourceSample(elapsed_ms=200.0, cpu_percent=55.2, memory_mb=45.8),
]
timeline = ResourceTimeline(
    samples=samples,
    peak_cpu_percent=88.5,
    peak_memory_mb=46.0,
)
print(f"Samples: {len(timeline.samples)}, Peak CPU: {timeline.peak_cpu_percent}")
# Expected: Samples: 3, Peak CPU: 88.5
```

**Expected:** No validation errors. `FinalReport.baseline_resources` and
`optimized_resources` accept `ResourceTimeline` or `None`.

**Commit:** `"schemas: added ResourceSample, ResourceTimeline, resource fields to FinalReport"`

---

## TASK 3.3 — Compute and attach DNA Fingerprint in orchestrator

**Time:** 1–2 hours
**File to edit:** `orchestrator.py`

**Goal:** After the Validator stage completes, compute `baseline_dna` and `optimized_dna`
from the data already in the pipeline and attach them to `FinalReport`.

**Add a private helper method** `_compute_dna()` to the `Orchestrator` class:

```python
def _compute_dna(
    self,
    bug_report,
    perf_report,
    validation_result,
    label: str,
    is_optimized: bool = False
) -> "CodeDNAFingerprint":
    from core.schemas import CodeDNAFingerprint
    import math

    # Complexity: assume architect_report cyclomatic score if available,
    # else derive from perf time_complexity string
    complexity_map = {"O(1)": 95, "O(log n)": 88, "O(n)": 75,
                      "O(n log n)": 60, "O(n^2)": 35, "O(n^3)": 15}
    complexity = float(complexity_map.get(
        getattr(perf_report, "time_complexity", "O(n)"), 60
    ))

    # Security: derived from bug_report.has_critical_bugs + bug_score
    security = max(0.0, 100.0 - float(bug_report.bug_score) * 0.5)
    if bug_report.has_critical_bugs:
        security = min(security, 40.0)

    # Performance: normalise execution_time_ms to a 0-100 score
    # Assume anything ≤ 10ms = 100, anything ≥ 5000ms = 0
    t = getattr(perf_report, "execution_time_ms", 1000.0)
    performance = max(0.0, min(100.0, 100.0 - (t / 50.0)))

    # Readability: use a simple heuristic — not available yet, placeholder 70
    readability = 70.0

    # Bug density: invert bug_score
    bug_density = max(0.0, 100.0 - float(bug_report.bug_score))

    # Optimization: speedup_percentage mapped to 0-100
    # 0% speedup = 50 (neutral), 100% speedup = 100, worse = lower
    sp = getattr(validation_result, "speedup_percentage", 0.0) or 0.0
    optimization = max(0.0, min(100.0, 50.0 + sp * 0.5)) if not is_optimized else \
                   max(0.0, min(100.0, 50.0 + sp))

    return CodeDNAFingerprint(
        complexity=round(complexity, 1),
        security=round(security, 1),
        performance=round(performance, 1),
        readability=round(readability, 1),
        bug_density=round(bug_density, 1),
        optimization=round(optimization, 1),
        label=label,
    )
```

**Wire into the main `run()` method** — after building `FinalReport`, before returning:

```python
# Attach DNA fingerprints
try:
    final_report.baseline_dna = self._compute_dna(
        bug_report, perf_report, validation_result, label="Baseline", is_optimized=False
    )
    final_report.optimized_dna = self._compute_dna(
        bug_report, perf_report, validation_result, label="Optimized", is_optimized=True
    )
except Exception as e:
    print(f"[Orchestrator] DNA computation skipped: {e}")
    # Non-fatal — pipeline continues without DNA data
```

**Test:**

```python
# Run the full pipeline on sample_01 and check DNA is present
import json
from orchestrator import Orchestrator

code = open('datasets/sample_code/sample_01_duplicates.py').read()
orch = Orchestrator()
report = orch.run(code)

print("Baseline DNA:", report.baseline_dna)
print("Optimized DNA:", report.optimized_dna)

assert report.baseline_dna is not None, "baseline_dna must not be None"
assert report.optimized_dna is not None, "optimized_dna must not be None"
assert 0 <= report.baseline_dna.complexity <= 100
assert 0 <= report.optimized_dna.security <= 100
print("✅ DNA fingerprints attached successfully")
```

**Expected:** Both DNA objects present. All 6 scores in 0–100 range. No pipeline crash
if computation fails (graceful fallback).

**Commit:** `"orchestrator: compute and attach CodeDNAFingerprint after validation stage"`

---

## TASK 3.4 — Wire resource timeline into validator

**Time:** 1.5–2.5 hours
**File to edit:** `agents/validator.py`

**Goal:** During each `execute_code()` call inside the validator, spawn a background
`psutil` polling thread that samples CPU + memory every 100ms. Attach the resulting
`ResourceTimeline` to the returned validation data so the orchestrator can forward it.

**Step 1 — Add the polling helper at the top of `validator.py`:**

```python
import threading
import time
import psutil
from core.schemas import ResourceSample, ResourceTimeline

def _collect_resource_timeline(pid: int, stop_event: threading.Event,
                                 interval_ms: float = 100.0) -> list[ResourceSample]:
    """
    Poll psutil for the given PID every `interval_ms` milliseconds until
    stop_event is set. Returns a list of ResourceSample snapshots.
    """
    samples = []
    start = time.monotonic()
    try:
        proc = psutil.Process(pid)
    except psutil.NoSuchProcess:
        return samples

    while not stop_event.is_set():
        try:
            cpu = proc.cpu_percent(interval=None)
            mem = proc.memory_info().rss / (1024 * 1024)   # bytes → MB
            elapsed = (time.monotonic() - start) * 1000     # seconds → ms
            samples.append(ResourceSample(
                elapsed_ms=round(elapsed, 1),
                cpu_percent=round(cpu, 2),
                memory_mb=round(mem, 2),
            ))
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            break
        time.sleep(interval_ms / 1000.0)
    return samples
```

**Step 2 — Modify `validate_optimization()` to capture timelines:**

Wrap each `execute_code()` call to also spin up the collector thread. Since
`code_executor.execute_code()` is Omer's function, we cannot edit it. Instead, capture
the PID of the subprocess from the return value if Omer exposes it, or fall back to
polling the current process as a proxy. Check `ExecutionResult` for a `pid` field — if
it exists, use it; otherwise skip collection silently.

```python
def _run_with_timeline(code: str) -> tuple["ExecutionResult", Optional[ResourceTimeline]]:
    """
    Runs execute_code() and attempts to collect a ResourceTimeline in parallel.
    Falls back gracefully if PID is not available.
    """
    from core.code_executor import execute_code

    stop_event = threading.Event()
    samples_container = []

    # Start monitoring current process as fallback (validator process itself)
    monitor_pid = os.getpid()

    def monitor():
        samples_container.extend(
            _collect_resource_timeline(monitor_pid, stop_event, interval_ms=100.0)
        )

    t = threading.Thread(target=monitor, daemon=True)
    t.start()

    result = execute_code(code)     # Omer's function — do not modify

    stop_event.set()
    t.join(timeout=2.0)

    if len(samples_container) < 2:
        return result, None

    timeline = ResourceTimeline(
        samples=samples_container,
        peak_cpu_percent=max(s.cpu_percent for s in samples_container),
        peak_memory_mb=max(s.memory_mb for s in samples_container),
        sample_interval_ms=100.0,
    )
    return result, timeline
```

**Step 3 — Update `validate_optimization()` return signature:**

Change the two `execute_code()` calls to use `_run_with_timeline()`, capturing
the timelines. Store them on `ValidationResult` by **temporarily** carrying them
as extra data back to the orchestrator via a wrapper tuple:

```python
# In validate_optimization(), replace:
#   original_result = execute_code(original_code)
# With:
original_exec, baseline_timeline = _run_with_timeline(original_code)
optimized_exec, optimized_timeline = _run_with_timeline(optimized_code)
```

Return a `dict` wrapper from `validate_optimization()` so the orchestrator can
unpack both the `ValidationResult` and the timelines:

```python
return {
    "validation": validation_result,   # ValidationResult object
    "baseline_resources": baseline_timeline,
    "optimized_resources": optimized_timeline,
}
```

**Step 4 — Update `orchestrator.py` to unpack the new return format:**

In the Validator stage of `run()`:

```python
validator_output = validate_optimization(original_code, optimized_code)

if isinstance(validator_output, dict):
    validation_result = validator_output["validation"]
    final_report.baseline_resources = validator_output.get("baseline_resources")
    final_report.optimized_resources = validator_output.get("optimized_resources")
else:
    # Backwards-compatible fallback if validator returns old format
    validation_result = validator_output
```

**Install psutil if not already in requirements:**

```bash
source venv/bin/activate
pip install psutil --break-system-packages  # only if not already installed
grep -q "psutil" requirements.txt || echo "psutil>=5.9.0" >> requirements.txt
```

**Test:**

```python
from agents.validator import validate_optimization

original = open('datasets/sample_code/sample_01_duplicates_large.py').read()
optimized = '''
import random
def find_duplicates(lst):
    seen = set()
    dups = set()
    for x in lst:
        if x in seen:
            dups.add(x)
        seen.add(x)
    return list(dups)

data = list(range(2000)) + list(range(1000))
print(sorted(find_duplicates(data)))
'''

output = validate_optimization(original, optimized)
assert isinstance(output, dict), "Must return dict with validation + timeline keys"
assert output["validation"] is not None
print("Baseline timeline:", output["baseline_resources"])
print("Optimized timeline:", output["optimized_resources"])

if output["baseline_resources"]:
    tl = output["baseline_resources"]
    assert len(tl.samples) > 0, "Must have at least one sample"
    assert tl.peak_memory_mb > 0
    print(f"✅ Collected {len(tl.samples)} baseline samples, "
          f"peak mem: {tl.peak_memory_mb:.1f} MB")
else:
    print("⚠️  Timeline not collected (psutil fallback may not catch short runs) — OK")
```

**Expected:** `validate_optimization()` returns a dict. Timelines collected for runs
longer than ~200ms. Short-running code may return `None` timelines — that is acceptable.
Pipeline does not crash either way.

**Commit:** `"validator: psutil resource timeline collection for CPU/memory heatmap"`

---

## TASK 3.5 — Expose streaming hook for Shadow Sandbox in orchestrator

**Time:** 1–1.5 hours
**File to edit:** `orchestrator.py`

**Goal:** Add an optional `on_log` callback parameter to `Orchestrator.run()`. When
provided, the orchestrator calls it with each log line during the Validator stage so
Abdulkadir's API layer can stream stdout/stderr to the frontend via SSE.

**Step 1 — Update `run()` signature:**

```python
def run(self, source_code: str,
        on_log: Optional[callable] = None) -> FinalReport:
```

Import `Optional` from `typing` if not already imported:

```python
from typing import Optional, Callable
```

**Step 2 — Add a `_emit_log()` helper inside `Orchestrator`:**

```python
def _emit_log(self, message: str, on_log: Optional[Callable] = None):
    """Emit a log line to the callback (for streaming) and to stdout."""
    print(f"[Pipeline] {message}")
    if on_log:
        try:
            on_log(message)
        except Exception:
            pass    # Never let a logging failure crash the pipeline
```

**Step 3 — Add stage-boundary log calls in `run()`:**

Insert `_emit_log()` calls at each stage boundary inside `run()`. Example:

```python
self._emit_log("Stage 1/6: Architect Agent — AST analysis starting", on_log)
# ... architect agent call ...
self._emit_log("Stage 1/6: Architect Agent — complete", on_log)

self._emit_log("Stage 2/6: Security Agent — scanning for vulnerabilities", on_log)
# ... security agent call ...
self._emit_log("Stage 2/6: Security Agent — complete", on_log)

self._emit_log("Stage 3/6: Bug Detector — Gemini analysis starting", on_log)
# ... bug detector call ...
self._emit_log("Stage 3/6: Bug Detector — complete", on_log)

self._emit_log("Stage 4/6: Performance Analyzer — executing code + measuring", on_log)
# ... performance analyzer call ...
self._emit_log("Stage 4/6: Performance Analyzer — complete", on_log)

self._emit_log("Stage 5/6: Optimizer — generating optimized code via Gemini", on_log)
# ... optimizer call ...
self._emit_log("Stage 5/6: Optimizer — complete", on_log)

self._emit_log("Stage 6/6: Validator — running both code versions for comparison", on_log)
# ... validator call ...
self._emit_log("Stage 6/6: Validator — complete", on_log)

self._emit_log("Pipeline complete — Final report ready", on_log)
```

**Also relay validator stdout/stderr** — add this around the validator call:

```python
validator_output = validate_optimization(original_code, optimized_code)

# If validator output contains raw execution stdout, relay it
if isinstance(validator_output, dict):
    validation_result = validator_output["validation"]
    ...
    # Relay validator execution output to streaming client
    exec_stdout = getattr(validation_result, 'original_stdout', None)
    if exec_stdout and on_log:
        for line in exec_stdout.splitlines():
            self._emit_log(f"[Sandbox stdout] {line}", on_log)
```

**Test:**

```python
from orchestrator import Orchestrator

logs = []
def capture_log(msg):
    logs.append(msg)

code = open('datasets/sample_code/sample_01_duplicates.py').read()
orch = Orchestrator()
report = orch.run(code, on_log=capture_log)

print(f"Captured {len(logs)} log lines")
for line in logs:
    print(" >", line)

assert any("Stage 1" in l for l in logs), "Must have stage 1 log"
assert any("Stage 6" in l for l in logs), "Must have stage 6 log"
assert any("complete" in l.lower() for l in logs), "Must have completion log"
print("✅ Streaming hook works — all stage logs captured")
```

**Expected:** `on_log` callback fires at least 12 times (2 per stage + pipeline complete).
Running `run()` without `on_log` still works exactly as before (no regression).

**Commit:** `"orchestrator: added on_log streaming callback for Shadow Sandbox SSE"`

---

## TASK 3.6 — Final end-to-end verification

**Time:** 45 min–1 hour
**No new files** — verification only

**Run the full pipeline on all 3 sample files and confirm all Module 3 fields are
populated correctly.**

```bash
source venv/bin/activate
cd ~/Videos/Graduation\ Project/ai-code-analyst
```

```python
import json
from orchestrator import Orchestrator

samples = [
    'datasets/sample_code/sample_01_duplicates.py',
    'datasets/sample_code/sample_02_fibonacci.py',
    'datasets/sample_code/sample_03_sort.py',
]

orch = Orchestrator()
logs = []

for path in samples:
    print(f"\n{'='*60}")
    print(f"Testing: {path}")
    logs.clear()
    code = open(path).read()
    report = orch.run(code, on_log=lambda m: logs.append(m))

    # 1. DNA Fingerprint check
    assert report.baseline_dna is not None, f"Missing baseline_dna for {path}"
    assert report.optimized_dna is not None, f"Missing optimized_dna for {path}"
    for field in ["complexity", "security", "performance",
                  "readability", "bug_density", "optimization"]:
        val = getattr(report.baseline_dna, field)
        assert 0 <= val <= 100, f"{field} out of range: {val}"
    print(f"✅ DNA fingerprint: OK")
    print(f"   Baseline: {report.baseline_dna.model_dump()}")
    print(f"   Optimized: {report.optimized_dna.model_dump()}")

    # 2. Resource timeline check (may be None for fast code — acceptable)
    if report.baseline_resources:
        assert len(report.baseline_resources.samples) > 0
        print(f"✅ Resource timeline: {len(report.baseline_resources.samples)} samples, "
              f"peak CPU {report.baseline_resources.peak_cpu_percent:.1f}%")
    else:
        print(f"⚠️  Resource timeline: None (code too fast to sample — acceptable)")

    # 3. Streaming log check
    assert len(logs) >= 12, f"Expected ≥12 log lines, got {len(logs)}"
    print(f"✅ Streaming logs: {len(logs)} lines captured")

print("\n🎉 Module 3 verification complete — all checks passed")
```

**Also verify `FinalReport` serialises cleanly to JSON (Abdulkadir needs this):**

```python
report_json = report.model_dump()
json_str = json.dumps(report_json, indent=2, default=str)
print(f"Report JSON size: {len(json_str)} chars")
assert '"baseline_dna"' in json_str
assert '"baseline_resources"' in json_str
print("✅ JSON serialisation: OK — all new fields present")
```

**Save results for the report:**

```bash
mkdir -p docs/test_results
python3 -c "
import json
from orchestrator import Orchestrator
code = open('datasets/sample_code/sample_01_duplicates.py').read()
r = Orchestrator().run(code)
with open('docs/test_results/module3_verification.json', 'w') as f:
    json.dump(r.model_dump(), f, indent=2, default=str)
print('Saved to docs/test_results/module3_verification.json')
"
```

**Commit:** `"module3: end-to-end verification passed, results saved to docs/test_results"`

---

## SUMMARY — What Asaad delivers in Module 3

| Task | File                  | What it adds                                                     |
| ---- | --------------------- | ---------------------------------------------------------------- |
| 3.1  | `core/schemas.py`     | `CodeDNAFingerprint` model + 2 fields on `FinalReport`           |
| 3.2  | `core/schemas.py`     | `ResourceSample`, `ResourceTimeline` + 2 fields on `FinalReport` |
| 3.3  | `orchestrator.py`     | `_compute_dna()` helper + DNA attachment after validation        |
| 3.4  | `agents/validator.py` | psutil polling thread + `ResourceTimeline` output                |
| 3.5  | `orchestrator.py`     | `on_log` callback + 12 stage boundary log events                 |
| 3.6  | —                     | Full verification + JSON saved to `docs/test_results/`           |

**Total commits: 6** (one per task, same as Modules 1 & 2)

**What Abdulkadir gets from this module (hand-off to him):**

- `report.baseline_dna` / `report.optimized_dna` → 6 float scores each → feeds radar chart
- `report.baseline_resources` / `report.optimized_resources` → list of `{elapsed_ms, cpu_percent, memory_mb}` → feeds heatmap line chart
- `on_log` callback in `Orchestrator.run()` → Abdulkadir wires this to his SSE endpoint → feeds Shadow Sandbox live log tab

**Coordinate with Abdulkadir:** Tell him the `on_log` signature is `(message: str) -> None`.
He needs to pass a callback when calling the orchestrator from `api/app.py`.
