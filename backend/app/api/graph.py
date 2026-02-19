from fastapi import APIRouter, Depends

from app.core.security import get_current_user

router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/visualize")
async def visualize_graph(current_user: dict = Depends(get_current_user)):
    return {"nodes": [], "edges": []}


@router.get("/nodes")
async def list_nodes(current_user: dict = Depends(get_current_user)):
    return {"nodes": []}


@router.get("/gaps")
async def get_gaps(current_user: dict = Depends(get_current_user)):
    return {"gaps": []}
