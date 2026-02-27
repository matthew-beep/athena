import json
from rank_bm25 import BM25Okapi
from app.db import postgres

_bm25_cache: dict[str, dict] = {}  # document_id → {"chunk_ids": [...], "corpus": [...]}


# check if chunk exists in memory cache, else load and store
async def get_bm25_index(document_id: str) -> dict:
    """Load BM25 index for a document from Postgres, cache in memory."""
    if document_id not in _bm25_cache:
        row = await postgres.fetch_one(
            """SELECT chunk_ids, corpus FROM bm25_indexes WHERE document_id = $1""",
            document_id,
        )
        _bm25_cache[document_id] = {
            "chunk_ids": row["chunk_ids"] or [],
            "corpus": row["corpus"] or [],
        } if row else {
            "chunk_ids": [],
            "corpus": [],
        }

    return _bm25_cache[document_id]

def invalidate_bm25_index(document_id: str) -> None:
    """Invalidate BM25 index for a document (removes from in-memory cache if present)."""
    _bm25_cache.pop(document_id, None)

async def build_bm25_index(
    document_id: str,
    chunk_ids: list[str],
    texts: list[str]
) -> None:
    """
    Build and store BM25 index for a document.
    Called once after document ingestion completes.
    Replaces any existing index for this document.
    """
    corpus = [text.lower().split() for text in texts]

    await postgres.execute(
        """INSERT INTO bm25_indexes (document_id, chunk_ids, corpus)
           VALUES ($1, $2::jsonb, $3::jsonb)
           ON CONFLICT (document_id) DO UPDATE
           SET chunk_ids = $2, corpus = $3""",
        document_id,
        json.dumps(chunk_ids),
        json.dumps(corpus),
    )

    invalidate_bm25_index(document_id)



