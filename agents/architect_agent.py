import ast
import json
import re
from typing import Dict, List

from core.schemas import ArchitectReport, FunctionInfo, UserInput
from core.config import OPENAI_API_KEY

from openai import OpenAI

client = OpenAI(
    api_key=OPENAI_API_KEY,
)
MODEL = "gpt-4o-mini"


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
                if isinstance(child.func, ast.Name):
                    if child.func.id in all_functions and child.func.id != node.name:
                        calls.append(child.func.id)
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


def analyze_architecture(user_input: UserInput) -> ArchitectReport:
    """
    Main function called by orchestrator.
    Returns ArchitectReport with function map and summary.
    """
    source_code = user_input.source_code

    dependency_map = _extract_functions(source_code)

    functions_found = []
    for func_name, calls in dependency_map.items():
        complexity = _estimate_complexity(source_code, func_name)
        functions_found.append(FunctionInfo(
            name=func_name,
            calls=calls,
            complexity=complexity,
        ))

    most_complex = ""
    if functions_found:
        order = {"high": 3, "medium": 2, "low": 1, "unknown": 0}
        most_complex = max(functions_found, key=lambda f: order.get(f.complexity, 0)).name

    summary = _get_architecture_summary(source_code, dependency_map)

    return ArchitectReport(
        functions_found=functions_found,
        dependency_map=dependency_map,
        most_complex_function=most_complex,
        total_functions=len(functions_found),
        architecture_summary=summary,
    )
