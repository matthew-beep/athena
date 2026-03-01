import asyncio
import hashlib
import uuid
from datetime import datetime, timezone
from io import BytesIO

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from loguru import logger

from app.config import get_settings
from app.core.security import get_current_user
from app.core.ingestion import extract_text, chunk_text, VIDEO_MIME_TYPES, _resolve_mime, normalize_filename
from app.db import postgres
from app.db import qdrant
from app.core.bm25 import build_bm25_index

router = APIRouter(prefix="/api/documents", tags=["documents"])

# ── In-process progress store ──────────────────────────────────────────────────
# Keyed by document_id. Cleared when processing finishes (success or error).
# Shape: { "stage": str, "done": int, "total": int }
_progress: dict[str, dict] = {}

ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "text/csv",
    "text/x-python",
} | VIDEO_MIME_TYPES

_MIME_TO_TYPE = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/markdown": "markdown",
    "text/x-markdown": "markdown",
    "text/csv": "csv",
    "text/x-python": "python",
    "video/mp4": "video",
    "video/webm": "video",
    "video/quicktime": "video",
    "video/x-msvideo": "video",
    "video/x-matroska": "video",
    "audio/mpeg": "audio",
    "audio/wav": "audio",
    "audio/mp4": "audio",
}


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
    resp.raise_for_status()
    return resp.json()["embedding"]


async def _process_document(
    document_id: str, body: bytes, mime: str, filename: str, file_type: str, user_id: int
) -> None:
    """Full ingestion pipeline: extract → chunk → embed → store."""
    try:
        # ── 1. Extract ─────────────────────────────────────────────────────
        _progress[document_id] = {"stage": "extracting", "done": 0, "total": 0}
        text, error = await asyncio.to_thread(extract_text, BytesIO(body), mime, filename)
        normalized_filename = normalize_filename(filename)
        if error:
            _progress.pop(document_id, None)
            await postgres.execute(
                "UPDATE documents SET processing_status='error', error_message=$1 WHERE document_id=$2",
                error, document_id,
            )
            logger.warning("Extraction failed for {}: {}", document_id, error)
            return

        # ── 2. Chunk ───────────────────────────────────────────────────────
        _progress[document_id] = {"stage": "chunking", "done": 0, "total": 0}
        chunks = chunk_text(text)
        word_count = len(text.split())

        if not chunks:
            _progress.pop(document_id, None)
            await postgres.execute(
                "UPDATE documents SET processing_status='error', error_message='No content to chunk' WHERE document_id=$1",
                document_id,
            )
            return

        total = len(chunks)
        logger.info("Document {}: {} words → {} chunks", document_id, word_count, total)

        # ── 3. Embed + store ───────────────────────────────────────────────
        _progress[document_id] = {"stage": "embedding", "done": 0, "total": total}
        qdrant_points = []
        bm25_chunk_ids = []  # collect here
        bm25_texts = []

        async with httpx.AsyncClient() as client:
            for chunk in chunks:
                i = chunk["chunk_index"]
                chunk_id = f"{document_id}_chunk_{i}"

                bm25_chunk_ids.append(chunk_id)   # add to list
                bm25_texts.append(chunk["text"])   # add to list

                try:
                    embedding = await _embed(client, chunk["text"])
                except Exception as e:
                    logger.error("Embedding failed for chunk {} of {}: {}", i, document_id, e)
                    raise

                await postgres.execute(
                    """INSERT INTO document_chunks
                           (chunk_id, document_id, chunk_index, text, token_count, qdrant_point_id, user_id)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)
                       ON CONFLICT (chunk_id) DO NOTHING""",
                    chunk_id, document_id, i,
                    chunk["text"], chunk["token_count"],
                    str(_chunk_id_to_qdrant_id(chunk_id)),
                    user_id,
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

                _progress[document_id] = {"stage": "embedding", "done": i + 1, "total": total}

        # ── 4. Upsert Qdrant and build BM25 index ───────────────────────────────────────────────
        await qdrant.ensure_collection()
        await qdrant.upsert_points(qdrant_points)

        await build_bm25_index(document_id, bm25_chunk_ids, bm25_texts)


        # ── 5. Complete ────────────────────────────────────────────────────
        _progress.pop(document_id, None)
        await postgres.execute(
            """UPDATE documents
               SET processing_status='complete', word_count=$1, chunk_count=$2
               WHERE document_id=$3""",
            word_count, total, document_id,
        )
        logger.info("Document {} ingested: {} chunks", document_id, total)

    except Exception:
        _progress.pop(document_id, None)
        logger.exception("Unexpected error processing document {}", document_id)
        await postgres.execute(
            "UPDATE documents SET processing_status='error', error_message='Internal processing error' WHERE document_id=$1",
            document_id,
        )


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("")
async def list_documents(current_user: dict = Depends(get_current_user)):
    rows = await postgres.fetch_all(
        """SELECT document_id, filename, file_type, processing_status,
                  upload_date, word_count, chunk_count, error_message
           FROM documents
           WHERE user_id = $1
           ORDER BY upload_date DESC
           LIMIT 50""",
        current_user["id"],
    )
    return {"documents": [dict(r) for r in rows], "total": len(rows)}


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    filename = file.filename or ""
    mime = _resolve_mime(file.content_type or "", filename)

    if mime not in ALLOWED_TYPES:
        return JSONResponse(
            status_code=415,
            content={"detail": f"Unsupported file type: {file.content_type!r}."},
        )

    try:
        body = await file.read()
    except Exception as e:
        logger.warning("Failed to read upload body for {}: {}", filename, e)
        return JSONResponse(status_code=400, content={"detail": "Failed to read uploaded file."})

    if not body:
        return JSONResponse(status_code=400, content={"detail": "Empty file."})

    document_id = f"doc_{uuid.uuid4().hex[:12]}"
    file_type = _MIME_TO_TYPE.get(mime, "unknown")

    await postgres.execute(
        """INSERT INTO documents (document_id, filename, file_type, processing_status, word_count, user_id)
           VALUES ($1, $2, $3, 'processing', 0, $4)""",
        document_id, filename, file_type, current_user["id"],
    )

    background_tasks.add_task(_process_document, document_id, body, mime, filename, file_type, current_user["id"])
    logger.info("Upload accepted: {} → {}", filename, document_id)

    return JSONResponse(
        status_code=202,
        content={
            "document_id": document_id,
            "filename": filename,
            "file_type": file_type,
            "status": "processing",
        },
    )


@router.post("/url")
async def ingest_url(body: dict, current_user: dict = Depends(get_current_user)):
    return JSONResponse(status_code=501, content={"detail": "URL ingestion not yet implemented."})


@router.get("/{document_id}/progress")
async def get_document_progress(document_id: str, current_user: dict = Depends(get_current_user)):
    prog = _progress.get(document_id)
    if prog is not None:
        return {**prog, "active": True}
    # Not actively processing — return DB status as fallback
    row = await postgres.fetch_one(
        "SELECT processing_status FROM documents WHERE document_id = $1 AND user_id = $2", document_id, current_user["id"],
    )
    if not row:
        return JSONResponse(status_code=404, content={"detail": "Document not found."})
    return {"stage": row["processing_status"], "done": 0, "total": 0, "active": False}

@router.get("/progress/active")
async def get_active_progress(current_user: dict = Depends(get_current_user)):
    rows = await postgres.fetch_all(
        "SELECT document_id FROM documents WHERE processing_status = 'processing' AND user_id = $1",
        current_user["id"],
    )
    result = {}
    for row in rows:
        doc_id = row["document_id"]
        prog = _progress.get(doc_id)
        if prog is not None:
            result[doc_id] = {**prog, "active": True}
        else:
            # In DB as processing but not in memory — server restarted mid-ingest
            result[doc_id] = {"stage": "processing", "done": 0, "total": 0, "active": False}
    return result



@router.get("/{document_id}")
async def get_document(document_id: str, current_user: dict = Depends(get_current_user)):
    row = await postgres.fetch_one(
        """SELECT document_id, filename, file_type, processing_status,
                  upload_date, word_count, chunk_count, error_message
           FROM documents WHERE document_id = $1 AND user_id = $2""",
        document_id,
        current_user["id"],
    )
    if not row:
        return JSONResponse(status_code=404, content={"detail": "Document not found."})
    return dict(row)


@router.delete("/{document_id}")
async def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    row = await postgres.fetch_one(
        "SELECT document_id FROM documents WHERE document_id = $1 AND user_id = $2", document_id, current_user["id"],
    )
    if not row:
        return JSONResponse(status_code=404, content={"detail": "Document not found."})

    # Remove from postgres (cascades to document_chunks)
    await postgres.execute("DELETE FROM documents WHERE document_id = $1 AND user_id = $2", document_id, current_user["id"])

    # Remove vectors from Qdrant
    try:
        await qdrant.delete_by_document_id(document_id)
    except Exception:
        logger.warning("Qdrant delete failed for {} — vectors may linger", document_id)

    # Clear any in-progress state
    _progress.pop(document_id, None)

    return {"deleted": document_id}
