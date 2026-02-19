import random
from fastapi import APIRouter, Depends

from app.models.system import HealthResponse, ResourceStats
from app.core.security import get_current_user

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", version="0.1.0")


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
