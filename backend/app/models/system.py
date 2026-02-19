from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str


class ResourceStats(BaseModel):
    cpu_pct: float
    ram_used_gb: float
    ram_total_gb: float
    gpu_used_gb: float
    gpu_total_gb: float
    nvme_used_pct: float
    hdd_used_pct: float
