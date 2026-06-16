from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "mabdel",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.tasks.email_tasks",
        "app.workers.tasks.push_tasks",
        "app.workers.tasks.invoice_tasks",
        "app.workers.tasks.reminder_tasks",
        "app.workers.tasks.social_sync_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_default_retry_delay=30,
    task_max_retries=3,
    task_routes={
        "app.workers.tasks.email_tasks.*": {"queue": "email"},
        "app.workers.tasks.push_tasks.*": {"queue": "push"},
        "app.workers.tasks.invoice_tasks.*": {"queue": "invoice"},
        "app.workers.tasks.reminder_tasks.*": {"queue": "default"},
        "app.workers.tasks.social_sync_tasks.*": {"queue": "default"},
    },
    beat_schedule={
        "snapchat-auto-sync-every-5-minutes": {
            "task": "social.sync_polling_platforms",
            "schedule": 300.0,  # 5 minutes
        },
    },
)
