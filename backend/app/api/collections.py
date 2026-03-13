import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
import asyncpg
from loguru import logger

from app.core.security import get_current_user
from app.db import postgres
from app.models.collections import (
    CollectionDocumentsRequest,
    CollectionDocumentsMutateResponse,
    CollectionItem,
    CollectionsListResponse,
    CollectionMutateResponse,
    CollectionDetailResponse,
    CollectionNameRequest,
)

router = APIRouter(prefix="/api/collections", tags=["collections"])


async def _get_collection(collection_id: str, user_id: int):
    return await postgres.fetch_one(
        "SELECT collection_id FROM collections WHERE collection_id = $1 AND user_id = $2",
        collection_id, user_id,
    )



@router.get("", response_model=CollectionsListResponse)
async def get_collections(current_user: dict = Depends(get_current_user)):
    rows = await postgres.fetch_all(
        """SELECT c.collection_id, c.name, c.created_at,
                  COUNT(d.document_id)::int AS document_count
           FROM collections c
           LEFT JOIN documents d ON d.collection_id = c.collection_id
           WHERE c.user_id = $1
           GROUP BY c.collection_id, c.name, c.created_at
           ORDER BY c.created_at""",
        current_user["id"],
    )
    collections = [CollectionItem(**dict(r)) for r in rows]
    return CollectionsListResponse(collections=collections, total=len(collections))


@router.post("", response_model=CollectionMutateResponse, status_code=201)
async def create_collection(body: CollectionNameRequest, current_user: dict = Depends(get_current_user)):
    collection_id = f"col_{uuid.uuid4().hex[:16]}"
    try:
        row = await postgres.fetch_one(
            """INSERT INTO collections (collection_id, user_id, name)
               VALUES ($1, $2, $3)
               RETURNING collection_id, name, created_at""",
            collection_id,
            current_user["id"],
            body.name,
        )
    except asyncpg.UniqueViolationError:
        return JSONResponse(
            status_code=409,
            content={"detail": "A collection with this name already exists."},
        )
    return CollectionMutateResponse(
        collection_id=row["collection_id"],
        name=row["name"],
        detail=f"{row['name']} collection created.",
        created_at=row["created_at"],
    )


@router.delete("/{collection_id}", response_model=CollectionDetailResponse)
async def delete_collection(collection_id: str, current_user: dict = Depends(get_current_user)):
    try:
        await postgres.execute(
            "UPDATE documents SET collection_id = NULL WHERE collection_id = $1 AND user_id = $2",
            collection_id,
            current_user["id"],
        )
        status = await postgres.execute(
            """DELETE FROM collections WHERE collection_id = $1 AND user_id = $2""",
            collection_id,
            current_user["id"],
        )
        if status == "DELETE 0":
            return JSONResponse(
                status_code=404,
                content={"detail": "Collection not found."},
            )
        return CollectionDetailResponse(detail=f"Collection {collection_id} deleted.")
    except asyncpg.PostgresError as e:
        logger.exception("Delete collection failed for {}: {}", collection_id, e)
        return JSONResponse(
            status_code=500,
            content={"detail": "Failed to delete collection."},
        )


@router.put("/{collection_id}", response_model=CollectionMutateResponse)
async def update_collection(collection_id: str, body: CollectionNameRequest, current_user: dict = Depends(get_current_user)):
    try:
        status = await postgres.execute(
            """UPDATE collections SET name = $1 WHERE collection_id = $2 AND user_id = $3""",
            body.name,
            collection_id,
            current_user["id"],
        )
        if status == "UPDATE 0":
            return JSONResponse(status_code=404, content={"detail": "Collection not found."})
        return CollectionMutateResponse(
            collection_id=collection_id,
            name=body.name,
            detail="Collection updated.",
        )
    except asyncpg.UniqueViolationError:
        return JSONResponse(status_code=409, content={"detail": "A collection with this name already exists."})
    except asyncpg.PostgresError as e:
        logger.exception("Update collection failed for {}: {}", collection_id, e)
        return JSONResponse(status_code=500, content={"detail": "Failed to update collection."})


def _parse_update_count(status: str) -> int:
    """Parse asyncpg execute result like 'UPDATE 3' to int."""
    if status and status.upper().startswith("UPDATE "):
        try:
            return int(status.split()[-1])
        except (IndexError, ValueError):
            pass
    return 0


@router.post("/{collection_id}/documents", response_model=CollectionDocumentsMutateResponse)
async def add_document_to_collection(collection_id: str, body: CollectionDocumentsRequest, current_user: dict = Depends(get_current_user)):
    try:
        collection = await _get_collection(collection_id, current_user["id"])
        if not collection:
            return JSONResponse(status_code=404, content={"detail": "Collection not found."})

        status = await postgres.execute(
            """UPDATE documents SET collection_id = $1 WHERE document_id = ANY($2) AND user_id = $3""",
            collection_id,
            body.document_ids,
            current_user["id"],
        )
        updated = _parse_update_count(status)
        return CollectionDocumentsMutateResponse(
            detail=f"{updated} document(s) assigned to collection.",
            updated=updated,
        )
    except asyncpg.PostgresError as e:
        logger.exception("Add documents to collection failed for {}: {}", collection_id, e)
        return JSONResponse(status_code=500, content={"detail": "Failed to assign documents to collection."})

@router.delete("/{collection_id}/documents", response_model=CollectionDocumentsMutateResponse)
async def remove_document_from_collection(collection_id: str, body: CollectionDocumentsRequest, current_user: dict = Depends(get_current_user)):
    try:
        collection = await _get_collection(collection_id, current_user["id"])
        if not collection:
            return JSONResponse(status_code=404, content={"detail": "Collection not found."})

        status = await postgres.execute(
            """UPDATE documents SET collection_id = NULL WHERE document_id = ANY($1) AND user_id = $2 AND collection_id = $3""",
            body.document_ids,
            current_user["id"],
            collection_id,
        )
        updated = _parse_update_count(status)
        return CollectionDocumentsMutateResponse(
            detail=f"{updated} document(s) removed from collection.",
            updated=updated,
        )
    except asyncpg.PostgresError as e:
        logger.exception("Remove documents from collection failed for {}: {}", collection_id, e)
        return JSONResponse(status_code=500, content={"detail": "Failed to remove documents from collection."})
