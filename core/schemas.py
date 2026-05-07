"""
Data Contracts (Schemas) for AI Code Analyst
=============================================
Author: Asaad (System Architect)

These Pydantic models define the EXACT shape of data passed between agents.
Every agent MUST accept and return these models. No exceptions.

Pipeline flow:
    UserInput → BugReport → PerformanceReport → OptimizationResult → ValidationResult → FinalReport
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from enum import Enum


# ─── Enums ───────────────────────────────────────────────

class Severity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class ValidationStatus(str, Enum):
    APPROVED = "approved"       # Optimized code is better
    REJECTED = "rejected"       # Optimized code is worse or broken
    UNCHANGED = "unchanged"     # No meaningful difference


# ─── User Input ──────────────────────────────────────────

class UserInput(BaseModel):
    """What the user submits through the web UI."""
    source_code: str = Field(..., description="The Python code to analyze")
    language: str = Field(default="python", description="Programming language (python only for MVP)")
    description: Optional[str] = Field(default=None, description="Optional: what the code is supposed to do")


# ─── Architect Agent Output ─────────────────────────────

class FunctionInfo(BaseModel):
    name: str
    calls: List[str] = []
    complexity: str = "unknown"


class ArchitectReport(BaseModel):
    functions_found: List[FunctionInfo] = []
    dependency_map: Dict[str, List[str]] = {}
    most_complex_function: str = ""
    total_functions: int = 0
    architecture_summary: str = ""


# ─── Security Agent Output ───────────────────────────────

class SecurityIssue(BaseModel):
    severity: str
    issue_type: str
    line_number: int = 0
    description: str
    recommendation: str


class SecurityReport(BaseModel):
    security_score: int = 100
    issues: List[SecurityIssue] = []
    has_critical_issues: bool = False
    bandit_issues_count: int = 0
    llm_issues_count: int = 0
    summary: str = ""


# ─── Bug Detector Output ────────────────────────────────

class Bug(BaseModel):
    """A single bug or issue found in the code."""
    line_number: Optional[int] = Field(default=None, description="Line where the bug is")
    severity: Severity
    category: str = Field(..., description="e.g. 'logic_error', 'runtime_error', 'bad_practice'")
    description: str = Field(..., description="What the bug is")
    suggestion: str = Field(..., description="How to fix it")


class BugReport(BaseModel):
    """Output of the Bug Detector agent."""
    bug_score: int = Field(..., ge=0, le=100, description="0 = perfect, 100 = terrible")
    bugs: list[Bug] = Field(default_factory=list)
    summary: str = Field(..., description="One-paragraph summary of code quality")
    has_critical_bugs: bool = Field(default=False)


# ─── Performance Analyzer Output ────────────────────────

class PerformanceReport(BaseModel):
    """Output of the Performance Analyzer agent."""
    execution_time_ms: Optional[float] = Field(default=None, description="Actual runtime in milliseconds")
    memory_usage_mb: Optional[float] = Field(default=None, description="Peak memory in MB")
    time_complexity: Optional[str] = Field(default=None, description="e.g. 'O(n^2)', 'O(n log n)'")
    space_complexity: Optional[str] = Field(default=None, description="e.g. 'O(n)', 'O(1)'")
    bottlenecks: list[str] = Field(default_factory=list, description="Detected slow patterns")
    executed_successfully: bool = Field(default=False)
    execution_error: Optional[str] = Field(default=None, description="Error message if code failed")
    summary: str = Field(..., description="One-paragraph performance summary")


# ─── Optimizer Output ───────────────────────────────────

class OptimizationResult(BaseModel):
    """Output of the Optimizer agent."""
    optimized_code: str = Field(..., description="The rewritten, improved code")
    changes_made: list[str] = Field(default_factory=list, description="List of what was changed and why")
    expected_improvement: str = Field(..., description="e.g. 'O(n^2) → O(n), ~90% faster'")


# ─── Validator Output ───────────────────────────────────

class ValidationResult(BaseModel):
    """Output of the Validator agent. Asaad builds this."""
    status: ValidationStatus
    original_time_ms: Optional[float] = None
    optimized_time_ms: Optional[float] = None
    speedup_percentage: Optional[float] = Field(default=None, description="e.g. 96.5 means 96.5% faster")
    original_output: Optional[str] = Field(default=None, description="stdout of original code")
    optimized_output: Optional[str] = Field(default=None, description="stdout of optimized code")
    outputs_match: bool = Field(default=False, description="Do both versions produce same result?")
    summary: str = Field(..., description="One-paragraph validation summary")


# ─── Final Report (returned to user) ───────────────────

class FinalReport(BaseModel):
    """The complete analysis report shown to the user."""
    source_code: str
    architect_report: Optional[ArchitectReport] = None
    security_report: Optional[SecurityReport] = None
    bug_report: BugReport
    performance_report: PerformanceReport
    optimization: OptimizationResult
    validation: ValidationResult
    optimized_code: str
    overall_summary: str = Field(..., description="Executive summary of the full analysis")
    stages_completed: list[str] = []
