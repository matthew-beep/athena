import random
import asyncio
from fastapi import APIRouter, Depends
import httpx
from app.db import postgres, qdrant 
from app.models.system import HealthResponse, ResourceStats
from app.core.security import get_current_user
from app.config import get_settings


router = APIRouter(prefix="/api/system", tags=["system"])

async def check_postgres() -> bool:
    try:
        row = await postgres.fetch_one("SELECT 1")
        return row is not None
    except Exception:
        return False


async def check_qdrant(settings) -> bool:
    try:

        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{settings.qdrant_base_url}/collections")
            return resp.status_code == 200
    except Exception as e:
        print(f"Qdrant check failed: {e}")
        return False

async def check_ollama(settings) -> bool:
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/tags")
            if resp.status_code == 200:
                models = resp.json().get("models", [])
                return len(models) > 0
            return False
    except Exception as e:
        print(f"Ollama check failed: {e}")
        return False


@router.get("/health", response_model=HealthResponse)
async def health():
    settings = get_settings()
    postgres_ok, qdrant_ok, ollama_ok = await asyncio.gather(
        check_postgres(),
        check_qdrant(settings),
        check_ollama(settings),
    )

    overall_status = all([postgres_ok, qdrant_ok, ollama_ok])

    return {
        "status": "ok" if overall_status else "error",
        "dependencies": {
            "postgres": "connected" if postgres_ok else "error",
            "qdrant": "connected" if qdrant_ok else "error",
            "ollama": "connected" if ollama_ok else "error",
        }
    }


@router.get("/resources", response_model=ResourceStats)
async def resources(current_user: dict = Depends(get_current_user)):
    # Prototype: mock values. Production would read from psutil + nvidia-smi + df.
    return ResourceStats(
        cpu_pct=round(random.uniform(5, 25), 1),
        ram_used_gb=round(random.uniform(8, 24), 1),
        ram_total_gb=96.0,
        gpu_used_gb=4.2,
        gpu_total_gb=16.0,
        nvme_used_pct=7.0,
        hdd_used_pct=16.0,
    )


@router.get("/models")
async def list_models(current_user: dict = Depends(get_current_user)):
    return {
        "models": [
            {"name": "llama3.2:3b", "tier": 1, "status": "loaded"},
        ]
    }
