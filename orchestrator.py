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
from typing import Optional, Callable
from core.schemas import (
    UserInput,
    BugReport,
    PerformanceReport,
    OptimizationResult,
    ValidationResult,
    ValidationStatus,
    FinalReport,
    ArchitectReport,
    SecurityReport,
    RAGContext,
)
from rag.retriever import retrieve_similar
from rag.learning_engine import trigger_learning_event

# Import agents — each teammate implements their own
from agents.architect_agent import analyze_architecture
from agents.security_agent import scan_security
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

    def _emit_log(self, message: str, on_log: Optional[Callable] = None):
        """Emit a log line to the callback (for streaming) and to stdout."""
        print(f"[Pipeline] {message}")
        if on_log:
            try:
                on_log(message)
            except Exception:
                pass

    def run(self, source_code: str, description: str = None,
            on_log: Optional[Callable] = None) -> FinalReport:
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
        print("🏗️  STAGE 1: Architecture Analysis")
        print("=" * 60)
        self._emit_log("Stage 1/6: Architect Agent — AST analysis starting", on_log)
        try:
            architect_report: ArchitectReport = analyze_architecture(user_input)
            print(f"   → Found {architect_report.total_functions} functions. Most complex: {architect_report.most_complex_function}")
        except Exception as e:
            print(f"   Architect Agent failed: {e}")
            architect_report = ArchitectReport(
                architecture_summary=f"Architecture analysis failed: {str(e)}"
            )
        stages_completed.append("architecture_analysis")
        self._emit_log("Stage 1/6: Architect Agent — complete", on_log)

        print("\n" + "=" * 60)
        print("🔐 STAGE 2: Security Scan")
        print("=" * 60)
        self._emit_log("Stage 2/6: Security Agent — scanning for vulnerabilities", on_log)
        try:
            security_report: SecurityReport = scan_security(user_input, architect_report)
            print(f"   → Security score: {security_report.security_score}/100. Issues: {len(security_report.issues)}")
        except Exception as e:
            print(f"   Security Agent failed: {e}")
            security_report = SecurityReport(
                security_score=100,
                summary=f"Security scan failed: {str(e)}"
            )
        stages_completed.append("security_scan")
        self._emit_log("Stage 2/6: Security Agent — complete", on_log)

        # ── RAG Retrieval (runs before agents to provide context) ────────────
        print("  [RAG] Searching knowledge base for similar past fixes...")
        try:
            rag_context = retrieve_similar(user_input.source_code, top_k=3)
            print(f"       {rag_context.retrieval_summary}")
        except Exception as e:
            print(f"       RAG retrieval failed: {e}")
            rag_context = RAGContext(retrieval_summary=f"RAG unavailable: {str(e)}")

        print("\n" + "=" * 60)
        print("🔍 STAGE 3: Bug Detection")
        print("=" * 60)
        self._emit_log("Stage 3/6: Bug Detector — Gemini analysis starting", on_log)
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
        self._emit_log("Stage 3/6: Bug Detector — complete", on_log)

        print("\n" + "=" * 60)
        print("⚡ STAGE 4: Performance Analysis")
        print("=" * 60)
        self._emit_log("Stage 4/6: Performance Analyzer — executing code + measuring", on_log)
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
        self._emit_log("Stage 4/6: Performance Analyzer — complete", on_log)

        print("\n" + "=" * 60)
        print("🔧 STAGE 5: Optimization")
        print("=" * 60)
        self._emit_log("Stage 5/6: Optimizer — generating optimized code via Gemini", on_log)
        try:
            optimization: OptimizationResult = optimize_code(
                user_input=user_input,
                bug_report=bug_report,
                performance_report=perf_report,
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
        stages_completed.append("optimization")
        self._emit_log("Stage 5/6: Optimizer — complete", on_log)

        print("\n" + "=" * 60)
        print("✅ STAGE 6: Validation")
        print("=" * 60)
        self._emit_log("Stage 6/6: Validator — running both code versions for comparison", on_log)
        baseline_resources = None
        optimized_resources = None
        try:
            validator_output = validate_optimization(
                original_code=user_input.source_code,
                optimized_code=optimization.optimized_code,
            )
            if isinstance(validator_output, dict):
                validation = validator_output["validation"]
                baseline_resources = validator_output.get("baseline_resources")
                optimized_resources = validator_output.get("optimized_resources")
                exec_stdout = getattr(validation, "original_output", None)
                if exec_stdout and on_log:
                    for line in exec_stdout.splitlines():
                        self._emit_log(f"[Sandbox stdout] {line}", on_log)
            else:
                validation = validator_output
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
        stages_completed.append("validation")
        self._emit_log("Stage 6/6: Validator — complete", on_log)

        # ── Learning Event (runs after validation) ───────────────────────────
        try:
            trigger_learning_event(
                original_code=user_input.source_code,
                optimized_code=optimization.optimized_code,
                validation_result=validation,
                bug_report=bug_report,
            )
        except Exception as e:
            print(f"  [RAG] Learning event error (non-critical): {e}")

        # ─── Build Final Report ──────────────────────────────

        overall_summary = self._build_summary(
            bug_report, perf_report, optimization, validation
        )

        report = FinalReport(
            source_code=source_code,
            architect_report=architect_report,
            security_report=security_report,
            rag_context=rag_context,
            bug_report=bug_report,
            performance_report=perf_report,
            optimization=optimization,
            validation=validation,
            optimized_code=optimization.optimized_code,
            overall_summary=overall_summary,
            stages_completed=stages_completed,
        )

        # Attach DNA fingerprints
        try:
            report.baseline_dna = self._compute_dna(
                bug_report, perf_report, validation, label="Baseline", is_optimized=False
            )
            report.optimized_dna = self._compute_dna(
                bug_report, perf_report, validation, label="Optimized", is_optimized=True
            )
        except Exception as e:
            print(f"[Orchestrator] DNA computation skipped: {e}")

        # Attach resource timelines
        report.baseline_resources = baseline_resources
        report.optimized_resources = optimized_resources

        self._emit_log("Pipeline complete — Final report ready", on_log)

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

    def _compute_dna(
        self,
        bug_report,
        perf_report,
        validation_result,
        label: str,
        is_optimized: bool = False
    ):
        from core.schemas import CodeDNAFingerprint
        import math

        complexity_map = {"O(1)": 95, "O(log n)": 88, "O(n)": 75,
                          "O(n log n)": 60, "O(n^2)": 35, "O(n^3)": 15}
        complexity = float(complexity_map.get(
            getattr(perf_report, "time_complexity", "O(n)"), 60
        ))

        security = max(0.0, 100.0 - float(bug_report.bug_score) * 0.5)
        if bug_report.has_critical_bugs:
            security = min(security, 40.0)

        t = getattr(perf_report, "execution_time_ms", 1000.0) or 1000.0
        performance = max(0.0, min(100.0, 100.0 - (t / 50.0)))

        readability = 70.0

        bug_density = max(0.0, 100.0 - float(bug_report.bug_score))

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
