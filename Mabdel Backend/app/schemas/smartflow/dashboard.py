from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, EmailStr, Field
from app.schemas.smartflow.notifications import NotificationPreferences
from app.schemas.smartflow.social_integrations import SocialIntegrationResponse

class SettingsResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    is_verified: bool = True
    email_verification_required: bool = False
    avatar_url: str | None = None
    date_of_birth: date | None = None
    country: str | None = None
    language_preference: str = "EN"
    notification_preferences: NotificationPreferences
    integrations: list[SocialIntegrationResponse] = Field(default_factory=list)


class HomeDashboardResponse(BaseModel):
    greeting_name: str
    language_preference: str = "EN"
    inbox: dict[str, Any]
    contacts: dict[str, Any]
    calendar: dict[str, Any]
    integrations: dict[str, Any]
    documents: dict[str, Any]
    ai_call_analytics: dict[str, Any]
    notifications: dict[str, Any]
