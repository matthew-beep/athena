from fastapi import APIRouter, HTTPException, status, Depends
from loguru import logger

from app.models.auth import LoginRequest, TokenResponse, UserOut
from app.core.security import verify_password, create_access_token, get_current_user
from app.db import postgres

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    user = await postgres.fetch_one(
        "SELECT id, username, hashed_password FROM users WHERE username = $1",
        body.username,
    )
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_access_token({"sub": user["username"]})
    logger.info(f"User {body.username!r} logged in")
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)) -> UserOut:
    return UserOut(**current_user)
