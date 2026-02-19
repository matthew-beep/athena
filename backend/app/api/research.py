import uuid
from fastapi import APIRouter, Depends

from app.core.security import get_current_user

router = APIRouter(prefix="/api/research", tags=["research"])


@router.get("")
async def list_research(current_user: dict = Depends(get_current_user)):
    return {"sessions": [], "total": 0}


@router.post("")
async def start_research(body: dict, current_user: dict = Depends(get_current_user)):
    return {
        "research_id": f"res_{uuid.uuid4().hex[:12]}",
        "status": "pending",
        "message": "Research pipeline not yet implemented in prototype",
    }
