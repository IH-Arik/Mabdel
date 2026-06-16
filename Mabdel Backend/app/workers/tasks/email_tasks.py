from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="email.send", max_retries=3, default_retry_delay=30)
def send_email_task(self, payload: dict) -> dict:
    try:
        import asyncio

        from app.core.database import mongo_manager
        from app.services.email_service import EmailService

        async def _run() -> dict:
            db = mongo_manager.get_database()
            service = EmailService(db)
            return await service.send(**payload)

        return asyncio.run(_run())
    except Exception as exc:
        logger.exception("send_email_task failed: %s", exc)
        raise self.retry(exc=exc)
