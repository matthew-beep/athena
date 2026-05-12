from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    goal: str | None = None
    constraints: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class ProjectUpdateRequest(BaseModel):
    name: str | None = None
    goal: str | None = None
    constraints: str | None = None
    status: str | None = None  # active | paused | complete


class ProjectItem(BaseModel):
    project_id: str
    name: str
    goal: str | None
    status: str
    constraints: str | None
    created_at: datetime
    last_active_at: datetime
    surface_count: int = 0


class ProjectListResponse(BaseModel):
    projects: list[ProjectItem]
    total: int


class ProjectMutateResponse(BaseModel):
    project_id: str
    detail: str


class AttachDocumentsRequest(BaseModel):
    document_ids: list[str] = Field(..., min_length=1)


class SurfaceItem(BaseModel):
    surface_id: str
    project_id: str
    surface_type: str
    title: str | None
    body: str | None
    status: str
    created_at: datetime


class SurfaceUpdateRequest(BaseModel):
    status: str  # read | dismissed | acted


class SurfaceListResponse(BaseModel):
    surfaces: list[SurfaceItem]
    total: int
