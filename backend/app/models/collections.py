from datetime import datetime

from pydantic import BaseModel, Field, field_validator


# ─── Request bodies ───────────────────────────────────────────────────────────

class CollectionNameRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Collection name")

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class CollectionDocumentsRequest(BaseModel):
    document_ids: list[str] = Field(..., min_length=1, description="Document IDs to add or remove")


# ─── Response bodies (consistent shape) ───────────────────────────────────────

class CollectionItem(BaseModel):
    """Single collection in list responses."""
    collection_id: str
    name: str
    created_at: datetime
    document_count: int


class CollectionsListResponse(BaseModel):
    """GET /api/collections."""
    collections: list[CollectionItem]
    total: int


class CollectionMutateResponse(BaseModel):
    """Create (201) and update (200) single collection."""
    collection_id: str
    name: str
    detail: str
    created_at: datetime | None = None  # only on create


class CollectionDetailResponse(BaseModel):
    """Delete collection — success payload."""
    detail: str


class CollectionDocumentsMutateResponse(BaseModel):
    """Add or remove documents — success payload."""
    detail: str
    updated: int
