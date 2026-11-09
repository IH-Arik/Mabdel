from __future__ import annotations

import logging
from datetime import date, datetime

from celery import shared_task

logger = logging.getLogger(__name__)


def _parse_dob(value) -> date | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


async def _send_due_birthday_messages(db) -> int:
    from app.services.email_service import EmailService
    from app.utils.helpers import utc_now

    today = utc_now().date()
    sent = 0
    async for owner in db.users.find({"role": "owner", "owner_dob": {"$exists": True, "$ne": None}}):
        dob = _parse_dob(owner.get("owner_dob"))
        if not dob or dob.month != today.month or dob.day != today.day:
            continue
        if owner.get("last_birthday_message_sent_date") == today.isoformat():
            continue

        recipient = owner.get("original_email") or owner.get("email")
        if not recipient:
            continue

        business_name = owner.get("business_name") or "there"
        await EmailService().send(
            email=recipient,
            subject="Happy Birthday from GoCustify!",
            text=f"Happy birthday, {business_name}! Wishing you a great day from the GoCustify team.",
            html=f"<p>Happy birthday, <strong>{business_name}</strong>! Wishing you a great day from the GoCustify team.</p>",
        )
        await db.users.update_one(
            {"_id": owner["_id"]}, {"$set": {"last_birthday_message_sent_date": today.isoformat()}}
        )
        sent += 1
    return sent


@shared_task(bind=True, name="birthday.send_messages", max_retries=1)
def send_birthday_messages_task(self) -> int:
    try:
        import asyncio

        from app.core.database import get_database

        async def _run() -> int:
            db = await get_database()
            return await _send_due_birthday_messages(db)

        return asyncio.run(_run())
    except Exception as exc:
        logger.exception("send_birthday_messages_task failed: %s", exc)
        raise self.retry(exc=exc)
