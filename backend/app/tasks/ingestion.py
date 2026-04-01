"""
Celery tasks for document ingestion.

These are synchronous wrappers around the async ingestion pipeline.
Celery tasks must be sync functions — asyncio.run() bridges the gap.

Progress tracking is done via Redis (db/redis.py sync client). FastAPI routes
read progress from Redis using the async client.
"""
import asyncio
import base64
import hashlib
from datetime import datetime, timezone
from io import BytesIO

import httpx
from loguru import logger

from app.celery_app import celery_app
from app.config import get_settings
from app.core.ingestion import chunk_text, extract_text, normalize_filename
from app.core.crawler import fetch_url
from app.db import postgres, qdrant
from app.db import redis as redis_store


def _chunk_id_to_qdrant_id(chunk_id: str) -> int:
    """Deterministic uint64 Qdrant point ID derived from chunk_id."""
    return int.from_bytes(hashlib.sha256(chunk_id.encode()).digest()[:8], "big")


async def _embed(client: httpx.AsyncClient, text: str) -> list[float]:
    settings = get_settings()
    resp = await client.post(
        f"{settings.ollama_base_url}/api/embeddings",
        json={"model": settings.ollama_embed_model, "prompt": text},
        timeout=60.0,
    )
    if not resp.is_success:
        logger.error("Ollama embed error {}: {}", resp.status_code, resp.text)
        resp.raise_for_status()
    return resp.json()["embedding"]


# ── Async pipeline implementations ────────────────────────────────────────────
# These contain the actual logic. The @celery_app.task functions below are thin
# sync wrappers that call asyncio.run() to enter the async world.

async def _ingest_file(document_id: str, body: bytes, mime: str, filename: str, file_type: str, user_id: int) -> None:
    try:
        # 1. Extract
        redis_store.set_progress(document_id, "extracting", 0, 0)
        await postgres.execute(
            "UPDATE documents SET processing_status='processing' WHERE document_id=$1",
            document_id,
        )
        text, error = await asyncio.to_thread(extract_text, BytesIO(body), mime, filename)
        normalized_filename = normalize_filename(filename)

        if error:
            redis_store.delete_progress(document_id)
            await postgres.execute(
                "UPDATE documents SET processing_status='error', error_message=$1 WHERE document_id=$2",
                error, document_id,
            )
            logger.warning("Extraction failed for {}: {}", document_id, error)
            return

        # 2. Chunk
        redis_store.set_progress(document_id, "chunking", 0, 0)
        chunks = chunk_text(text)
        word_count = len(text.split())

        if not chunks:
            redis_store.delete_progress(document_id)
            await postgres.execute(
                "UPDATE documents SET processing_status='error', error_message='No content to chunk' WHERE document_id=$1",
                document_id,
            )
            return

        total = len(chunks)
        logger.info("Document {}: {} words → {} chunks", document_id, word_count, total)

        # 3. Embed + store chunks
        redis_store.set_progress(document_id, "embedding", 0, total)
        qdrant_points = []
        async with httpx.AsyncClient() as client:
            for chunk in chunks:
                i = chunk["chunk_index"]
                chunk_id = f"{document_id}_chunk_{i}"

                embedding = await _embed(client, chunk["text"])

                await postgres.execute(
                    """INSERT INTO document_chunks
                           (chunk_id, document_id, chunk_index, text, token_count, qdrant_point_id, user_id, filename_normalized)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                       ON CONFLICT (chunk_id) DO NOTHING""",
                    chunk_id, document_id, i,
                    chunk["text"], chunk["token_count"],
                    str(_chunk_id_to_qdrant_id(chunk_id)),
                    user_id, normalized_filename,
                )

                qdrant_points.append({
                    "id": _chunk_id_to_qdrant_id(chunk_id),
                    "vector": embedding,
                    "payload": {
                        "document_id": document_id,
                        "user_id": user_id,
                        "chunk_id": chunk_id,
                        "filename": filename,
                        "normalized_filename": normalized_filename,
                        "chunk_index": i,
                        "source_type": file_type,
                        "knowledge_tier": "persistent",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                })

                redis_store.set_progress(document_id, "embedding", i + 1, total)
                logger.debug("Embedded chunk {}/{} for {}", i + 1, total, document_id)

        # 4. Upsert into Qdrant
        await qdrant.ensure_collection()
        await qdrant.upsert_points(qdrant_points)

        # 5. Mark complete
        redis_store.delete_progress(document_id)
        await postgres.execute(
            """UPDATE documents
               SET processing_status='complete', word_count=$1, chunk_count=$2
               WHERE document_id=$3""",
            word_count, total, document_id,
        )
        logger.info("Document {} ingested: {} chunks", document_id, total)

    except Exception:
        redis_store.delete_progress(document_id)
        logger.exception("Unexpected error processing document {}", document_id)
        await postgres.execute(
            "UPDATE documents SET processing_status='error', error_message='Internal processing error' WHERE document_id=$1",
            document_id,
        )


async def _ingest_url(document_id: str, url: str, user_id: int) -> None:
    try:
        # 1. Fetch
        redis_store.set_progress(document_id, "fetching", 0, 0)
        await postgres.execute(
            "UPDATE documents SET processing_status='processing' WHERE document_id=$1",
            document_id,
        )
        result = await fetch_url(url)
        text = result.markdown
        title = result.title or url
        normalized_title = normalize_filename(title)

        # 2. Chunk
        redis_store.set_progress(document_id, "chunking", 0, 0)
        chunks = chunk_text(text)
        word_count = result.word_count

        if not chunks:
            redis_store.delete_progress(document_id)
            await postgres.execute(
                "UPDATE documents SET processing_status='error', error_message='No content to chunk' WHERE document_id=$1",
                document_id,
            )
            return

        total = len(chunks)
        logger.info("URL document {}: {} words → {} chunks", document_id, word_count, total)

        # 3. Embed + store chunks
        redis_store.set_progress(document_id, "embedding", 0, total)
        qdrant_points = []
        async with httpx.AsyncClient() as client:
            for chunk in chunks:
                i = chunk["chunk_index"]
                chunk_id = f"{document_id}_chunk_{i}"

                embedding = await _embed(client, chunk["text"])

                await postgres.execute(
                    """INSERT INTO document_chunks
                           (chunk_id, document_id, chunk_index, text, token_count, qdrant_point_id, user_id, filename_normalized)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                       ON CONFLICT (chunk_id) DO NOTHING""",
                    chunk_id, document_id, i,
                    chunk["text"], chunk["token_count"],
                    str(_chunk_id_to_qdrant_id(chunk_id)),
                    user_id, normalized_title,
                )

                qdrant_points.append({
                    "id": _chunk_id_to_qdrant_id(chunk_id),
                    "vector": embedding,
                    "payload": {
                        "document_id": document_id,
                        "user_id": user_id,
                        "chunk_id": chunk_id,
                        "filename": title,
                        "normalized_filename": normalized_title,
                        "chunk_index": i,
                        "source_type": "web",
                        "knowledge_tier": "persistent",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                })

                redis_store.set_progress(document_id, "embedding", i + 1, total)
                logger.debug("Embedded chunk {}/{} for {}", i + 1, total, document_id)

        # 4. Upsert into Qdrant
        await qdrant.ensure_collection()
        await qdrant.upsert_points(qdrant_points)

        # 5. Mark complete
        redis_store.delete_progress(document_id)
        await postgres.execute(
            """UPDATE documents
               SET processing_status='complete', filename=$1, word_count=$2, chunk_count=$3
               WHERE document_id=$4""",
            title, word_count, total, document_id,
        )
        logger.info("URL document {} ingested: {} chunks", document_id, total)

    except Exception:
        redis_store.delete_progress(document_id)
        logger.exception("Unexpected error processing URL document {}", document_id)
        await postgres.execute(
            "UPDATE documents SET processing_status='error', error_message='Internal processing error' WHERE document_id=$1",
            document_id,
        )


# ── Celery tasks ───────────────────────────────────────────────────────────────
# bind=True gives access to `self` (the task instance) for retries.
# max_retries=3 means Celery will retry up to 3 times on unhandled exceptions
# before giving up (with exponential backoff via countdown).

@celery_app.task(bind=True, max_retries=3, name="ingestion.process_document")
def process_document(self, document_id: str, body_b64: str, mime: str, filename: str, file_type: str, user_id: int) -> None:
    """
    Ingest an uploaded file into Qdrant + Postgres.

    body_b64: the file bytes base64-encoded as a string. Celery's JSON
    serializer can't handle raw bytes, so the caller encodes and we decode here.
    """
    try:
        body = base64.b64decode(body_b64)
        asyncio.run(_ingest_file(document_id, body, mime, filename, file_type, user_id))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@celery_app.task(bind=True, max_retries=3, name="ingestion.process_url")
def process_url(self, document_id: str, url: str, user_id: int) -> None:
    """Fetch a URL and ingest its content into Qdrant + Postgres."""
    try:
        asyncio.run(_ingest_url(document_id, url, user_id))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
