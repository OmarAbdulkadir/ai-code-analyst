"""
Prompt Templates
=================
Owner: Ibro
Status: STUB — fill with real prompts for each agent.

All Gemini prompts live here. Centralized so we can iterate on them
without touching agent logic.
"""


BUG_DETECTOR_PROMPT = """You are a senior Python code reviewer.
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
{source_code}
"""


PERFORMANCE_ANALYZER_PROMPT = """
You are a performance analysis expert. Analyze this Python code and identify:
1. Time complexity (Big O notation)
2. Space complexity
3. Performance bottlenecks (nested loops, repeated allocations, etc.)

Return ONLY valid JSON with:
- time_complexity: string like "O(n^2)"
- space_complexity: string like "O(n)"  
- bottlenecks: list of strings describing slow patterns

Code to analyze:
```python
{source_code}
```
"""


OPTIMIZER_PROMPT = """
You are an expert Python optimizer. Given the original code, the bug report,
and the performance analysis, rewrite the code to be:
1. Faster (better time complexity if possible)
2. Cleaner (fix bugs found)
3. Correct (MUST produce the same output as the original)

Bug Report:
{bug_report}

Performance Report:
{performance_report}

Return ONLY valid JSON with:
- optimized_code: the complete rewritten Python code (string)
- changes_made: list of strings explaining each change
- expected_improvement: string like "O(n^2) → O(n), ~90% faster"

CRITICAL: The optimized code MUST produce IDENTICAL output to the original.
CRITICAL: Keep ALL print() statements from the original code. Do not remove them.

Original code:
```python
{source_code}
```
"""
