from __future__ import annotations

import asyncio
import logging

from celery import shared_task

logger = logging.getLogger(__name__)

POLLING_PLATFORMS = ("snapchat",)


@shared_task(bind=True, name="social.sync_polling_platforms", max_retries=2, default_retry_delay=60)
def sync_polling_platforms_task(self) -> dict:
    """Auto-sync platforms that have no webhooks (e.g. Snapchat). Runs every 5 minutes via beat."""
    try:
        from app.core.database import mongo_manager
        from app.services.smartflow.integration_service import IntegrationService
        from app.services.smartflow.conversation_service import ConversationService

        async def _run() -> dict:
            db = mongo_manager.get_database()
            service = IntegrationService(db, ConversationService(db))
            results: list[dict] = []

            for platform in POLLING_PLATFORMS:
                integrations = await db.social_integrations.find(
                    {"platform": platform, "status": "connected"}
                ).to_list(length=200)

                for integration in integrations:
                    user_id = integration["user_id"]
                    try:
                        result = await service.sync_integration(user_id, platform)
                        results.append({"user_id": user_id, "platform": platform, **result})
                    except Exception as exc:
                        logger.warning("sync failed user=%s platform=%s: %s", user_id, platform, exc)
                        results.append({"user_id": user_id, "platform": platform, "sync_status": "error", "error": str(exc)})

            return {"synced": len(results), "results": results}

        return asyncio.run(_run())
    except Exception as exc:
        logger.exception("sync_polling_platforms_task failed: %s", exc)
        raise self.retry(exc=exc)
