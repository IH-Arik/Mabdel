from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "mabdel",
    broker=settings.CELERY_BROKER_URL or settings.REDIS_URL,
    backend=settings.CELERY_BROKER_URL or settings.REDIS_URL,
    include=[
        "app.workers.tasks.email_tasks",
        "app.workers.tasks.push_tasks",
        "app.workers.tasks.invoice_tasks",
        "app.workers.tasks.reminder_tasks",
        "app.workers.tasks.social_sync_tasks",
        "app.workers.tasks.caldav_sync_tasks",
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
    task_default_queue="default",
    # Keys here must be the registered task *name* (the `name=` kwarg each
    # @shared_task sets), not the Python module path - Celery's router matches
    # against the name a task actually publishes under. These used to be
    # dotted module paths like "app.workers.tasks.email_tasks.*", which never
    # matched anything (every task here has a short explicit name instead), so
    # every task silently fell through to Celery's own default queue - which
    # is literally named "celery", not "default" - where nothing ever consumed
    # it. Confirmed live: two due tasks sat unconsumed in Redis's "celery" list
    # for 5+ minutes before this fix.
    task_routes={
        "email.send": {"queue": "email"},
        "push.dispatch": {"queue": "push"},
        "invoice.generate": {"queue": "invoice"},
        "reminder.send": {"queue": "default"},
        "appointments.send_reminders": {"queue": "default"},
        "social.sync_polling_platforms": {"queue": "default"},
        "caldav.sync_connections": {"queue": "default"},
    },
    beat_schedule={
        "snapchat-auto-sync-every-5-minutes": {
            "task": "social.sync_polling_platforms",
            "schedule": 300.0,  # 5 minutes
        },
        "caldav-auto-sync-every-5-minutes": {
            "task": "caldav.sync_connections",
            "schedule": 300.0,  # 5 minutes
        },
        "appointment-reminders-every-15-minutes": {
            "task": "appointments.send_reminders",
            "schedule": 900.0,  # 15 minutes - matches AppointmentService.send_due_reminders' window
        },
    },
)
