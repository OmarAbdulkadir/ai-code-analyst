# MODULE 2: Self-Learning RAG System (`INTELLIGENCE.md`)

# Task file for Claude Code (Asaad only)

# Execute tasks IN ORDER. One commit per task. Do NOT skip ahead.

---

## CONTEXT

We are building a self-learning RAG (Retrieval-Augmented Generation) system using ChromaDB.

**What it does:**

1. Every time the Validator APPROVES an optimization (speedup confirmed), the system
   automatically saves the before/after code pair + metrics into a local ChromaDB database.
2. Before calling Gemini for any new analysis, the system searches this database for
   similar past fixes and includes them in the prompt — so Gemini gives better, proven answers.
3. Over time, the system gets smarter with every successful optimization.

**The Self-Learning Loop:**

```
Validator APPROVES
       ↓
Learning Event triggered
       ↓
Save triplet to ChromaDB: { original_code, optimized_code, success_metrics }
       ↓
Next user submits code
       ↓
RAG retriever searches ChromaDB for similar past fixes
       ↓
Top matches injected into Gemini prompt as "proven examples"
       ↓
Gemini gives better, grounded suggestions
```

**Files Asaad owns and will create/edit:**

- `rag/retriever.py` — ChromaDB read/write + similarity search (NEW)
- `rag/learning_engine.py` — triggers learning events after validation (NEW)
- `rag/__init__.py` — empty init file (NEW)
- `orchestrator.py` — call learning engine after validation stage
- `core/schemas.py` — add RAGContext schema
- `core/config.py` — add CHROMA_DB_PATH config variable

**Files to NOT touch:**

- `agents/bug_detector.py` (Ibro)
- `agents/optimizer.py` (Ibro)
- `core/prompts.py` (Ibro)
- `agents/performance_analyzer.py` (Omer)
- `core/code_executor.py` (Omer)
- `api/app.py` (Abdulkadir)
- `frontend/` (Abdulkadir)

---

## PREREQUISITES

Before starting, verify the full pipeline still runs:

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst
source venv/bin/activate
python3 orchestrator.py
```

Must show all 6 stages with no errors (Module 1 must be complete first).

Install ChromaDB and sentence-transformers:

```bash
pip install chromadb>=0.4.0 sentence-transformers>=2.2.0
echo "chromadb>=0.4.0" >> requirements.txt
echo "sentence-transformers>=2.2.0" >> requirements.txt
```

**Commit:** `"deps: added chromadb and sentence-transformers for RAG"`

---

## TASK 1 — Add RAGContext schema to core/schemas.py

**Time:** 20 min
**File:** `core/schemas.py`

Add this model. Place it AFTER `SecurityReport` and BEFORE `FinalReport`:

```python
class RAGMatch(BaseModel):
    original_code_snippet: str
    optimized_code_snippet: str
    speedup_percentage: float
    similarity_score: float        # 0.0 to 1.0 — how similar to current code
    bug_types_fixed: List[str] = []

class RAGContext(BaseModel):
    matches_found: int = 0
    top_matches: List[RAGMatch] = []
    retrieval_summary: str = ""    # plain English: "Found 2 similar past fixes"
```

Also update `FinalReport` to include RAG context:

```python
class FinalReport(BaseModel):
    # ADD this field (keep all existing fields unchanged):
    rag_context: Optional[RAGContext] = None
    # ... all existing fields unchanged
```

**Test:**

```bash
python3 -c "from core.schemas import RAGContext, RAGMatch, FinalReport; print('schemas OK')"
```

**Commit:** `"schemas: added RAGContext and RAGMatch models"`

---

## TASK 2 — Create rag/**init**.py and rag/retriever.py

**Time:** 1.5 hours
**Files to create:** `rag/__init__.py` and `rag/retriever.py`

First create the empty init:

```bash
mkdir -p rag
touch rag/__init__.py
```

Now create `rag/retriever.py`:

```python
"""
RAG Retriever — ChromaDB read/write for the self-learning knowledge base.

Responsibilities:
- Save successful optimization triplets to ChromaDB
- Search for similar past fixes when new code is submitted
- Return top-N matches as RAGContext for prompt injection
"""

import hashlib
from typing import List, Optional

import chromadb
from chromadb.config import Settings

from core.schemas import RAGContext, RAGMatch, ValidationResult
from core.config import CHROMA_DB_PATH

# ── ChromaDB client (persistent local storage) ───────────────────────────────

def _get_collection():
    """Returns the ChromaDB collection, creating it if it doesn't exist."""
    client = chromadb.PersistentClient(
        path=CHROMA_DB_PATH,
        settings=Settings(anonymized_telemetry=False),
    )
    collection = client.get_or_create_collection(
        name="optimization_history",
        metadata={"hnsw:space": "cosine"},   # cosine similarity
    )
    return collection


def _make_document_id(original_code: str) -> str:
    """Stable unique ID based on code content."""
    return hashlib.sha256(original_code.encode()).hexdigest()[:16]


def _embed_text(text: str) -> List[float]:
    """
    Generate embedding using sentence-transformers (local, no API needed).
    Uses a small, fast model suited for code.
    """
    from sentence_transformers import SentenceTransformer
    # Load once — sentence-transformers caches the model after first download
    model = SentenceTransformer("all-MiniLM-L6-v2")
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


# ── Write: save a successful optimization ────────────────────────────────────

def save_optimization(
    original_code: str,
    optimized_code: str,
    validation_result: ValidationResult,
    bug_types_fixed: List[str] = [],
) -> bool:
    """
    Called by the learning engine when Validator returns APPROVED.
    Saves the triplet {original, optimized, metrics} to ChromaDB.
    Returns True if saved successfully, False on error.
    """
    try:
        collection = _get_collection()

        doc_id = _make_document_id(original_code)

        # Use original code as the search document (what future queries match against)
        embedding = _embed_text(original_code[:1000])   # truncate for embedding

        metadata = {
            "optimized_code": optimized_code[:2000],    # ChromaDB metadata limit
            "speedup_percentage": float(validation_result.speedup_percentage or 0.0),
            "bug_types_fixed": ",".join(bug_types_fixed),
            "outputs_match": str(validation_result.outputs_match),
        }

        # Upsert — if same code submitted again, update instead of duplicate
        collection.upsert(
            ids=[doc_id],
            embeddings=[embedding],
            documents=[original_code[:1000]],
            metadatas=[metadata],
        )
        return True

    except Exception as e:
        print(f"[RAG] Failed to save optimization: {e}")
        return False


# ── Read: retrieve similar past fixes ────────────────────────────────────────

def retrieve_similar(
    source_code: str,
    top_k: int = 3,
    min_similarity: float = 0.5,
) -> RAGContext:
    """
    Search ChromaDB for past successful optimizations similar to source_code.
    Returns RAGContext with top matches to inject into Gemini prompts.

    min_similarity: only return matches above this cosine similarity threshold.
    """
    try:
        collection = _get_collection()

        # Check if collection has any data
        if collection.count() == 0:
            return RAGContext(
                matches_found=0,
                retrieval_summary="No past optimizations in knowledge base yet.",
            )

        embedding = _embed_text(source_code[:1000])

        results = collection.query(
            query_embeddings=[embedding],
            n_results=min(top_k, collection.count()),
            include=["documents", "metadatas", "distances"],
        )

        matches = []
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        for doc, meta, distance in zip(documents, metadatas, distances):
            # ChromaDB cosine distance: 0 = identical, 2 = opposite
            # Convert to similarity score: 1 - (distance / 2)
            similarity = 1.0 - (distance / 2.0)

            if similarity < min_similarity:
                continue

            bug_types = [
                b.strip() for b in meta.get("bug_types_fixed", "").split(",")
                if b.strip()
            ]

            matches.append(RAGMatch(
                original_code_snippet=doc[:500],
                optimized_code_snippet=meta.get("optimized_code", "")[:500],
                speedup_percentage=float(meta.get("speedup_percentage", 0.0)),
                similarity_score=round(similarity, 3),
                bug_types_fixed=bug_types,
            ))

        summary = (
            f"Found {len(matches)} similar past optimization(s) "
            f"(similarity ≥ {min_similarity})."
            if matches
            else "No sufficiently similar past optimizations found."
        )

        return RAGContext(
            matches_found=len(matches),
            top_matches=matches,
            retrieval_summary=summary,
        )

    except Exception as e:
        print(f"[RAG] Retrieval failed: {e}")
        return RAGContext(
            matches_found=0,
            retrieval_summary=f"RAG retrieval failed: {str(e)}",
        )
```

**Test:**

```python
from rag.retriever import save_optimization, retrieve_similar
from core.schemas import UserInput, ValidationResult, ValidationStatus

# Simulate a ValidationResult
vr = ValidationResult(
    status=ValidationStatus.APPROVED,
    speedup_percentage=45.0,
    outputs_match=True,
    original_execution_time_ms=200.0,
    optimized_execution_time_ms=110.0,
)

# Save a fake optimization
saved = save_optimization(
    original_code="for i in range(n):\n    for j in range(n):\n        result += i*j",
    optimized_code="result = sum(i*j for i in range(n) for j in range(n))",
    validation_result=vr,
    bug_types_fixed=["nested_loop", "inefficient_iteration"],
)
print(f"Saved: {saved}")
assert saved is True

# Retrieve it back
context = retrieve_similar("for i in range(100):\n    for j in range(100):\n        x += i+j")
print(f"Matches found: {context.matches_found}")
print(f"Summary: {context.retrieval_summary}")

print("retriever tests PASSED")
```

**Commit:** `"rag: added retriever.py with ChromaDB save and similarity search"`

---

## TASK 3 — Create rag/learning_engine.py

**Time:** 45 min
**File to create:** `rag/learning_engine.py`

This is a thin wrapper that decides WHEN to trigger a learning event.
Rule: only save to ChromaDB when Validator returns APPROVED AND speedup > 10%.

```python
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
        bug_types = [b for b in bug_types if b]  # remove empty strings

    # Save to ChromaDB
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
```

**Test:**

```python
from rag.learning_engine import trigger_learning_event
from core.schemas import ValidationResult, ValidationStatus

# Should NOT save — rejected
r1 = ValidationResult(status=ValidationStatus.REJECTED, speedup_percentage=50.0, outputs_match=False)
result = trigger_learning_event("code_a", "code_b", r1)
assert result is False, "Should not save rejected results"

# Should NOT save — speedup too low
r2 = ValidationResult(status=ValidationStatus.APPROVED, speedup_percentage=5.0, outputs_match=True)
result = trigger_learning_event("code_a", "code_b", r2)
assert result is False, "Should not save low speedup"

# SHOULD save — approved and significant speedup
r3 = ValidationResult(
    status=ValidationStatus.APPROVED,
    speedup_percentage=35.0,
    outputs_match=True,
    original_execution_time_ms=300.0,
    optimized_execution_time_ms=195.0,
)
result = trigger_learning_event(
    "for i in range(n):\n    for j in range(n):\n        x += i",
    "x = sum(i for i in range(n)) * n",
    r3,
)
assert result is True, "Should save approved significant speedup"

print("learning_engine tests PASSED")
```

**Commit:** `"rag: added learning_engine.py with trigger conditions"`

---

## TASK 4 — Wire RAG into orchestrator.py

**Time:** 1 hour
**File:** `orchestrator.py`

This task has two parts:

**Part A — Retrieve before optimization (inject context into FinalReport)**

Add imports at the top of orchestrator.py:

```python
from rag.retriever import retrieve_similar
from rag.learning_engine import trigger_learning_event
from core.schemas import RAGContext   # add to existing schemas import
```

After Stage 2 (Security Scan) and BEFORE Stage 3 (Bug Detection), add RAG retrieval:

```python
# ── RAG Retrieval (runs before agents to provide context) ────────────────────
print("  [RAG] Searching knowledge base for similar past fixes...")
try:
    rag_context = retrieve_similar(user_input.source_code, top_k=3)
    print(f"       {rag_context.retrieval_summary}")
except Exception as e:
    print(f"       RAG retrieval failed: {e}")
    rag_context = RAGContext(retrieval_summary=f"RAG unavailable: {str(e)}")
```

**Part B — Trigger learning after validation**

After Stage 6 (Validator) completes, add:

```python
# ── Learning Event (runs after validation) ───────────────────────────────────
try:
    trigger_learning_event(
        original_code=user_input.source_code,
        optimized_code=optimization_result.optimized_code,
        validation_result=validation_result,
        bug_report=bug_report,
    )
except Exception as e:
    print(f"  [RAG] Learning event error (non-critical): {e}")
```

**Part C — Add rag_context to FinalReport**

```python
final_report = FinalReport(
    rag_context=rag_context,       # ADD
    # ... all existing fields unchanged
)
```

**Test:**

```bash
python3 orchestrator.py
```

Expected output includes `[RAG]` lines showing retrieval status.
FinalReport JSON includes `rag_context` field.
After first run with an approved result, run again — should find 1 match.

**Commit:** `"orchestrator: wired RAG retrieval and learning engine into pipeline"`

---

## TASK 5 — Add CHROMA_DB_PATH to core/config.py

**Time:** 15 min
**File:** `core/config.py`

Check if `CHROMA_DB_PATH` is already defined. If not, add it:

```python
import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ADD this:
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./datasets/chroma_db")
```

Also make sure `.env` has this line (add if missing):

```
CHROMA_DB_PATH=./datasets/chroma_db
```

Create the directory if it doesn't exist:

```bash
mkdir -p datasets/chroma_db
```

Add to `.gitignore` so the database is not committed:

```bash
echo "datasets/chroma_db/" >> .gitignore
```

**Test:**

```bash
python3 -c "from core.config import CHROMA_DB_PATH; print('CHROMA_DB_PATH:', CHROMA_DB_PATH)"
```

**Commit:** `"config: added CHROMA_DB_PATH, created chroma_db directory, updated gitignore"`

---

## FINAL VERIFICATION

Run this full check after all 5 tasks are done:

```bash
cd ~/Videos/Graduation\ Project/ai-code-analyst
source venv/bin/activate

# 1. Schema check
python3 -c "from core.schemas import RAGContext, RAGMatch; print('schemas OK')"

# 2. Config check
python3 -c "from core.config import CHROMA_DB_PATH; print('config OK:', CHROMA_DB_PATH)"

# 3. Retriever check
python3 -c "from rag.retriever import retrieve_similar; r = retrieve_similar('def f(): pass'); print('retriever OK:', r.retrieval_summary)"

# 4. Learning engine check
python3 -c "from rag.learning_engine import trigger_learning_event; print('learning_engine OK')"

# 5. Full pipeline
python3 orchestrator.py
```

All must pass. Full pipeline must show `[RAG]` output lines and FinalReport
JSON must include `rag_context` with real data.

After running the pipeline TWICE with an approved result, the second run
should print: `Found 1 similar past optimization(s)`.

---

## EXPECTED NEW COMMITS (Module 2)

```
1. "deps: added chromadb and sentence-transformers for RAG"
2. "schemas: added RAGContext and RAGMatch models"
3. "rag: added retriever.py with ChromaDB save and similarity search"
4. "rag: added learning_engine.py with trigger conditions"
5. "orchestrator: wired RAG retrieval and learning engine into pipeline"
6. "config: added CHROMA_DB_PATH, created chroma_db directory, updated gitignore"
```

Total: 6 new commits.

---

## RULES FOR THIS MODULE

- ONLY edit files listed above (your files + new rag/ files)
- NEVER edit bug_detector.py, optimizer.py, performance_analyzer.py, api/app.py, or frontend/
- Run `python3 orchestrator.py` after EVERY task
- If a task fails, fix it before moving to the next
- The RAG system must NEVER crash the pipeline — all RAG calls are wrapped in try/except
- ChromaDB data lives in `datasets/chroma_db/` — never commit this folder
