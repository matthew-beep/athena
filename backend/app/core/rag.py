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
from app.core.bm25 import get_bm25_index
from rank_bm25 import BM25Okapi
import asyncio


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

async def _bm_25_search(    
    query: str,
    document_ids: list[str],
    top_k: int = 20,
) -> list[tuple[str, float]]:
    """
    Run BM25 keyword search across a set of documents.
    Merges per-document indexes at search time — only scores chunks
    from the provided document_ids, never the full knowledge base.
    Returns list of (chunk_id, score) tuples sorted by score descending.
    """

    if not document_ids:
        return []

    # Load and merge indexes for all documents in scope
    all_chunk_ids: list[str] = []
    all_corpus: list[list[str]] = []

    for doc_id in document_ids:
        index = await get_bm25_index(doc_id)
        all_chunk_ids.extend(index["chunk_ids"])
        all_corpus.extend(index["corpus"])

    if not all_corpus:
        return []

    # Run BM25 search against documents and user query
    bm25 = BM25Okapi(all_corpus)
    scores = bm25.get_scores(query.lower().split())

    results = [
        (chunk_id, float(score))
        for chunk_id, score in zip(all_chunk_ids, scores)
        if score > 0
    ]

    return sorted(results, key=lambda x: x[1], reverse=True)[:top_k]


def reciprocal_rank_fusion(
    vector_hits: list,
    bm25_hits: list[tuple[str, float]],
    k: int = 60
) -> list[str]:
    """
    Merge vector and BM25 result lists using Reciprocal Rank Fusion.
    Returns chunk_ids ordered by combined RRF score.
    k=60 is the standard constant — prevents top results from dominating.
    """

    scores: dict[str, float] = {}

    for rank, hit in enumerate(vector_hits):
        chunk_id = hit.get("payload", {}).get("chunk_id")
        if not chunk_id:
            continue
        scores[chunk_id] = scores.get(chunk_id, 0) + 1 / (k + rank + 1)

    
    for rank, (chunk_id, _) in enumerate(bm25_hits):
        scores[chunk_id] = scores.get(chunk_id, 0) + 1 / (k + rank + 1)

    return [
        chunk_id
        for chunk_id, _ in sorted(scores.items(), key=lambda x: x[1], reverse=True)
    ]



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
            search_ids = [referenced_id] if referenced_id else doc_ids

            if len(search_ids) == 1:
                search_filter = {
                    "must": [
                        {"key": "user_id", "match": {"value": user_id}},
                        {"key": "document_id", "match": {"value": search_ids[0]}},
                    ]
                }
            else:
                search_filter = {
                    "must": [
                        {"key": "user_id", "match": {"value": user_id}},
                        {"key": "document_id", "match": {"any": search_ids}},
                    ]
                }
        else:
            # search_all=True — scope to user only
            search_ids = []
            search_filter = {
                "must": [
                    {"key": "user_id", "match": {"value": user_id}},
                ]
            }

        if search_ids:
            vector_hits, bm25_hits = await asyncio.gather(
                qdrant.search(vector, top_k=top_k * 3, filters=search_filter),
                _bm_25_search(query, search_ids, top_k=top_k * 3),
            )
            ranked_ids = reciprocal_rank_fusion(vector_hits, bm25_hits)[:top_k]
        else:
            # search_all — no doc_ids so skip BM25, pure vector
            vector_hits = await qdrant.search(vector, top_k=top_k, filters=search_filter)
            ranked_ids = [h.get("payload", {}).get("chunk_id") for h in vector_hits]

        if not ranked_ids:
            return []

        rows = await postgres.fetch_all(
            """SELECT dc.chunk_id, dc.text, d.filename, dc.chunk_index, dc.document_id
               FROM document_chunks dc
               JOIN documents d ON dc.document_id = d.document_id
               WHERE dc.chunk_id = ANY($1)
                 AND d.user_id = $2
               ORDER BY array_position($1::text[], dc.chunk_id)""",
            ranked_ids,
            user_id,
        )

        chunk_map = {row["chunk_id"]: row for row in rows}
        sources = []
        for chunk_id in ranked_ids:
            row = chunk_map.get(chunk_id)
            if not row:
                continue
            sources.append({
                "chunk_id": chunk_id,
                "text": row["text"],
                "filename": row["filename"],
                "chunk_index": row["chunk_index"],
                "document_id": row["document_id"],
                "score": 0.0,  # RRF doesn't produce a meaningful score to show
            })

        logger.debug("[rag] retrieved {} chunks for query: {!r}", len(sources), query[:60])
        return sources

    except Exception as e:
        logger.warning("[rag] retrieval failed — falling back to no context: {}", e)
        return []


def format_rag_context(sources: list[dict], token_budget: int = RAG_BUDGET_TOKENS) -> str:
    """
    Format retrieved chunks into a context string for injection into the system prompt.
    Each block is numbered [1], [2], ... so the model can cite sources. Order matches
    rag_sources sent to the frontend. Trims greedily to stay within approximately
    token_budget (4 chars ≈ 1 token). Returns "" if sources is empty.
    """
    if not sources:
        return ""

    header = "Relevant information from the user's documents (cite as [1], [2], ...):\n\n"
    char_budget = token_budget * 4
    used = len(header)
    snippets: list[str] = []

    for n, src in enumerate(sources, start=1):
        snippet = f'[{n}] [Source: {src["filename"]}]\n{src["text"]}\n\n'
        if used + len(snippet) > char_budget:
            break
        snippets.append(snippet)
        used += len(snippet)

    if not snippets:
        return ""

    return header + "".join(snippets)
