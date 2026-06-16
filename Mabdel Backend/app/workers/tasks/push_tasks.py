from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="push.dispatch", max_retries=3, default_retry_delay=30)
def dispatch_push_notifications_task(self, payload: dict) -> dict:
    try:
        import asyncio

        from app.core.database import mongo_manager
        from app.services.push_notification_service import PushNotificationService

        async def _run() -> dict:
            db = mongo_manager.get_database()
            service = PushNotificationService(db)
            return await service.dispatch(**payload)

        return asyncio.run(_run())
    except Exception as exc:
        logger.exception("dispatch_push_notifications_task failed: %s", exc)
        raise self.retry(exc=exc)
