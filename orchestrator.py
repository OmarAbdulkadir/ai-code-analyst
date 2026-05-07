"""
Orchestrator — Main Pipeline Controller
========================================
Author: Asaad (System Architect)

This is the brain of the system. It takes user code and runs it through
all 4 agents in sequence:

    User Code → Bug Detector → Performance Analyzer → Optimizer → Validator → Final Report

Each agent is called as a function that takes specific input and returns
a Pydantic model (defined in core/schemas.py).
"""

import time
from core.schemas import (
    UserInput,
    BugReport,
    PerformanceReport,
    OptimizationResult,
    ValidationResult,
    ValidationStatus,
    FinalReport,
)

# Import agents — each teammate implements their own
from agents.bug_detector import detect_bugs
from agents.performance_analyzer import analyze_performance
from agents.optimizer import optimize_code
from agents.validator import validate_optimization


class Orchestrator:
    """
    Runs the full analysis pipeline.
    
    Usage:
        orch = Orchestrator()
        report = orch.run("def slow_func(): ...")
    """

    def run(self, source_code: str, description: str = None) -> FinalReport:
        """
        Execute the full 4-agent pipeline.
        
        Args:
            source_code: Python code string to analyze
            description: Optional description of what the code does
            
        Returns:
            FinalReport with all analysis results
        """
        user_input = UserInput(
            source_code=source_code,
            description=description,
        )

        stages_completed = []

        print("=" * 60)
        print("🔍 STAGE 1: Bug Detection")
        print("=" * 60)
        try:
            bug_report: BugReport = detect_bugs(user_input)
        except Exception as e:
            print(f"   Bug detector failed: {e}")
            bug_report = BugReport(
                bug_score=0,
                bugs=[],
                summary=f"Bug detection failed: {str(e)}",
                has_critical_bugs=False,
            )
        print(f"   → Found {len(bug_report.bugs)} issues (score: {bug_report.bug_score}/100)")
        stages_completed.append("bug_detection")

        print("\n" + "=" * 60)
        print("⚡ STAGE 2: Performance Analysis")
        print("=" * 60)
        try:
            perf_report: PerformanceReport = analyze_performance(user_input)
        except Exception as e:
            print(f"   Performance analyzer failed: {e}")
            perf_report = PerformanceReport(
                summary=f"Performance analysis failed: {str(e)}",
            )
        print(f"   → Runtime: {perf_report.execution_time_ms}ms")
        print(f"   → Complexity: {perf_report.time_complexity}")
        stages_completed.append("performance_analysis")

        # ─── Self-Healing Pipeline: up to 3 attempts ────────
        strategies = [
            ("Speed Focus",        "Reduce time complexity. Use faster algorithms and data structures."),
            ("Memory Focus",       "Reduce memory usage. Minimize allocations, use generators where possible."),
            ("Conservative Focus", "Make only minimal safe changes. Preserve exact logic but fix obvious inefficiencies."),
        ]

        optimization: OptimizationResult = None
        validation: ValidationResult = None
        feedback = None

        for attempt, (strategy_name, strategy_hint) in enumerate(strategies):
            print("\n" + "=" * 60)
            print(f"🔧 STAGE 3: Optimization (Attempt {attempt + 1} — {strategy_name})")
            print("=" * 60)

            try:
                optimization = optimize_code(
                    user_input=user_input,
                    bug_report=bug_report,
                    performance_report=perf_report,
                    feedback=feedback,
                )
            except Exception as e:
                print(f"   Optimizer failed: {e}")
                optimization = OptimizationResult(
                    optimized_code=user_input.source_code,
                    changes_made=[],
                    expected_improvement=f"Optimization failed: {str(e)}",
                )
            print(f"   → Changes: {len(optimization.changes_made)}")
            print(f"   → Expected: {optimization.expected_improvement}")

            print("\n" + "=" * 60)
            print(f"✅ STAGE 4: Validation (Attempt {attempt + 1})")
            print("=" * 60)

            try:
                validation = validate_optimization(
                    original_code=user_input.source_code,
                    optimized_code=optimization.optimized_code,
                )
            except Exception as e:
                print(f"   Validator failed: {e}")
                validation = ValidationResult(
                    status=ValidationStatus.REJECTED,
                    summary=f"Validation failed: {str(e)}",
                    outputs_match=False,
                )

            print(f"   → Status: {validation.status.value}")
            if validation.speedup_percentage:
                print(f"   → Speedup: {validation.speedup_percentage:.1f}%")
            print(f"   → Outputs match: {validation.outputs_match}")

            if validation.status != ValidationStatus.REJECTED:
                break

            if attempt < len(strategies) - 1:
                next_strategy = strategies[attempt + 1]
                feedback = f"{validation.summary} Next strategy: {next_strategy[1]}"
                print(f"   → Rejected. Retrying with '{next_strategy[0]}' strategy...")
            else:
                print("   → All strategies exhausted. Could not produce a valid optimization.")

        stages_completed.append("optimization")
        stages_completed.append("validation")

        # ─── Build Final Report ──────────────────────────────

        overall_summary = self._build_summary(
            bug_report, perf_report, optimization, validation
        )

        report = FinalReport(
            source_code=source_code,
            bug_report=bug_report,
            performance_report=perf_report,
            optimization=optimization,
            validation=validation,
            optimized_code=optimization.optimized_code,
            overall_summary=overall_summary,
            stages_completed=stages_completed,
        )

        print("\n" + "=" * 60)
        print("📊 ANALYSIS COMPLETE")
        print("=" * 60)
        print(f"   {overall_summary}")

        return report

    def _build_summary(
        self,
        bug_report: BugReport,
        perf_report: PerformanceReport,
        optimization: OptimizationResult,
        validation: ValidationResult,
    ) -> str:
        """Generate a human-readable summary of the full analysis."""
        parts = []

        # Bug summary
        if bug_report.has_critical_bugs:
            parts.append(f"Found {len(bug_report.bugs)} issues including critical bugs.")
        elif bug_report.bugs:
            parts.append(f"Found {len(bug_report.bugs)} minor issues.")
        else:
            parts.append("No bugs detected.")

        # Performance summary
        if perf_report.execution_time_ms is not None:
            parts.append(f"Original runtime: {perf_report.execution_time_ms:.1f}ms ({perf_report.time_complexity}).")

        # Validation summary
        if validation.status.value == "approved" and validation.speedup_percentage:
            parts.append(
                f"Optimization approved: {validation.speedup_percentage:.1f}% faster "
                f"({validation.original_time_ms:.1f}ms → {validation.optimized_time_ms:.1f}ms)."
            )
        elif validation.status.value == "rejected":
            parts.append("Optimization rejected — optimized code did not improve or broke output.")
        else:
            parts.append("No significant performance change detected.")

        return " ".join(parts)


# ─── Quick test ──────────────────────────────────────────

if __name__ == "__main__":
    sample_code = '''
def find_duplicates(lst):
    duplicates = []
    for i in range(len(lst)):
        for j in range(i + 1, len(lst)):
            if lst[i] == lst[j] and lst[i] not in duplicates:
                duplicates.append(lst[i])
    return duplicates

# Test
print(find_duplicates(list(range(500)) + list(range(250))))
'''
    orch = Orchestrator()
    report = orch.run(sample_code)
    print("\n\nFinal report JSON:")
    print(report.model_dump_json(indent=2))
