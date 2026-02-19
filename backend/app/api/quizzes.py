from fastapi import APIRouter, Depends

from app.core.security import get_current_user

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])


@router.get("/due")
async def get_due_quizzes(current_user: dict = Depends(get_current_user)):
    return {"quizzes": [], "total": 0}


@router.post("/generate")
async def generate_quiz(body: dict, current_user: dict = Depends(get_current_user)):
    return {"message": "Quiz generation not yet implemented in prototype"}


@router.get("/concepts/mastery")
async def get_mastery(current_user: dict = Depends(get_current_user)):
    return {"concepts": []}
