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


OPTIMIZER_PROMPT = """You are an expert Python performance engineer. Your primary mission is to eliminate every O(n²) or worse algorithm and replace it with an O(n) or O(n log n) equivalent.

MANDATORY ALGORITHMIC TRANSFORMATIONS — apply every one that appears in the code:
- Nested loop duplicate detection → seen = set(); duplicates = set()
- Nested loop pair counting → Counter or defaultdict grouping
- `x in list` inside a loop → convert list to set first, then O(1) lookup
- String concatenation in loop (s = s + ...) → collect in list[], then ''.join()
- Multiple separate passes over same data → single pass with min/max/sum builtins
- Bubble sort / insertion sort → sorted() or list.sort()
- O(n×k) scanning each group separately → single-pass defaultdict accumulation
- Max subarray O(n²) → Kadane's algorithm O(n)
- Two-sum O(n²) → set-based O(n) lookup

ABSOLUTELY FORBIDDEN:
- Keeping any nested for-loop that is O(n²) or worse — rewrite it
- Using list.append() for membership checking inside a loop — use set
- Leaving multiple passes where a single pass suffices
- Changing any sort key: if original sorts by x[1], use key=lambda x: x[1] — NEVER drop the key

CORRECTNESS RULES (non-negotiable):
1. The optimized code MUST produce BYTE-FOR-BYTE IDENTICAL stdout output to the original
2. Keep every function name and signature exactly the same
3. Keep ALL print() statements unchanged — do not add, remove, or reorder them
4. Only add imports from Python stdlib (collections, itertools, math, heapq, etc.)
5. Fix every security issue and bug listed below
6. When replacing a sort, ALWAYS use the same comparison key as the original code

Original code:
{original_code}

Security issues: {security_issues}
Bug report: {bug_summary}
Performance bottlenecks: {performance_bottlenecks}

Return ONLY valid JSON — no markdown, no code blocks, no explanation:
{{
  "optimized_code": "<complete working Python code as a single string>",
  "changes_made": [
    "<specific algorithmic change 1>",
    "<specific algorithmic change 2>"
  ],
  "expected_improvement": "<estimated speedup and complexity reduction>"
}}
"""
