# MODULE 1: Architecture Upgrade — Architect Agent & Security Agent

# Task file for Claude Code (Asaad only)

# Execute tasks IN ORDER. One commit per task. Do NOT skip ahead.

---

## CONTEXT

We are extending the existing multi-agent pipeline by adding 2 new agents:

1. **Architect Agent** — analyzes the structure of the submitted code: maps functions,
   detects dependencies between them, and identifies which parts are most complex.
   Runs FIRST so all downstream agents have structural context.

2. **Security Agent** — scans for high-risk vulnerabilities using both `bandit` (static
   scanner) and Gemini (LLM-based logic). Detects: SQL injection, hardcoded secrets,
   unsafe file operations, dangerous eval/exec usage.
   Runs SECOND, after Architect, before Bug Detector.

**Updated pipeline order:**

```
User code
  → Architect Agent     (NEW — Asaad)
  → Security Agent      (NEW — Asaad)
  → Bug Detector        (Ibro — unchanged)
  → Performance Analyzer (Omer — unchanged)
  → Optimizer           (Ibro — receives new context)
  → Validator           (Asaad — unchanged)
  → Final Report
```

**Files Asaad owns and will edit:**

- `orchestrator.py`
- `agents/validator.py`
- `core/schemas.py`
- `core/config.py`

**New files Asaad will create:**

- `agents/architect_agent.py`
- `agents/security_agent.py`

**Files to NOT touch:**

- `agents/bug_detector.py` (Ibro)
- `agents/optimizer.py` (Ibro)
- `core/prompts.py` (Ibro)
- `agents/performance_analyzer.py` (Omer)
- `core/code_executor.py` (Omer)
- `api/app.py` (Abdulkadir)
- `frontend/` (Abdulkadir)

---

## PREREQUISITES

Before starting, verify these pass:

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst
source venv/bin/activate
python orchestrator.py
```

Pipeline must run without errors before you add anything.

Also add `bandit` to requirements.txt and install it:

```bash
echo "bandit>=1.7.0" >> requirements.txt
pip install bandit
```

**Commit:** `"deps: added bandit for security scanning"`

---

## TASK 1 — Add ArchitectReport schema to core/schemas.py

**Time:** 30 min  
**File:** `core/schemas.py`

Add this new Pydantic model. Place it BEFORE `BugReport` in the file.

```python
class FunctionInfo(BaseModel):
    name: str
    calls: List[str] = []          # other functions this one calls
    complexity: str = "unknown"    # "low", "medium", "high"

class ArchitectReport(BaseModel):
    functions_found: List[FunctionInfo] = []
    dependency_map: Dict[str, List[str]] = {}   # function -> list of functions it calls
    most_complex_function: str = ""
    total_functions: int = 0
    architecture_summary: str = ""
```

Also add `SecurityReport` model right after `ArchitectReport`:

```python
class SecurityIssue(BaseModel):
    severity: str          # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    issue_type: str        # e.g. "SQL_INJECTION", "HARDCODED_SECRET"
    line_number: int = 0
    description: str
    recommendation: str

class SecurityReport(BaseModel):
    security_score: int = 100      # starts at 100, deducted per issue
    issues: List[SecurityIssue] = []
    has_critical_issues: bool = False
    bandit_issues_count: int = 0
    llm_issues_count: int = 0
    summary: str = ""
```

Also update `FinalReport` to include both new reports:

```python
class FinalReport(BaseModel):
    # --- ADD these two fields (keep all existing fields unchanged) ---
    architect_report: Optional[ArchitectReport] = None
    security_report: Optional[SecurityReport] = None
    # existing fields below — do not change them
    ...
```

**Required imports to add at top of schemas.py** (only if not already present):

```python
from typing import List, Dict, Optional
```

**Test:**

```bash
python -c "from core.schemas import ArchitectReport, SecurityReport, FinalReport; print('schemas OK')"
```

**Commit:** `"schemas: added ArchitectReport and SecurityReport models"`

---

## TASK 2 — Build agents/architect_agent.py

**Time:** 1.5 hours  
**File to create:** `agents/architect_agent.py`

This agent does TWO things:

1. Uses Python's `ast` module (stdlib, no install needed) to parse the code and extract real function names and call relationships — no Gemini needed for this part.
2. Calls Gemini to write a brief architecture summary in plain English.

```python
import ast
import json
import re
from typing import Dict, List

from core.schemas import ArchitectReport, FunctionInfo, UserInput
from core.config import GEMINI_API_KEY

# ── OpenAI-compatible client pointing at OpenRouter ──────────────────────────
from openai import OpenAI

client = OpenAI(
    api_key=GEMINI_API_KEY,
    base_url="https://openrouter.ai/api/v1",
)
MODEL = "google/gemini-2.0-flash-001"


# ── AST-based analysis (no AI needed) ────────────────────────────────────────

def _extract_functions(source_code: str) -> Dict[str, List[str]]:
    """
    Returns a dict: { function_name: [list of functions it calls] }
    Uses Python ast — works only on valid Python code.
    Returns empty dict if code cannot be parsed.
    """
    try:
        tree = ast.parse(source_code)
    except SyntaxError:
        return {}

    # Collect all top-level function names first
    all_functions = {
        node.name for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef)
    }

    dependency_map: Dict[str, List[str]] = {}

    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef):
            continue
        calls = []
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                # Direct call: func()
                if isinstance(child.func, ast.Name):
                    if child.func.id in all_functions and child.func.id != node.name:
                        calls.append(child.func.id)
                # Method call: obj.method()
                elif isinstance(child.func, ast.Attribute):
                    if child.func.attr in all_functions:
                        calls.append(child.func.attr)
        dependency_map[node.name] = list(set(calls))

    return dependency_map


def _estimate_complexity(source_code: str, func_name: str) -> str:
    """
    Rough complexity estimate based on nesting depth and loop count.
    """
    try:
        tree = ast.parse(source_code)
    except SyntaxError:
        return "unknown"

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == func_name:
            loop_count = sum(
                1 for n in ast.walk(node)
                if isinstance(n, (ast.For, ast.While))
            )
            if loop_count == 0:
                return "low"
            elif loop_count <= 2:
                return "medium"
            else:
                return "high"
    return "unknown"


# ── Gemini summary ────────────────────────────────────────────────────────────

def _get_architecture_summary(source_code: str, dependency_map: Dict[str, List[str]]) -> str:
    """
    Ask Gemini for a plain-English summary of the code structure.
    Falls back to a generic message if Gemini fails.
    """
    dep_str = json.dumps(dependency_map, indent=2)
    prompt = f"""You are a code architecture analyst.
Given this Python code and its function dependency map, write a 2-3 sentence plain-English
summary of the code's structure. Focus on: what the code does, how functions are organized,
and which part is most critical.

Dependency map (function -> functions it calls):
{dep_str}

Code:
{source_code[:2000]}

Respond with ONLY the summary text. No JSON, no markdown, no extra formatting."""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Architecture analysis completed. {len(dependency_map)} functions found."


# ── Main entry point ──────────────────────────────────────────────────────────

def analyze_architecture(user_input: UserInput) -> ArchitectReport:
    """
    Main function called by orchestrator.
    Returns ArchitectReport with function map and summary.
    """
    source_code = user_input.source_code

    # Step 1: AST analysis
    dependency_map = _extract_functions(source_code)

    # Step 2: Build FunctionInfo list
    functions_found = []
    for func_name, calls in dependency_map.items():
        complexity = _estimate_complexity(source_code, func_name)
        functions_found.append(FunctionInfo(
            name=func_name,
            calls=calls,
            complexity=complexity,
        ))

    # Step 3: Find most complex function
    most_complex = ""
    if functions_found:
        order = {"high": 3, "medium": 2, "low": 1, "unknown": 0}
        most_complex = max(functions_found, key=lambda f: order.get(f.complexity, 0)).name

    # Step 4: Gemini summary
    summary = _get_architecture_summary(source_code, dependency_map)

    return ArchitectReport(
        functions_found=functions_found,
        dependency_map=dependency_map,
        most_complex_function=most_complex,
        total_functions=len(functions_found),
        architecture_summary=summary,
    )
```

**Test:**

```python
from agents.architect_agent import analyze_architecture
from core.schemas import UserInput

sample = UserInput(
    source_code="""
def add(a, b):
    return a + b

def process(items):
    total = 0
    for item in items:
        for sub in item:
            total = add(total, sub)
    return total
""",
    language="python"
)

report = analyze_architecture(sample)
print(f"Functions: {report.total_functions}")
print(f"Most complex: {report.most_complex_function}")
print(f"Summary: {report.architecture_summary}")
assert report.total_functions == 2
assert report.most_complex_function == "process"
print("architect_agent test PASSED")
```

**Commit:** `"agents: added architect_agent.py with AST analysis and Gemini summary"`

---

## TASK 3 — Build agents/security_agent.py

**Time:** 2 hours  
**File to create:** `agents/security_agent.py`

This agent runs `bandit` as a subprocess on the code, then sends the results + the code
to Gemini to catch additional logical vulnerabilities that bandit misses.

````python
import json
import re
import subprocess
import tempfile
import os

from core.schemas import SecurityReport, SecurityIssue, UserInput, ArchitectReport
from core.config import GEMINI_API_KEY

from openai import OpenAI

client = OpenAI(
    api_key=GEMINI_API_KEY,
    base_url="https://openrouter.ai/api/v1",
)
MODEL = "google/gemini-2.0-flash-001"


# ── Bandit static scan ────────────────────────────────────────────────────────

def _run_bandit(source_code: str) -> list[dict]:
    """
    Writes code to a temp file, runs bandit, parses JSON output.
    Returns list of bandit issue dicts. Returns [] on any failure.
    """
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8"
    ) as f:
        f.write(source_code)
        tmp_path = f.name

    try:
        result = subprocess.run(
            ["bandit", "-r", tmp_path, "-f", "json", "-q"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.stdout.strip():
            data = json.loads(result.stdout)
            return data.get("results", [])
        return []
    except Exception:
        return []
    finally:
        os.unlink(tmp_path)


def _parse_bandit_issues(bandit_results: list[dict]) -> list[SecurityIssue]:
    """Convert bandit JSON results to SecurityIssue objects."""
    issues = []
    for r in bandit_results:
        severity = r.get("issue_severity", "LOW").upper()
        issues.append(SecurityIssue(
            severity=severity,
            issue_type=r.get("test_id", "UNKNOWN"),
            line_number=r.get("line_number", 0),
            description=r.get("issue_text", ""),
            recommendation=f"See bandit rule {r.get('test_id', '')}. "
                           f"More info: {r.get('more_info', '')}",
        ))
    return issues


# ── Gemini LLM scan ───────────────────────────────────────────────────────────

def _run_llm_security_scan(
    source_code: str,
    architect_report: ArchitectReport | None,
    bandit_issues: list[SecurityIssue],
) -> list[SecurityIssue]:
    """
    Ask Gemini to find logical security issues that bandit misses:
    SQL injection, hardcoded secrets, unsafe deserialization, etc.
    Returns list of SecurityIssue objects.
    """
    bandit_summary = (
        f"Bandit already found {len(bandit_issues)} issue(s): "
        + ", ".join(i.issue_type for i in bandit_issues)
    ) if bandit_issues else "Bandit found no issues."

    arch_context = ""
    if architect_report and architect_report.architecture_summary:
        arch_context = f"\nCode structure context: {architect_report.architecture_summary}"

    prompt = f"""You are a security expert reviewing Python code.
{arch_context}
{bandit_summary}

Find ADDITIONAL security vulnerabilities that bandit may have missed. Focus on:
- SQL injection (string formatting in queries)
- Hardcoded passwords, API keys, or tokens
- Unsafe use of eval() or exec()
- Path traversal vulnerabilities
- Insecure deserialization (pickle.loads on untrusted data)
- Missing input validation on user-controlled data

Code to review:
{source_code[:3000]}

Respond ONLY with a JSON array. Each item must have exactly these fields:
{{
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "issue_type": "SHORT_TYPE_NAME",
  "line_number": 0,
  "description": "what the issue is",
  "recommendation": "how to fix it"
}}

If no additional issues found, respond with an empty array: []
Do NOT include issues already covered by bandit. Do NOT add markdown backticks."""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000,
            temperature=0.2,
        )
        raw = response.choices[0].message.content.strip()

        # Strip markdown fences if present
        raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()

        items = json.loads(raw)
        issues = []
        for item in items:
            issues.append(SecurityIssue(
                severity=item.get("severity", "LOW").upper(),
                issue_type=item.get("issue_type", "UNKNOWN"),
                line_number=item.get("line_number", 0),
                description=item.get("description", ""),
                recommendation=item.get("recommendation", ""),
            ))
        return issues
    except Exception:
        return []


# ── Score calculation ─────────────────────────────────────────────────────────

def _calculate_score(issues: list[SecurityIssue]) -> int:
    """
    Start at 100. Deduct per issue based on severity.
    CRITICAL: -25, HIGH: -15, MEDIUM: -8, LOW: -3
    Floor at 0.
    """
    deductions = {"CRITICAL": 25, "HIGH": 15, "MEDIUM": 8, "LOW": 3}
    score = 100
    for issue in issues:
        score -= deductions.get(issue.severity, 3)
    return max(0, score)


# ── Main entry point ──────────────────────────────────────────────────────────

def scan_security(
    user_input: UserInput,
    architect_report: ArchitectReport | None = None,
) -> SecurityReport:
    """
    Main function called by orchestrator.
    Runs bandit + Gemini scan, returns SecurityReport.
    """
    # Step 1: Bandit scan
    bandit_raw = _run_bandit(user_input.source_code)
    bandit_issues = _parse_bandit_issues(bandit_raw)

    # Step 2: LLM scan
    llm_issues = _run_llm_security_scan(
        user_input.source_code, architect_report, bandit_issues
    )

    # Step 3: Combine
    all_issues = bandit_issues + llm_issues
    has_critical = any(i.severity == "CRITICAL" for i in all_issues)
    score = _calculate_score(all_issues)

    summary_parts = []
    if not all_issues:
        summary_parts.append("No security issues detected.")
    else:
        summary_parts.append(f"Found {len(all_issues)} security issue(s).")
        if has_critical:
            summary_parts.append("CRITICAL issues require immediate attention.")

    return SecurityReport(
        security_score=score,
        issues=all_issues,
        has_critical_issues=has_critical,
        bandit_issues_count=len(bandit_issues),
        llm_issues_count=len(llm_issues),
        summary=" ".join(summary_parts),
    )
````

**Test:**

```python
from agents.security_agent import scan_security
from core.schemas import UserInput

# Test 1: Clean code
clean = UserInput(source_code="def add(a, b):\n    return a + b", language="python")
r = scan_security(clean)
print(f"Clean code score: {r.security_score}")
assert r.security_score >= 80, "Clean code should have high score"

# Test 2: Dangerous code
dangerous = UserInput(
    source_code="""
import subprocess
password = "hardcoded_secret_123"
def run_cmd(user_input):
    eval(user_input)
    subprocess.call(user_input, shell=True)
""",
    language="python"
)
r2 = scan_security(dangerous)
print(f"Dangerous code score: {r2.security_score}")
print(f"Issues found: {len(r2.issues)}")
assert r2.security_score < 80, "Dangerous code should have lower score"
assert len(r2.issues) > 0, "Should find at least one issue"

print("security_agent tests PASSED")
```

**Commit:** `"agents: added security_agent.py with bandit and LLM scanning"`

---

## TASK 4 — Wire both agents into orchestrator.py

**Time:** 1 hour  
**File:** `orchestrator.py`

**Step 1:** Add imports at the top of orchestrator.py:

```python
from agents.architect_agent import analyze_architecture
from agents.security_agent import scan_security
```

**Step 2:** Update the pipeline run method. The new order is:

```python
# ── Stage 1: Architecture Analysis (NEW) ─────────────────────────────────────
print("  [1/6] Architect Agent running...")
try:
    architect_report = analyze_architecture(user_input)
    print(f"       Found {architect_report.total_functions} functions. "
          f"Most complex: {architect_report.most_complex_function}")
except Exception as e:
    print(f"       Architect Agent failed: {e}")
    architect_report = ArchitectReport(
        architecture_summary=f"Architecture analysis failed: {str(e)}"
    )

# ── Stage 2: Security Scan (NEW) ─────────────────────────────────────────────
print("  [2/6] Security Agent running...")
try:
    security_report = scan_security(user_input, architect_report)
    print(f"       Security score: {security_report.security_score}/100. "
          f"Issues: {len(security_report.issues)}")
except Exception as e:
    print(f"       Security Agent failed: {e}")
    security_report = SecurityReport(
        security_score=100,
        summary=f"Security scan failed: {str(e)}"
    )

# ── Stage 3: Bug Detection (was Stage 1) ─────────────────────────────────────
print("  [3/6] Bug Detector running...")
# ... existing bug detector code (update print label only)

# ── Stage 4: Performance Analysis (was Stage 2) ───────────────────────────────
print("  [4/6] Performance Analyzer running...")
# ... existing performance analyzer code (update print label only)

# ── Stage 5: Optimizer (was Stage 3) ─────────────────────────────────────────
print("  [5/6] Optimizer running...")
# ... existing optimizer code (update print label only)

# ── Stage 6: Validator (was Stage 4) ─────────────────────────────────────────
print("  [6/6] Validator running...")
# ... existing validator code (update print label only)
```

**Step 3:** Add both new reports to the FinalReport at the end:

```python
final_report = FinalReport(
    architect_report=architect_report,    # ADD
    security_report=security_report,      # ADD
    # ... all existing fields unchanged
)
```

**Also update imports at the top of orchestrator.py:**

```python
from core.schemas import (
    UserInput, FinalReport,
    ArchitectReport, SecurityReport,   # ADD these two
    # ... existing imports unchanged
)
```

**Test:**

```bash
python orchestrator.py
```

Expected output shows all 6 stages printing. FinalReport JSON includes
`architect_report` and `security_report` fields with real data.

**Commit:** `"orchestrator: wired architect and security agents into pipeline (6 stages)"`

---

## TASK 5 — Update progress tracking in FinalReport

**Time:** 30 min  
**File:** `core/schemas.py`

If `stages_completed` field exists in `FinalReport`, update it to include the 2 new stages:

```python
# In FinalReport, update stages_completed default or wherever stages are listed:
stages_completed: List[str] = []
# The orchestrator should now append:
# "architecture_analysis", "security_scan", "bug_detection",
# "performance_analysis", "optimization", "validation"
```

Update orchestrator.py to append the new stage names to `stages_completed` after each
stage succeeds (same pattern as existing stages).

**Test:**

```bash
python orchestrator.py
```

FinalReport JSON must show all 6 stage names in `stages_completed`.

**Commit:** `"orchestrator: updated progress tracking to include 6 stages"`

---

## FINAL VERIFICATION

Run this full check after all 5 tasks are done:

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst
source venv/bin/activate

# 1. Schema imports
python -c "from core.schemas import ArchitectReport, SecurityReport, FunctionInfo, SecurityIssue; print('schemas OK')"

# 2. Architect agent
python -c "
from agents.architect_agent import analyze_architecture
from core.schemas import UserInput
r = analyze_architecture(UserInput(source_code='def f():\n    pass', language='python'))
print('architect OK:', r.total_functions, 'functions')
"

# 3. Security agent
python -c "
from agents.security_agent import scan_security
from core.schemas import UserInput
r = scan_security(UserInput(source_code='def f():\n    pass', language='python'))
print('security OK: score', r.security_score)
"

# 4. Full pipeline
python orchestrator.py
```

All must pass with no errors. Full pipeline must show 6 stages and return
`architect_report` and `security_report` in the JSON output.

---

## EXPECTED NEW COMMITS (Module 1)

```
1. "deps: added bandit for security scanning"
2. "schemas: added ArchitectReport and SecurityReport models"
3. "agents: added architect_agent.py with AST analysis and Gemini summary"
4. "agents: added security_agent.py with bandit and LLM scanning"
5. "orchestrator: wired architect and security agents into pipeline (6 stages)"
6. "orchestrator: updated progress tracking to include 6 stages"
```

Total: 6 new commits on top of your existing history.

---

## RULES FOR THIS MODULE

- ONLY edit files listed above (your files + 2 new agent files)
- NEVER edit bug_detector.py, optimizer.py, performance_analyzer.py, api/app.py, or frontend/
- Run `python orchestrator.py` after EVERY task
- If a task fails, fix it before moving to the next
- The 2 new agents must follow the exact same pattern as existing agents (function in, Pydantic out)
