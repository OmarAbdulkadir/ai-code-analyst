import json
import re
from openai import OpenAI
from core.schemas import UserInput, BugReport, PerformanceReport, OptimizationResult, SecurityReport
from core.prompts import OPTIMIZER_PROMPT
from core.config import OPENAI_API_KEY

client = OpenAI(
    api_key=OPENAI_API_KEY,
)

def _clean_json(text: str) -> str:
    text = text.strip()
    # Remove markdown code blocks
    text = re.sub(r"^```json\s*", "", text)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()

def optimize_code(
    user_input: UserInput,
    bug_report: BugReport,
    performance_report: PerformanceReport,
    security_report: SecurityReport = None,
    feedback: str = None,
) -> OptimizationResult:
    # Input validation
    if not user_input.source_code or not user_input.source_code.strip():
        return OptimizationResult(
            optimized_code="",
            changes_made=["No code provided."],
            expected_improvement="N/A",
        )

    if len(user_input.source_code) > 10000:
        return OptimizationResult(
            optimized_code=user_input.source_code,
            changes_made=["Code is too long to optimize. Please submit code under 10,000 characters."],
            expected_improvement="N/A",
        )

    if security_report and security_report.issues:
        sec_lines = "; ".join(
            f"{iss.severity.upper()}: {iss.description}" for iss in security_report.issues
        )
    else:
        sec_lines = "none detected"

    prompt = OPTIMIZER_PROMPT.format(
        original_code=user_input.source_code,
        security_issues=sec_lines,
        bug_summary=bug_report.summary,
        performance_bottlenecks=", ".join(performance_report.bottlenecks) if performance_report.bottlenecks else "none detected",
    )

    if feedback:
        prompt += f"\n\nPREVIOUS ATTEMPT FAILED: {feedback}\nAdjust your strategy accordingly."

    def _call_model(p: str) -> dict | None:
        """Call the model and parse JSON. Returns dict or None on failure."""
        r = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": p}],
        )
        raw = _clean_json(r.choices[0].message.content)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    data = _call_model(prompt)

    # Retry 1: JSON parse failed
    if data is None:
        json_fix = prompt + "\n\nCRITICAL: Return ONLY raw JSON. No markdown. No triple quotes inside string values — use single quotes or \\n escapes."
        data = _call_model(json_fix)

    if data is None:
        return OptimizationResult(
            optimized_code=user_input.source_code,
            changes_made=["Could not parse optimizer response. Returning original code."],
            expected_improvement="Unknown",
        )

    optimized = data.get("optimized_code", user_input.source_code)

    # Retry 2: Model returned the original code unchanged — force algorithmic rewrite
    if optimized.strip() == user_input.source_code.strip() or not data.get("changes_made"):
        force_prompt = (
            prompt
            + "\n\nYOU RETURNED THE ORIGINAL CODE UNCHANGED. This is unacceptable."
            + "\nYou MUST rewrite every nested for-loop using sets, dicts, or built-in functions."
            + "\nDo NOT return the same code. Make real algorithmic changes now."
        )
        data2 = _call_model(force_prompt)
        if data2 and data2.get("optimized_code", "").strip() != user_input.source_code.strip():
            data = data2
            optimized = data.get("optimized_code", optimized)

    return OptimizationResult(
        optimized_code=optimized,
        changes_made=data.get("changes_made", []),
        expected_improvement=data.get("expected_improvement", "No improvement estimated."),
    )
