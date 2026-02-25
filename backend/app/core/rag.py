"""
RAG: embed query → search Qdrant → assemble context string.

Imported by chat.py to inject document context before every LLM call.
Returns [] gracefully when Qdrant is unavailable or the collection is empty.
"""

import httpx
from loguru import logger

from app.config import get_settings
from app.db import qdrant, postgres
from app.core.ingestion import normalize_filename
from rapidfuzz import fuzz


RAG_BUDGET_TOKENS = 2000

# Module-level cache — lives for the lifetime of the FastAPI process
_bm25_cache: dict[str, dict] = {}


async def get_or_build_bm25(project_id: str = "default") -> dict:
    """
    Load BM25 index data for a project from Postgres (bm25_indexes table).
    Caches in memory per project_id. Returns {"chunk_ids": list[str], "corpus": list[list[str]]}
    where corpus is tokenized documents for BM25Okapi.
    """
    if project_id not in _bm25_cache:
        row = await postgres.fetch_one(
            "SELECT chunk_ids, corpus FROM bm25_indexes WHERE project_id = $1",
            project_id,
        )
        if row:
            # asyncpg returns JSONB as Python list; fallback to [] if null
            chunk_ids = row["chunk_ids"] if row["chunk_ids"] is not None else []
            corpus = row["corpus"] if row["corpus"] is not None else []
            _bm25_cache[project_id] = {"chunk_ids": chunk_ids, "corpus": corpus}
        else:
            _bm25_cache[project_id] = {"chunk_ids": [], "corpus": []}
    return _bm25_cache[project_id]

    

async def update_bm25_index(chunk_ids: list[str], texts: list[str], project_id: str = "default") -> None:
    """Append new chunks to the project's BM25 index in Postgres and invalidate cache."""
    existing = await postgres.fetch_one(
        "SELECT chunk_ids, corpus FROM bm25_indexes WHERE project_id = $1",
        project_id,
    )
    
    if existing:
        all_chunk_ids = (existing["chunk_ids"] or []) + chunk_ids
        all_corpus = (existing["corpus"] or []) + [t.lower().split() for t in texts]
    else:
        all_chunk_ids = chunk_ids
        all_corpus = [t.lower().split() for t in texts]
    
    await postgres.execute(
        """INSERT INTO bm25_indexes (project_id, chunk_ids, corpus)
           VALUES ($1, $2::jsonb, $3::jsonb)
           ON CONFLICT (project_id) DO UPDATE
           SET chunk_ids = $2::jsonb, corpus = $3::jsonb, updated_at = NOW()""",
        project_id,
        json.dumps(all_chunk_ids),
        json.dumps(all_corpus),
    )
    invalidate_bm25_cache(project_id)


def invalidate_bm25_cache(project_id: str | None = None) -> None:
    """Clear BM25 cache for one project or all. Call after updating bm25_indexes."""
    if project_id is None:
        _bm25_cache.clear()
    else:
        _bm25_cache.pop(project_id, None)

        

async def embed_text(text: str) -> list[float]:
    """Embed text using the Ollama embedding model."""
    settings = get_settings()
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{settings.ollama_base_url}/api/embeddings",
            json={"model": settings.ollama_embed_model, "prompt": text},
        )
        resp.raise_for_status()
        return resp.json()["embedding"]



# future function to find referenced documents in projects
async def find_referenced_documents(query: str, project_id: str = "") -> str | None:
    """
    Check if the user's query references a specific document by name.
    Returns document_id if found, None otherwise.
    """

    if project_id:
        docs = await postgres.fetch(
            "SELECT id, filename FROM documents WHERE project_id = $1 AND processing_status = 'complete'",
            project_id
        )
    else:
        docs = await postgres.fetch(
            "SELECT id, filename FROM documents WHERE processing_status = 'complete'",
        )
    
    best_match = None
    best_score = 0

    query_lower = query.lower()
    for doc in docs:
        normalized = normalize_filename(doc["filename"])
        score = fuzz.partial_ratio(normalized, query_lower)
        if score > 80 and score > best_score:
            best_match = doc["id"]
            best_score = score

    return best_match

async def retrieve(query: str, top_k: int | None = None, scope: str = "global") -> list[dict]:
    """
    Embed the query, search Qdrant, return structured results.

    Each result: { text, filename, score, chunk_index, document_id }
    Returns [] gracefully if Qdrant is unavailable or the collection is empty.
    """
    if top_k is None:
        top_k = get_settings().rag_top_k
    try:
        vector = await embed_text(query)

        document_id = await find_referenced_documents(query)
        if doc_id:
            search_filter = Filter(
                must=[FieldCondition(key="document_id", match=MatchValue(value=doc_id))]
            )
        else:
            search_filter = None


        results = await qdrant.search(vector, top_k=top_k, filter=search_filter)
        sources = []
        for r in results:
            payload = r.get("payload", {})
            sources.append({
                "text": payload.get("text", ""),
                "filename": payload.get("metadata", {}).get("filename", "unknown"),
                "score": round(r.get("score", 0.0), 3),
                "chunk_index": payload.get("chunk_index", 0),
                "document_id": payload.get("document_id", ""),
            })
        logger.debug("[rag] retrieved {} chunks for query: {!r}", len(sources), query[:60])

        if all(source["score"] < get_settings().rag_threshold for source in sources):
            return []

        return sources
    except Exception as e:
        logger.warning("[rag] retrieval failed — falling back to no context: {}", e)
        return []


def format_rag_context(sources: list[dict], token_budget: int = RAG_BUDGET_TOKENS) -> str:
    """
    Format retrieved chunks into a context string for injection into the system prompt.
    Trims greedily to stay within approximately token_budget (4 chars ≈ 1 token).
    Returns "" if sources is empty.
    """
    if not sources:
        return ""

    header = "Relevant information from the user's documents:\n"
    char_budget = token_budget * 4
    used = len(header)
    snippets: list[str] = []

    for src in sources:
        snippet = f'\n[Source: {src["filename"]}]\n{src["text"]}\n'
        if used + len(snippet) > char_budget:
            break
        snippets.append(snippet)
        used += len(snippet)

    if not snippets:
        return ""

    return header + "".join(snippets)
