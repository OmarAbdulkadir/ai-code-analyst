"""
RAG Retriever — ChromaDB read/write for the self-learning knowledge base.

Responsibilities:
- Save successful optimization triplets to ChromaDB
- Search for similar past fixes when new code is submitted
- Return top-N matches as RAGContext for prompt injection
"""

import hashlib
from typing import List

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
        metadata={"hnsw:space": "cosine"},
    )
    return collection


def _make_document_id(original_code: str) -> str:
    """Stable unique ID based on code content."""
    return hashlib.sha256(original_code.encode()).hexdigest()[:16]


def _embed_text(text: str) -> List[float]:
    """
    Generate embedding using sentence-transformers (local, no API needed).
    Uses all-MiniLM-L6-v2 — small, fast, cached after first download.
    """
    from sentence_transformers import SentenceTransformer
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
        embedding = _embed_text(original_code[:1000])

        metadata = {
            "optimized_code": optimized_code[:2000],
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
            # Convert to similarity: 1 - (distance / 2)
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
            f"(similarity >= {min_similarity})."
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
