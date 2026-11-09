from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


async def _enforce_trial_expiry(db) -> int:
    """Expired trials: lock out paid features (already enforced live by
    require_subscription on every request) and suspend the business's Telnyx
    number so it stops answering inbound calls - the number itself is kept
    (not released back to Telnyx), so reactivating is just flipping the status
    back, with the same number restored automatically."""
    from app.utils.helpers import utc_now

    now = utc_now()
    suspended = 0
    async for owner in db.users.find(
        {"role": "owner", "subscription_status": "trial", "trial_ends_at": {"$lt": now}}
    ):
        await db.users.update_one({"_id": owner["_id"]}, {"$set": {"subscription_status": "expired"}})

        organization_id = owner.get("organization_id")
        if not organization_id:
            continue
        result = await db.organizations.update_one(
            {"organization_id": organization_id, "telnyx_setup_status": "active"},
            {"$set": {"telnyx_setup_status": "suspended"}},
        )
        if result.modified_count:
            suspended += 1

    return suspended


@shared_task(bind=True, name="subscription.enforce_trial_expiry", max_retries=1)
def enforce_trial_expiry_task(self) -> int:
    try:
        import asyncio

        from app.core.database import get_database

        async def _run() -> int:
            db = await get_database()
            return await _enforce_trial_expiry(db)

        return asyncio.run(_run())
    except Exception as exc:
        logger.exception("enforce_trial_expiry_task failed: %s", exc)
        raise self.retry(exc=exc)
