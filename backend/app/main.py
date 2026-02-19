import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import get_settings
from app.db import postgres
from app.core.security import hash_password
from app.api import auth, chat, documents, research, quizzes, graph, system


async def seed_admin_user() -> None:
    settings = get_settings()
    existing = await postgres.fetch_one(
        "SELECT id FROM users WHERE username = 'admin'"
    )
    if not existing:
        hashed = hash_password(settings.seed_admin_password)
        await postgres.execute(
            "INSERT INTO users (username, hashed_password) VALUES ($1, $2)",
            "admin",
            hashed,
        )
        logger.info("Seeded default admin user (username: admin)")
    else:
        logger.info("Admin user already exists, skipping seed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Athena backend...")
    settings = get_settings()
    logger.info(
        f"Connecting to PostgreSQL at {settings.postgres_host}:{settings.postgres_port}"
    )

    for attempt in range(10):
        try:
            await postgres.create_pool()
            break
        except Exception as e:
            if attempt < 9:
                logger.warning(
                    f"DB connection attempt {attempt + 1} failed: {e}. Retrying in 2s..."
                )
                await asyncio.sleep(2)
            else:
                logger.error("Failed to connect to database after 10 attempts")
                raise

    await seed_admin_user()
    logger.info("Athena backend ready")
    yield

    await postgres.close_pool()
    logger.info("Athena backend shut down")


app = FastAPI(
    title="Athena API",
    version="0.1.0",
    description="Athena personal AI infrastructure — Phase 1 prototype",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(research.router)
app.include_router(quizzes.router)
app.include_router(graph.router)
app.include_router(system.router)


@app.get("/")
async def root():
    return {"message": "Athena API", "version": "0.1.0", "docs": "/docs"}
