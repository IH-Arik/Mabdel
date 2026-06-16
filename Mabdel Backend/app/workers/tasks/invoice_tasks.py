from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="invoice.generate", max_retries=3, default_retry_delay=60)
def generate_invoice_task(self, payload: dict) -> dict:
    try:
        import asyncio

        from app.core.database import mongo_manager
        from app.services.invoice_service import InvoiceService

        async def _run() -> dict:
            db = mongo_manager.get_database()
            service = InvoiceService(db)
            return await service.send_reminder(**payload)

        return asyncio.run(_run())
    except Exception as exc:
        logger.exception("generate_invoice_task failed: %s", exc)
        raise self.retry(exc=exc)
