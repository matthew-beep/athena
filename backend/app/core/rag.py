"""
RAG: embed query → search Qdrant → assemble context string.

Imported by chat.py to inject document context before every LLM call.
Returns [] gracefully when Qdrant is unavailable or the collection is empty.
"""

import httpx
from loguru import logger

from app.config import get_settings
from app.db import qdrant

RAG_BUDGET_TOKENS = 2000
RAG_TOP_K = 6


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


async def retrieve(query: str, top_k: int = RAG_TOP_K) -> list[dict]:
    """
    Embed the query, search Qdrant, return structured results.

    Each result: { text, filename, score, chunk_index, document_id }
    Returns [] gracefully if Qdrant is unavailable or the collection is empty.
    """
    try:
        vector = await embed_text(query)
        results = await qdrant.search(vector, top_k=top_k)
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
