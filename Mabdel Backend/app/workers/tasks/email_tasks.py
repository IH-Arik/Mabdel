from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="email.send", max_retries=3, default_retry_delay=30)
def send_email_task(self, payload: dict) -> dict:
    try:
        import asyncio

        from app.services.email_service import EmailService

        async def _run() -> dict:
            # EmailService is stateless (no database access of its own), unlike
            # the other tasks in this package.
            await EmailService().send(**payload)
            return {"sent": True}

        return asyncio.run(_run())
    except Exception as exc:
        logger.exception("send_email_task failed: %s", exc)
        raise self.retry(exc=exc)
