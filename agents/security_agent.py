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


def _run_llm_security_scan(
    source_code: str,
    architect_report: ArchitectReport | None,
    bandit_issues: list[SecurityIssue],
) -> list[SecurityIssue]:
    """
    Ask Gemini to find logical security issues that bandit misses.
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


def _calculate_score(issues: list[SecurityIssue]) -> int:
    """
    Start at 100. Deduct per issue based on severity.
    CRITICAL: -25, HIGH: -15, MEDIUM: -8, LOW: -3. Floor at 0.
    """
    deductions = {"CRITICAL": 25, "HIGH": 15, "MEDIUM": 8, "LOW": 3}
    score = 100
    for issue in issues:
        score -= deductions.get(issue.severity, 3)
    return max(0, score)


def scan_security(
    user_input: UserInput,
    architect_report: ArchitectReport | None = None,
) -> SecurityReport:
    """
    Main function called by orchestrator.
    Runs bandit + Gemini scan, returns SecurityReport.
    """
    bandit_raw = _run_bandit(user_input.source_code)
    bandit_issues = _parse_bandit_issues(bandit_raw)

    llm_issues = _run_llm_security_scan(
        user_input.source_code, architect_report, bandit_issues
    )

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
