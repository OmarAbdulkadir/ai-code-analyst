import json
import re
from openai import OpenAI
from core.schemas import UserInput, BugReport, PerformanceReport, OptimizationResult
from core.prompts import OPTIMIZER_PROMPT
from core.config import GEMINI_API_KEY

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=GEMINI_API_KEY,
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

    prompt = OPTIMIZER_PROMPT.format(
        source_code=user_input.source_code,
        bug_report=bug_report.model_dump_json(indent=2),
        performance_report=performance_report.model_dump_json(indent=2),
    )

    if feedback:
        prompt += f"\n\nPREVIOUS ATTEMPT FAILED: {feedback}\nAdjust your strategy accordingly."

    response = client.chat.completions.create(
        model="google/gemini-2.0-flash-lite-001",
        messages=[{"role": "user", "content": prompt}],
    )

    text = _clean_json(response.choices[0].message.content)

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Retry once with explicit instruction to return clean JSON
        retry_prompt = prompt + "\n\nIMPORTANT: Your response must be valid JSON only. No triple quotes inside string values — use single quotes or escape them."
        retry_response = client.chat.completions.create(
            model="google/gemini-2.0-flash-lite-001",
            messages=[{"role": "user", "content": retry_prompt}],
        )
        text = _clean_json(retry_response.choices[0].message.content)
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return OptimizationResult(
                optimized_code=user_input.source_code,
                changes_made=["Could not parse optimizer response. Returning original code."],
                expected_improvement="Unknown",
            )

    return OptimizationResult(
        optimized_code=data.get("optimized_code", user_input.source_code),
        changes_made=data.get("changes_made", []),
        expected_improvement=data.get("expected_improvement", "No improvement estimated."),
    )
