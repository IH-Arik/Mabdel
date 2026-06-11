from __future__ import annotations

from datetime import UTC, datetime

from motor.motor_asyncio import AsyncIOMotorDatabase


class AppConfigRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def get_latest_config(self) -> dict | None:
        return await self.db.app_configs.find_one(sort=[("updated_at", -1), ("created_at", -1)])

    async def create_default_config(self) -> dict:
        now = datetime.now(UTC)
        config = {
            "app_name": "Mabdel AI",
            "maintenance_mode": False,
            "force_update": False,
            "minimum_supported_version": "1.0.0",
            "latest_version": "1.2.0",
            "default_language": "en",
            "created_at": now,
            "updated_at": now,
        }
        await self.db.app_configs.insert_one(config)
        return config

    async def get_feature_flags(self) -> list[dict]:
        return await self.db.feature_flags.find().sort("key", 1).to_list(length=100)

    async def ensure_defaults(self) -> None:
        if not await self.get_latest_config():
            await self.create_default_config()

        default_flags = [
            {
                "key": "voice_assistant",
                "is_enabled": True,
                "description": "Enable voice assistant in onboarding and main app.",
            },
            {
                "key": "notifications",
                "is_enabled": True,
                "description": "Enable notifications module.",
            },
            {
                "key": "contacts_sync",
                "is_enabled": True,
                "description": "Enable contacts synchronization.",
            },
        ]

        for flag in default_flags:
            existing = await self.db.feature_flags.find_one({"key": flag["key"]})
            if not existing:
                await self.db.feature_flags.insert_one(flag)
