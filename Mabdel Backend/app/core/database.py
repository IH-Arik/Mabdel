from __future__ import annotations

import logging
from urllib.parse import urlsplit, urlunsplit

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

from app.core.config import settings
from app.core.exceptions import AppException

logger = logging.getLogger(__name__)


def _redact_mongodb_uri(uri: str) -> str:
    try:
        parts = urlsplit(uri)
    except ValueError:
        return "<invalid-uri>"

    hostname = parts.hostname or ""
    if parts.port:
        hostname = f"{hostname}:{parts.port}"
    if not hostname:
        hostname = "<missing-host>"
    return urlunsplit((parts.scheme, hostname, parts.path, "", ""))


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
                logger.exception(
                    "MongoDB connection failed database=%s uri=%s",
                    settings.DATABASE_NAME,
                    _redact_mongodb_uri(settings.MONGODB_URI),
                )
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
        await self.database.users.create_index("device_tokens.device_id")
        await self.database.otp_codes.create_index([("email", 1), ("purpose", 1), ("created_at", -1)])
        await self.database.otp_codes.create_index("expires_at", expireAfterSeconds=0)
        await self.database.refresh_tokens.create_index("token", unique=True)
        await self.database.refresh_tokens.create_index("user_id")
        await self.database.refresh_tokens.create_index("expires_at", expireAfterSeconds=0)
        await self.database.contacts.create_index([("user_id", 1), ("name", 1)])
        await self.database.contacts.create_index([("user_id", 1), ("first_name", 1), ("last_name", 1)])
        await self.database.contacts.create_index([("user_id", 1), ("email", 1)])
        await self.database.contacts.create_index([("user_id", 1), ("phone", 1)])
        await self.database.contacts.create_index([("user_id", 1), ("identities.external_id", 1)])
        await self.database.conversations.create_index([("user_id", 1), ("updated_at", -1)])
        await self.database.conversations.create_index([("user_id", 1), ("platform", 1), ("updated_at", -1)])
        await self.database.messages.create_index([("user_id", 1), ("conversation_id", 1), ("timestamp", -1)])
        await self.database.messages.create_index([("user_id", 1), ("platform", 1), ("provider_message_id", 1)])
        await self.database.messages.create_index([("user_id", 1), ("content", "text")])
        await self.database.ai_command_history.create_index([("user_id", 1), ("timestamp", -1)])
        await self.database.call_logs.create_index([("user_id", 1), ("timestamp", -1)])
        await self.database.call_logs.create_index([("user_id", 1), ("contact_id", 1), ("timestamp", -1)])
        await self.database.call_logs.create_index([("user_id", 1), ("phone_number", 1), ("timestamp", -1)])
        await self.database.call_logs.create_index([("user_id", 1), ("status", 1), ("timestamp", -1)])
        await self.database.documents.create_index([("user_id", 1), ("type", 1)])
        await self.database.agreements.create_index([("user_id", 1), ("status", 1), ("updated_at", -1)])
        await self.database.agreements.create_index([("user_id", 1), ("agreement_type", 1), ("updated_at", -1)])
        await self.database.agreements.create_index("agreement_number", unique=True)
        await self.database.signature_requests.create_index("token", unique=True)
        await self.database.signature_requests.create_index([("agreement_id", 1), ("user_id", 1)], unique=True)
        await self.database.signature_requests.create_index([("user_id", 1), ("status", 1), ("updated_at", -1)])
        await self.database.calendar_events.create_index([("user_id", 1), ("starts_at", 1)])
        await self.database.notifications.create_index([("user_id", 1), ("created_at", -1)])
        await self.database.typing_states.create_index([("user_id", 1), ("conversation_id", 1)], unique=True)
        await self.database.typing_states.create_index("expires_at", expireAfterSeconds=0)
        await self.database.push_dispatch_jobs.create_index([("user_id", 1), ("status", 1), ("created_at", -1)])
        await self.database.push_dispatch_jobs.create_index([("notification_id", 1), ("device_id", 1)], unique=True)
        await self.database.social_integrations.create_index([("user_id", 1), ("platform", 1)], unique=True)
        await self.database.social_integrations.create_index([("status", 1), ("platform", 1)])
        await self.database.social_integrations.create_index([("platform", 1), ("external_account_id", 1)])
        await self.database.social_integrations.create_index([("platform", 1), ("telegram_secret_token", 1)])
        await self.database.business_profiles.create_index("user_id", unique=True)
        await self.database.content_pages.create_index("slug", unique=True)
        await self.database.subscription_plans.create_index("code", unique=True)
        await self.database.subscriptions.create_index([("user_id", 1), ("status", 1)])
        await self.database.user_reports.create_index([("user_id", 1), ("created_at", -1)])
        await self.database.support_tickets.create_index([("user_id", 1), ("created_at", -1)])
        await self.database.support_sessions.create_index([("user_id", 1), ("status", 1), ("updated_at", -1)])
        await self.database.support_messages.create_index([("user_id", 1), ("session_id", 1), ("created_at", 1)])
        await self.database.oauth_states.create_index("state", unique=True)
        await self.database.oauth_states.create_index("expires_at", expireAfterSeconds=0)
        await self.database.groups.create_index([("user_id", 1), ("created_at", -1)])
        await self.database.group_members.create_index([("group_id", 1), ("member_id", 1)], unique=True)
        await self.database.processed_webhooks.create_index([("platform", 1), ("event_id", 1)], unique=True)
        await self.database.app_configs.create_index([("updated_at", -1)])
        await self.database.feature_flags.create_index("key", unique=True)
        await self.database.onboarding_slides.create_index("id", unique=True)
        await self.database.onboarding_slides.create_index([("is_active", 1), ("sort_order", 1)])
        await self.database.onboarding_progress.create_index("id", unique=True)
        await self.database.onboarding_progress.create_index("user_id", unique=True, sparse=True)
        await self.database.onboarding_progress.create_index("device_id", unique=True, sparse=True)
        await self.database.invoices.create_index([("owner_user_id", 1), ("created_at", -1)])
        await self.database.invoices.create_index("invoice_number", unique=True)
        await self.database.invoices.create_index("share_token", unique=True, sparse=True)
        await self.database.invoices.create_index([("owner_user_id", 1), ("client_name", 1)])
        await self.database.invoices.create_index([("owner_user_id", 1), ("due_date", 1)])
        await self.database.counters.create_index("_id")

    async def ping(self) -> bool:
        if self.client is None:
            return False
        try:
            await self.client.admin.command("ping")
            return True
        except Exception:
            return False


mongo_manager = MongoConnectionManager()


async def get_database() -> AsyncIOMotorDatabase:
    return await mongo_manager.connect()


async def close_database_connection() -> None:
    await mongo_manager.close()
