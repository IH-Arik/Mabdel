from __future__ import annotations

import asyncio
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="caldav.sync_connections", max_retries=2, default_retry_delay=60)
def sync_caldav_connections_task(self) -> dict:
    """Pull inbound changes from every connected Apple/CalDAV calendar. Runs every 5 minutes via beat."""
    try:
        from app.core.database import mongo_manager
        from app.services.smartflow.caldav_service import CalDAVService

        async def _run() -> dict:
            db = mongo_manager.get_database()
            service = CalDAVService(db)
            results: list[dict] = []

            connections = await db.caldav_connections.find({"status": "connected"}).to_list(length=200)
            for connection in connections:
                user_id = connection["user_id"]
                try:
                    result = await service.pull_changes(user_id)
                    results.append({"user_id": user_id, **result})
                except Exception as exc:
                    logger.warning("caldav sync failed user=%s: %s", user_id, exc)
                    results.append({"user_id": user_id, "error": str(exc)})

            return {"synced": len(results), "results": results}

        return asyncio.run(_run())
    except Exception as exc:
        logger.exception("sync_caldav_connections_task failed: %s", exc)
        raise self.retry(exc=exc)
