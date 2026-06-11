from __future__ import annotations

try:
    from celery import Celery
except ModuleNotFoundError:  # pragma: no cover - optional dependency
    Celery = None


celery_app = Celery("mabdel") if Celery else None
