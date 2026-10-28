from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="reminder.send", max_retries=3, default_retry_delay=60)
def send_reminder_task(self, payload: dict) -> dict:
    try:
        import asyncio

        from app.core.database import get_database
        from app.services.push_notification_service import PushNotificationService

        async def _run() -> dict:
            db = await get_database()
            service = PushNotificationService(db)
            result = await service.enqueue_notification(**payload)
            return {"enqueued": len(result)}

        return asyncio.run(_run())
    except Exception as exc:
        logger.exception("send_reminder_task failed: %s", exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, name="appointments.send_reminders", max_retries=1)
def send_appointment_reminders_task(self) -> int:
    """Texts customers whose appointment falls inside their business's configured
    reminder window - run every 15 minutes by celery beat, matching the polling
    window AppointmentService.send_due_reminders expects."""
    try:
        import asyncio

        from app.core.database import get_database
        from app.services.smartflow.appointment_service import AppointmentService

        async def _run() -> int:
            db = await get_database()
            return await AppointmentService(db).send_due_reminders()

        return asyncio.run(_run())
    except Exception as exc:
        # Used to catch everything and return 0, which is indistinguishable from
        # "ran fine, nothing was due" - a real outage (DB down, bad query) looked
        # like success forever. Retry once (max_retries=1, matching the decorator)
        # and let it surface as a real task failure if that also fails.
        logger.exception("send_appointment_reminders_task failed: %s", exc)
        raise self.retry(exc=exc)
