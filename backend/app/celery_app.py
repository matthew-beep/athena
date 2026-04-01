from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "athena",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    # Tasks are acknowledged only after they finish, not when they're picked up.
    # This means if the worker crashes mid-task, the task goes back to the queue.
    task_acks_late=True,

    # Only fetch one task at a time per worker process. Keeps memory predictable
    # since ingestion tasks can be heavy (embedding batches, file reads).
    worker_prefetch_multiplier=1,

    # Results expire after 24 hours. We don't rely on Celery results for much —
    # task outcomes are written directly to Postgres — but this keeps Redis tidy.
    result_expires=86400,

    # Task modules to auto-discover. Add new task files here as they're created.
    include=["app.tasks.ingestion"],
)
