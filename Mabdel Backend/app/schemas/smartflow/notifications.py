from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field
from app.schemas.smartflow._types import NotificationType

class NotificationPreferences(BaseModel):
    general_notification: bool = True
    sound: bool = True
    vibrate: bool = True
    new_messages: bool = True
    missed_calls: bool = True
    scheduled_calls: bool = True
    ai_tasks: bool = True
    calendar_reminders: bool = True


class NotificationSettingsUpdateRequest(BaseModel):
    general_notification: bool | None = None
    sound: bool | None = None
    vibrate: bool | None = None
    new_messages: bool | None = None
    missed_calls: bool | None = None
    scheduled_calls: bool | None = None
    ai_tasks: bool | None = None
    calendar_reminders: bool | None = None


class NotificationResponse(BaseModel):
    id: str
    type: NotificationType
    title: str
    body: str
    read: bool = False
    unread: bool = True
    icon_key: str = "bell"
    accent_tone: str = "neutral"
    date_bucket: Literal["today", "earlier"] = "earlier"
    display_time_label: str
    primary_action: str | None = None
    action_url: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class PushTokenRequest(BaseModel):
    device_id: str = Field(min_length=1)
    token: str = Field(min_length=8)
    platform: Literal["ios", "android", "web"] = "ios"
