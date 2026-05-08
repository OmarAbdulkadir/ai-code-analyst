# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend

```bash
# Activate the virtual environment first
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server (http://localhost:8000)
python main.py

# Run all tests
python -m pytest tests/ -v

# Run a single test file
python -m pytest tests/test_pipeline.py -v

# Run a single test by name
python -m pytest tests/test_pipeline.py::TestValidator::test_validator_approves_faster_code -v

# Run the security tests standalone
python tests/test_pipeline.py

# Build the Docker sandbox image (required before validation works)
docker build -t code-sandbox .
```

### Frontend (React app in `/frontend`)

```bash
cd frontend
npm install
npm run dev       # dev server on http://localhost:5173
npm run build     # production build
npm run lint      # ESLint check
```

## Architecture

This is a 4-agent AI pipeline that analyzes Python code for bugs and performance issues, optimizes it, then **proves** the improvement via sandboxed execution.

### Pipeline Flow

```
POST /analyze  →  Orchestrator.run()
    │
    ├── Stage 1: agents/bug_detector.py       → BugReport
    ├── Stage 2: agents/performance_analyzer.py → PerformanceReport
    ├── Stage 3: agents/optimizer.py           → OptimizationResult
    └── Stage 4: agents/validator.py           → ValidationResult
                                                    └── FinalReport (returned to frontend)
```

The `orchestrator.py` at the project root (not `agents/orchestrator.py`) is what `web/app.py` imports. Each stage is wrapped in a try/except that returns a safe fallback so the pipeline never crashes entirely — `stages_completed` on `FinalReport` tracks which stages ran.

### Key Architectural Decisions

**LLM calls use OpenRouter, not Gemini directly.** All agents instantiate an `openai.OpenAI` client pointing at `https://openrouter.ai/api/v1`, using `GEMINI_API_KEY` as the OpenRouter API key. The model used is `google/gemini-2.0-flash-lite-001`.

**Code execution is Docker-sandboxed.** `core/code_executor.py` runs user code inside a `code-sandbox` Docker container (built from the root `Dockerfile`) with no network, capped CPU (0.5 cores), and capped memory (default 128 MB). This is what makes validation meaningful. The sandbox image is `python:3.11-slim` with common scientific packages pre-installed.

**Pydantic schemas are the data contracts.** All inter-agent data is typed in `core/schemas.py`. Every agent function signature uses these models — do not change a schema without updating all consuming agents.

**The validator runs code 3 times each and averages timing.** A 5% speedup threshold triggers `APPROVED`; slower than −5% triggers `REJECTED`. Output comparison normalizes floats, sorted collections, and whitespace before comparing.

### Module Map

| Path                             | Responsibility                                                      |
| -------------------------------- | ------------------------------------------------------------------- |
| `orchestrator.py`                | Root-level pipeline controller — imported by `web/app.py`           |
| `web/app.py`                     | FastAPI app with `/analyze` endpoint and CORS                       |
| `main.py`                        | Uvicorn entry point — reads `HOST`/`PORT` from `core/config.py`     |
| `core/schemas.py`                | All Pydantic models (single source of truth for data shapes)        |
| `core/config.py`                 | All env vars loaded from `.env` via `python-dotenv`                 |
| `core/code_executor.py`          | Docker sandbox wrapper — used by validator and performance analyzer |
| `core/metrics.py`                | AST-based complexity analysis + timing/memory via sandbox           |
| `core/prompts.py`                | All LLM prompt templates (centralized for easy iteration)           |
| `agents/bug_detector.py`         | Calls Gemini via OpenRouter, parses JSON response                   |
| `agents/performance_analyzer.py` | Sandbox execution + AST analysis + Gemini summary                   |
| `agents/optimizer.py`            | Calls Gemini with bug + perf context, retries once on bad JSON      |
| `agents/validator.py`            | Runs both code versions in sandbox, compares outputs + timing       |
| `rag/`                           | ChromaDB RAG pipeline — currently a stub, not wired into agents     |
| `frontend/`                      | React + Vite showcase app (the main user-facing UI)                 |
| `src/`                           | Legacy landing page components at root — separate from `frontend/`  |

### Environment Setup

Copy `.env.example` to `.env` and set:

- `GEMINI_API_KEY` — your OpenRouter API key (despite the name, it's used with OpenRouter)
- Other vars have sensible defaults; see `core/config.py` for all options

### Two Frontends

There are two separate React setups:

- `frontend/` — the active showcase/demo app (use this for UI work)
- `src/` at project root — a legacy landing page with its own `vite.config.js`; do not confuse the two

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:

- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
