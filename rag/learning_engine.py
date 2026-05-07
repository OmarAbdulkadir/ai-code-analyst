"""
Learning Engine — decides when to save a result to the RAG knowledge base.

Trigger condition:
  - ValidationResult.status == APPROVED
  - speedup_percentage > 10.0  (meaningful improvement, not noise)
"""

from core.schemas import ValidationResult, ValidationStatus, BugReport
from rag.retriever import save_optimization


def trigger_learning_event(
    original_code: str,
    optimized_code: str,
    validation_result: ValidationResult,
    bug_report: BugReport | None = None,
) -> bool:
    """
    Call this after every validation.
    Returns True if a learning event was triggered and saved, False otherwise.
    """
    # Gate 1: Must be approved
    if validation_result.status != ValidationStatus.APPROVED:
        return False

    # Gate 2: Speedup must be meaningful (> 10%)
    speedup = validation_result.speedup_percentage or 0.0
    if speedup <= 10.0:
        print(f"[RAG] Learning skipped — speedup {speedup:.1f}% not significant enough (need > 10%)")
        return False

    # Extract bug types from bug report if available
    bug_types = []
    if bug_report and bug_report.bugs:
        bug_types = [
            getattr(bug, "bug_type", "") or getattr(bug, "type", "") or "unknown"
            for bug in bug_report.bugs
        ]
        bug_types = [b for b in bug_types if b]

    saved = save_optimization(
        original_code=original_code,
        optimized_code=optimized_code,
        validation_result=validation_result,
        bug_types_fixed=bug_types,
    )

    if saved:
        print(f"[RAG] Learning event saved — speedup {speedup:.1f}%, "
              f"{len(bug_types)} bug type(s) indexed.")
    return saved
