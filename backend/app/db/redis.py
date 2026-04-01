import json
import redis as redis_lib
from app.config import get_settings

_client: redis_lib.Redis | None = None


def get_client() -> redis_lib.Redis:
    global _client
    if _client is None:
        settings = get_settings()
        _client = redis_lib.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            db=0,
            decode_responses=True,
        )
    return _client


def set_progress(document_id: str, stage: str, done: int, total: int) -> None:
    get_client().set(
        f"progress:{document_id}",
        json.dumps({"stage": stage, "done": done, "total": total}),
        ex=3600,  # expire after 1 hour in case cleanup never runs
    )


def get_progress(document_id: str) -> dict | None:
    raw = get_client().get(f"progress:{document_id}")
    return json.loads(raw) if raw else None


def delete_progress(document_id: str) -> None:
    get_client().delete(f"progress:{document_id}")
