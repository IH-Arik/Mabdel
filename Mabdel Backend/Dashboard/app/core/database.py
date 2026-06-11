from __future__ import annotations

import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

from Dashboard.app.core.config import settings
from Dashboard.app.core.exceptions import AppException

logger = logging.getLogger(__name__)


class MongoConnectionManager:
    def __init__(self) -> None:
        self.client: AsyncIOMotorClient | None = None
        self.database: AsyncIOMotorDatabase | None = None

    async def connect(self) -> AsyncIOMotorDatabase:
        if self.database is None:
            try:
                self.client = AsyncIOMotorClient(
                    settings.MONGODB_URI,
                    serverSelectionTimeoutMS=settings.MONGODB_CONNECT_TIMEOUT_MS,
                    connectTimeoutMS=settings.MONGODB_CONNECT_TIMEOUT_MS,
                )
                self.database = self.client[settings.DATABASE_NAME]
                await self.ensure_indexes()
            except PyMongoError as exc:
                if self.client:
                    self.client.close()
                self.client = None
                self.database = None
                logger.exception("MongoDB connection failed database=%s", settings.DATABASE_NAME)
                raise AppException(
                    status_code=503,
                    code="DATABASE_UNAVAILABLE",
                    message="Database is unavailable. Check MONGODB_URI and database network access.",
                ) from exc
        return self.database

    async def close(self) -> None:
        if self.client:
            self.client.close()
        self.client = None
        self.database = None

    async def ensure_indexes(self) -> None:
        if self.database is None:
            return
        await self.database.users.create_index("email", unique=True)
        await self.database.users.create_index([("role", 1), ("status", 1)])
        await self.database.users.create_index([("organization_id", 1), ("created_at", -1)])
        await self.database.notifications.create_index([("user_id", 1), ("created_at", -1)])
        await self.database.notifications.create_index([("user_id", 1), ("is_read", 1)])
        await self.database.invoices.create_index([("organization_id", 1), ("created_at", -1)])
        await self.database.user_reports.create_index([("created_at", -1)])
        await self.database.ai_logs.create_index([("timestamp", -1)])
        await self.database.otps.create_index("expire_at", expireAfterSeconds=0)


mongo_manager = MongoConnectionManager()


async def get_database() -> AsyncIOMotorDatabase:
    return await mongo_manager.connect()


async def close_database_connection() -> None:
    await mongo_manager.close()
