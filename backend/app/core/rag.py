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


async def find_referenced_document(
    query: str,
    user_id: int,
    document_ids: list[str] | None = None,
) -> str | None:
    """
    Check if the query references a specific document by name.
    document_ids: if provided, only checks those documents (conversation scope).
    Returns document_id if match found, None otherwise.
    """
    if document_ids is not None and len(document_ids) == 0:
        return None

    if document_ids:
        docs = await postgres.fetch_all(
            """SELECT document_id, filename FROM documents
               WHERE document_id = ANY($1)
               AND user_id = $2
               AND processing_status = 'complete'""",
            document_ids,
            user_id,
        )
    else:
        docs = await postgres.fetch_all(
            """SELECT document_id, filename FROM documents
               WHERE user_id = $1
               AND processing_status = 'complete'""",
            user_id,
        )

    if not docs:
        return None

    query_lower = query.lower()
    query_words = set(query_lower.split())
    best_match = None
    best_score = 0

    for doc in docs:
        normalized = normalize_filename(doc["filename"] or "")
        if not normalized:
            continue
        if not query_words & set(normalized.split()):
            continue
        score = fuzz.partial_ratio(normalized, query_lower)
        if score > 80 and score > best_score:
            best_score = score
            best_match = doc["document_id"]

    return best_match


async def retrieve(
    query: str,
    user_id: int,
    document_ids: list[str] | None = None,
    top_k: int | None = None,
    search_all: bool = False,
) -> list[dict]:
    if top_k is None:
        top_k = get_settings().rag_top_k

    doc_ids = document_ids or []

    # No documents attached and not explicitly searching everything — skip RAG
    if not doc_ids and not search_all:
        return []

    try:
        vector = await embed_text(query)

        if doc_ids:
            referenced_id = await find_referenced_document(query, user_id, document_ids=doc_ids)
            if referenced_id:
                search_filter = {
                    "must": [
                        {"key": "user_id", "match": {"value": user_id}},
                        {"key": "document_id", "match": {"value": referenced_id}},
                    ]
                }
            elif len(doc_ids) == 1:
                search_filter = {
                    "must": [
                        {"key": "user_id", "match": {"value": user_id}},
                        {"key": "document_id", "match": {"value": doc_ids[0]}},
                    ]
                }
            else:
                search_filter = {
                    "must": [
                        {"key": "user_id", "match": {"value": user_id}},
                        {"key": "document_id", "match": {"any": doc_ids}},
                    ]
                }
        else:
            # search_all=True, no document scope — still scope to user
            search_filter = {
                "must": [
                    {"key": "user_id", "match": {"value": user_id}},
                ]
            }

        hits = await qdrant.search(vector, top_k=top_k, filters=search_filter)

        if not hits:
            return []

        # Batch fetch text from Postgres, preserving Qdrant rank order
        chunk_ids = [h.get("payload", {}).get("chunk_id") for h in hits]
        rows = await postgres.fetch_all(
            """SELECT dc.chunk_id, dc.text, d.filename, dc.chunk_index, dc.document_id
               FROM document_chunks dc
               JOIN documents d ON dc.document_id = d.document_id
               WHERE dc.chunk_id = ANY($1)
               ORDER BY array_position($1::text[], dc.chunk_id)""",
            chunk_ids,
        )

        chunk_map = {row["chunk_id"]: row for row in rows}
        sources = []
        for h in hits:
            cid = h.get("payload", {}).get("chunk_id")
            row = chunk_map.get(cid)
            if not row:
                continue
            score = round(h.get("score", 0.0), 3)
            if score < get_settings().rag_threshold:
                continue
            sources.append({
                "chunk_id": cid,
                "text": row["text"],
                "filename": row["filename"],
                "chunk_index": row["chunk_index"],
                "document_id": row["document_id"],
                "score": score,
            })

        logger.debug("[rag] retrieved {} chunks for query: {!r}", len(sources), query[:60])
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
