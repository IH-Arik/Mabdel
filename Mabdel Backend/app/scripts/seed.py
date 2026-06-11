from __future__ import annotations

import asyncio

from app.core.database import close_database_connection, get_database
from app.repositories.app_config_repository import AppConfigRepository
from app.repositories.onboarding_repository import OnboardingRepository
from app.services.content_service import ContentService


async def seed_initial_data() -> None:
    db = await get_database()
    await AppConfigRepository(db).ensure_defaults()
    await OnboardingRepository(db).ensure_default_slides()
    await ContentService(db).ensure_defaults()


async def _run() -> None:
    try:
        await seed_initial_data()
    finally:
        await close_database_connection()


if __name__ == "__main__":
    asyncio.run(_run())
