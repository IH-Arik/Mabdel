from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field
from app.schemas.smartflow._types import PlatformType, IntegrationStatus

class SocialIntegrationUpsertRequest(BaseModel):
    platform: PlatformType
    access_token: str = Field(min_length=1)
    refresh_token: str | None = None
    external_account_id: str | None = None
    external_account_name: str | None = None
    provider_metadata: dict[str, Any] | None = None


class TelegramManualConnectRequest(BaseModel):
    bot_token: str = Field(min_length=10, max_length=255)
    bot_username: str | None = Field(default=None, max_length=255)
    secret_token: str | None = Field(default=None, min_length=8, max_length=255)


class TelegramManualConnectResponse(BaseModel):
    connected: bool = True
    platform: Literal["telegram"] = "telegram"
    webhook_url: str
    secret_token: str
    integration: SocialIntegrationResponse


class CalDAVConnectRequest(BaseModel):
    username: str = Field(min_length=3, max_length=255)
    app_password: str = Field(min_length=8, max_length=255)
    server_url: str | None = Field(default=None, max_length=255)


class WhatsAppConnectStatusResponse(BaseModel):
    status: Literal["pending_qr", "connected", "disconnected"]
    qr_data_url: str | None = None
    linked_number: str | None = None



class SocialIntegrationResponse(BaseModel):
    id: str
    platform: PlatformType
    status: IntegrationStatus
    connected: bool = False
    platform_label: str = "WhatsApp"
    description: str | None = None
    icon_key: str | None = None
    brand_color: str | None = None
    cta_label: str = "Connect"
    is_available: bool = True
    is_configured: bool = False
    auth_mode: Literal["oauth", "manual", "hybrid"] = "oauth"
    health_status: Literal["connected", "disconnected", "pending", "needs_reauth", "misconfigured", "error"] = "disconnected"
    external_account_id: str | None = None
    external_account_name: str | None = None
    sync_status: Literal["idle", "syncing", "synced", "needs_provider_access", "unsupported_by_provider", "error"] = "idle"
    last_sync_at: datetime | None = None
    last_error: str | None = None
    message_sync_enabled: bool = False
    webhook_status: Literal["not_configured", "configured", "active", "error"] = "not_configured"
    connected_at: datetime | None = None
    last_webhook_at: datetime | None = None


class SocialIntegrationCatalogItem(BaseModel):
    platform: PlatformType
    platform_label: str
    description: str
    icon_key: str
    brand_color: str
    status: Literal["connected", "disconnected", "pending", "needs_reauth", "misconfigured", "error"]
    connected: bool = False
    cta_label: str = "Connect"
    is_available: bool = True
    is_configured: bool = False
    auth_mode: Literal["oauth", "manual", "hybrid"] = "oauth"
    external_account_id: str | None = None
    external_account_name: str | None = None
    sync_status: Literal["idle", "syncing", "synced", "needs_provider_access", "unsupported_by_provider", "error"] = "idle"
    last_sync_at: datetime | None = None
    last_error: str | None = None
    message_sync_enabled: bool = False
    webhook_status: Literal["not_configured", "configured", "active", "error"] = "not_configured"
    connected_at: datetime | None = None
    last_webhook_at: datetime | None = None


class WebhookMessageRequest(BaseModel):
    event_id: str = Field(min_length=1)
    contact_external_id: str = Field(min_length=1)
    content: str = Field(min_length=1)
    media_url: str | None = None
    timestamp: datetime | None = None
