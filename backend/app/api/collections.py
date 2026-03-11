from app.core.security import get_current_user
from fastapi import APIRouter, Depends
from app.db import postgres
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/collections", tags=["collections"])


@router.get("")
async def get_collections(current_user: dict = Depends(get_current_user)):
    rows = await postgres.fetch_all(
        "SELECT collection_id, name FROM collections WHERE user_id = $1", current_user["id"],
    )
    return {"collections": [dict(r) for r in rows]}

@router.post("/create-collection")
async def create_collection(body: dict, current_user: dict = Depends(get_current_user)):
    name = body.get("name")
    return JSONResponse(status_code=200, content={"detail": name + " Collection created."})

