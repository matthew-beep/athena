import uuid
from fastapi import APIRouter, Depends, UploadFile, File

from app.core.security import get_current_user

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("")
async def list_documents(current_user: dict = Depends(get_current_user)):
    return {"documents": [], "total": 0}


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    return {
        "document_id": f"doc_{uuid.uuid4().hex[:12]}",
        "filename": file.filename,
        "status": "pending",
        "message": "Document processing not yet implemented in prototype",
    }


@router.post("/url")
async def ingest_url(body: dict, current_user: dict = Depends(get_current_user)):
    return {
        "document_id": f"doc_{uuid.uuid4().hex[:12]}",
        "url": body.get("url"),
        "status": "pending",
        "message": "URL ingestion not yet implemented in prototype",
    }


@router.get("/{document_id}")
async def get_document(document_id: str, current_user: dict = Depends(get_current_user)):
    return {"document_id": document_id, "status": "not_found"}


@router.delete("/{document_id}")
async def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    return {"deleted": document_id}
