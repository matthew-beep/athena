import uuid

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from app.core.security import get_current_user
from app.db import postgres
from app.models.projects import (
    AttachDocumentsRequest,
    ProjectCreateRequest,
    ProjectItem,
    ProjectListResponse,
    ProjectMutateResponse,
    ProjectUpdateRequest,
    SurfaceItem,
    SurfaceListResponse,
    SurfaceUpdateRequest,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


# ─── helpers ──────────────────────────────────────────────────────────────────

async def _require_project(project_id: str, user_id: int) -> dict:
    row = await postgres.fetch_one(
        "SELECT * FROM projects WHERE project_id = $1 AND user_id = $2",
        project_id, user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return dict(row)


def _row_to_item(row: dict) -> ProjectItem:
    return ProjectItem(
        project_id=row["project_id"],
        name=row["name"],
        goal=row.get("goal"),
        status=row["status"],
        constraints=row.get("constraints"),
        created_at=row["created_at"],
        last_active_at=row["last_active_at"],
        surface_count=row.get("surface_count", 0),
    )


# ─── projects CRUD ────────────────────────────────────────────────────────────

@router.get("", response_model=ProjectListResponse)
async def list_projects(current_user: dict = Depends(get_current_user)):
    rows = await postgres.fetch_all(
        """
        SELECT p.*,
               COUNT(s.id) FILTER (WHERE s.status = 'unread')::int AS surface_count
        FROM projects p
        LEFT JOIN surfaces s ON s.project_id = p.project_id
        WHERE p.user_id = $1
        GROUP BY p.id
        ORDER BY p.last_active_at DESC
        """,
        current_user["id"],
    )
    items = [_row_to_item(dict(r)) for r in rows]
    return ProjectListResponse(projects=items, total=len(items))


@router.post("", response_model=ProjectItem, status_code=201)
async def create_project(
    body: ProjectCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    project_id = f"proj_{uuid.uuid4().hex[:16]}"
    row = await postgres.fetch_one(
        """
        INSERT INTO projects (project_id, user_id, name, goal, constraints)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        """,
        project_id, current_user["id"], body.name, body.goal, body.constraints,
    )
    logger.info("Created project {} for user {}", project_id, current_user["id"])
    result = dict(row)
    result["surface_count"] = 0
    return _row_to_item(result)


@router.get("/{project_id}", response_model=ProjectItem)
async def get_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    rows = await postgres.fetch_all(
        """
        SELECT p.*,
               COUNT(s.id) FILTER (WHERE s.status = 'unread')::int AS surface_count
        FROM projects p
        LEFT JOIN surfaces s ON s.project_id = p.project_id
        WHERE p.project_id = $1 AND p.user_id = $2
        GROUP BY p.id
        """,
        project_id, current_user["id"],
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Project not found")
    result = dict(rows[0])
    # Touch last_active_at
    await postgres.execute(
        "UPDATE projects SET last_active_at = NOW() WHERE project_id = $1",
        project_id,
    )
    return _row_to_item(result)


@router.patch("/{project_id}", response_model=ProjectItem)
async def update_project(
    project_id: str,
    body: ProjectUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    await _require_project(project_id, current_user["id"])

    updates: list[str] = []
    values: list = []
    idx = 1

    if body.name is not None:
        updates.append(f"name = ${idx}")
        values.append(body.name.strip())
        idx += 1
    if body.goal is not None:
        updates.append(f"goal = ${idx}")
        values.append(body.goal)
        idx += 1
    if body.constraints is not None:
        updates.append(f"constraints = ${idx}")
        values.append(body.constraints)
        idx += 1
    if body.status is not None:
        if body.status not in ("active", "paused", "complete"):
            raise HTTPException(status_code=422, detail="status must be active | paused | complete")
        updates.append(f"status = ${idx}")
        values.append(body.status)
        idx += 1

    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")

    updates.append(f"last_active_at = NOW()")
    values.append(project_id)

    row = await postgres.fetch_one(
        f"UPDATE projects SET {', '.join(updates)} WHERE project_id = ${idx} RETURNING *",
        *values,
    )
    result = dict(row)
    result["surface_count"] = 0
    return _row_to_item(result)


@router.delete("/{project_id}", response_model=ProjectMutateResponse)
async def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    await _require_project(project_id, current_user["id"])
    await postgres.execute(
        "DELETE FROM projects WHERE project_id = $1",
        project_id,
    )
    logger.info("Deleted project {}", project_id)
    return ProjectMutateResponse(project_id=project_id, detail="Project deleted")


# ─── project documents ────────────────────────────────────────────────────────

@router.get("/{project_id}/documents")
async def list_project_documents(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    await _require_project(project_id, current_user["id"])
    rows = await postgres.fetch_all(
        """
        SELECT d.document_id, d.filename, d.file_type, d.processing_status,
               d.chunk_count, d.word_count, d.collection_id, pd.added_at
        FROM project_documents pd
        JOIN documents d ON d.document_id = pd.document_id
        WHERE pd.project_id = $1
        ORDER BY pd.added_at DESC
        """,
        project_id,
    )
    return {"documents": [dict(r) for r in rows], "total": len(rows)}


@router.post("/{project_id}/documents", status_code=201)
async def attach_documents(
    project_id: str,
    body: AttachDocumentsRequest,
    current_user: dict = Depends(get_current_user),
):
    await _require_project(project_id, current_user["id"])
    inserted = 0
    for doc_id in body.document_ids:
        try:
            await postgres.execute(
                """
                INSERT INTO project_documents (project_id, document_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                """,
                project_id, doc_id,
            )
            inserted += 1
        except Exception as e:
            logger.warning("Could not attach doc {} to project {}: {}", doc_id, project_id, e)
    return {"detail": f"Attached {inserted} document(s)", "attached": inserted}


@router.delete("/{project_id}/documents/{document_id}", response_model=ProjectMutateResponse)
async def detach_document(
    project_id: str,
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    await _require_project(project_id, current_user["id"])
    await postgres.execute(
        "DELETE FROM project_documents WHERE project_id = $1 AND document_id = $2",
        project_id, document_id,
    )
    return ProjectMutateResponse(project_id=project_id, detail="Document detached")


# ─── surfaces ─────────────────────────────────────────────────────────────────

@router.get("/{project_id}/surfaces", response_model=SurfaceListResponse)
async def list_surfaces(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    await _require_project(project_id, current_user["id"])
    rows = await postgres.fetch_all(
        """
        SELECT surface_id, project_id, surface_type, title, body, status, created_at
        FROM surfaces
        WHERE project_id = $1
        ORDER BY created_at DESC
        """,
        project_id,
    )
    items = [SurfaceItem(**dict(r)) for r in rows]
    return SurfaceListResponse(surfaces=items, total=len(items))


@router.patch("/{project_id}/surfaces/{surface_id}", response_model=SurfaceItem)
async def update_surface(
    project_id: str,
    surface_id: str,
    body: SurfaceUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    await _require_project(project_id, current_user["id"])
    if body.status not in ("read", "dismissed", "acted"):
        raise HTTPException(status_code=422, detail="status must be read | dismissed | acted")
    row = await postgres.fetch_one(
        """
        UPDATE surfaces SET status = $1
        WHERE surface_id = $2 AND project_id = $3
        RETURNING surface_id, project_id, surface_type, title, body, status, created_at
        """,
        body.status, surface_id, project_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Surface not found")
    return SurfaceItem(**dict(row))
