import base64
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse
from loguru import logger

from app.core.security import get_current_user
from app.core.ingestion import VIDEO_MIME_TYPES, _resolve_mime
from app.core.crawler import fetch_url
from app.db import postgres, qdrant
from app.db import redis as redis_store
from app.tasks.ingestion import process_document, process_url

router = APIRouter(prefix="/api/documents", tags=["documents"])

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


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("")
async def list_documents(
    current_user: dict = Depends(get_current_user),
    collection_id: str | None = Query(default=None),
    file_type: str | None = Query(default=None),
):
    conditions = ["d.user_id = $1"]
    params: list = [current_user["id"]]

    if collection_id:
        params.append(collection_id)
        conditions.append(f"collection_id = ${len(params)}")

    if file_type:
        params.append(file_type.lower())
        conditions.append(f"LOWER(file_type) = ${len(params)}")

    where = " AND ".join(conditions)
    rows = await postgres.fetch_all(
        f"""SELECT d.document_id, d.filename, d.file_type, d.processing_status,
                  d.upload_date, d.word_count, d.chunk_count, d.error_message,
                  d.collection_id, c.name AS collection_name
           FROM documents d
           LEFT JOIN collections c ON c.collection_id = d.collection_id
           WHERE {where}
           ORDER BY d.upload_date DESC
           LIMIT 50""",
        *params,
    )
    return {"documents": [dict(r) for r in rows], "total": len(rows)}


@router.post("/upload")
async def upload_documents(
    files: list[UploadFile] = File([]),
    urls: list[str] = Form([]),
    collection_id: str | None = Form(None),
    current_user: dict = Depends(get_current_user),
):
    results = []

    for file in files:
        filename = file.filename or ""
        mime = _resolve_mime(file.content_type or "", filename)

        if mime not in ALLOWED_TYPES:
            results.append({
                "type": "file",
                "filename": filename,
                "ok": False,
                "error": f"Unsupported file type: {file.content_type!r}.",
            })
            continue

        try:
            body = await file.read()
        except Exception as e:
            logger.warning("Failed to read upload body for {}: {}", filename, e)
            results.append({"type": "file", "filename": filename, "ok": False, "error": "Failed to read file."})
            continue

        if not body:
            results.append({"type": "file", "filename": filename, "ok": False, "error": "Empty file."})
            continue

        document_id = f"doc_{uuid.uuid4().hex[:12]}"
        file_type = _MIME_TO_TYPE.get(mime, "unknown")

        await postgres.execute(
            """INSERT INTO documents (document_id, filename, file_type, processing_status, word_count, user_id, collection_id)
               VALUES ($1, $2, $3, 'processing', 0, $4, $5)""",
            document_id, filename, file_type, current_user["id"], collection_id or None,
        )

        process_document.delay(document_id, base64.b64encode(body).decode(), mime, filename, file_type, current_user["id"])
        logger.info("Upload accepted: {} → {}", filename, document_id)

        results.append({
            "type": "file",
            "document_id": document_id,
            "filename": filename,
            "file_type": file_type,
            "ok": True,
            "status": "processing",
        })

    for url in urls:
        url = url.strip()
        if not url:
            continue
        document_id = f"doc_{uuid.uuid4().hex[:12]}"
        await postgres.execute(
            """INSERT INTO documents (document_id, filename, file_type, processing_status, word_count, user_id, collection_id)
               VALUES ($1, $2, 'web', 'pending', 0, $3, $4)""",
            document_id, url, current_user["id"], collection_id or None,
        )
        process_url.delay(document_id, url, current_user["id"])
        logger.info("URL queued for crawl: {} → {}", url, document_id)
        results.append({
            "type": "url",
            "document_id": document_id,
            "url": url,
            "file_type": "web",
            "ok": True,
            "status": "pending",
        })

    return JSONResponse(status_code=202, content={"results": results})


@router.post("/url")
async def ingest_url(body: dict, current_user: dict = Depends(get_current_user)):
    url = body.get("url")

    if not url:
        return JSONResponse(status_code=400, content={"detail": "URL is required."})

    try:
        result = await fetch_url(url)
        return JSONResponse(status_code=200, content={
            "url": result.url,
            "markdown": result.markdown,
            "title": result.title,
            "word_count": result.word_count,
        })
    except Exception as e:
        logger.exception("URL ingest failed for {}: {}", url, e)
        return JSONResponse(status_code=500, content={"detail": "URL ingestion failed."})


@router.get("/progress/active")
async def get_active_progress(current_user: dict = Depends(get_current_user)):
    rows = await postgres.fetch_all(
        "SELECT document_id, processing_status FROM documents WHERE processing_status IN ('pending', 'processing') AND user_id = $1",
        current_user["id"],
    )
    result = {}
    for row in rows:
        doc_id = row["document_id"]
        status = row["processing_status"]
        prog = redis_store.get_progress(doc_id)
        if prog is not None:
            result[doc_id] = {**prog, "active": True, "processing_status": status}
        else:
            result[doc_id] = {"stage": status, "done": 0, "total": 0, "active": False, "processing_status": status}
    return result

@router.get("/{document_id}/progress")
async def get_document_progress(document_id: str, current_user: dict = Depends(get_current_user)):
    prog = redis_store.get_progress(document_id)
    if prog is not None:
        return {**prog, "active": True}
    row = await postgres.fetch_one(
        "SELECT processing_status FROM documents WHERE document_id = $1 AND user_id = $2", document_id, current_user["id"],
    )
    if not row:
        return JSONResponse(status_code=404, content={"detail": "Document not found."})
    return {"stage": row["processing_status"], "done": 0, "total": 0, "active": False}



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

@router.get("/{document_id}/conversations")
async def get_document_conversations(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    rows = await postgres.fetch_all(
        """SELECT c.conversation_id, c.title, c.last_active
            FROM conversations c
            JOIN conversation_documents cd ON cd.conversation_id = c.conversation_id
            WHERE cd.document_id = $1 AND c.user_id = $2
            ORDER BY c.last_active DESC
            LIMIT 3""",
        document_id, current_user["id"],
    )
    return {"conversations": [dict(r) for r in rows]}


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
    redis_store.delete_progress(document_id)

    return {"deleted": document_id}