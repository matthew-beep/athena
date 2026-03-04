import random
import asyncio
from fastapi import APIRouter, Depends
import httpx
from app.db import postgres, qdrant 
from app.models.system import HealthResponse, ResourceStats, ModelStats
from app.core.security import get_current_user
from app.config import get_settings
import psutil
import pynvml


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
    # CPU
    cpu_pct = await asyncio.to_thread(psutil.cpu_percent, 0.1)

    # RAM
    ram = psutil.virtual_memory()
    ram_used_gb  = round(ram.used  / 1e9, 1)
    ram_total_gb = round(ram.total / 1e9, 1)

    # GPU
    try:
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
        gpu_used_gb  = round(mem.used  / 1e9, 1)
        gpu_total_gb = round(mem.total / 1e9, 1)
        pynvml.nvmlShutdown()
    except pynvml.NVMLError:
        gpu_used_gb  = 0.0
        gpu_total_gb = 0.0

    return ResourceStats(
        cpu_pct=cpu_pct,
        ram_used_gb=ram_used_gb,
        ram_total_gb=ram_total_gb,
        gpu_used_gb=gpu_used_gb,
        gpu_total_gb=gpu_total_gb,
        nvme_used_pct=0.0,
        hdd_used_pct=0.0,
    )

@router.get("/models")
async def list_models(current_user: dict = Depends(get_current_user)):
    settings = get_settings()
    return {
        "models": [
            {"name": settings.ollama_model, "tier": 1, "status": "loaded"},
        ]
    }

@router.get("/model-stats")
async def model_stats(current_user: dict = Depends(get_current_user)):
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{settings.ollama_base_url}/api/ps")
            models = resp.json().get("models", [])
    except Exception:
        return {"active" : False}

    if not models:
        return {"active" : False}

    m = models[0]
    total = m["size"]
    vram = m.get("size_vram", 0)
    ram = total - vram

    return ModelStats(
        active=True,
        name=m["name"],
        size_gb=round(total / 1e9, 1),
        gpu_pct=round((vram / total) * 100) if total else 0,
        ram_pct=round((ram  / total) * 100) if total else 0,
    )