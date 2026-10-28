from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator
from app.schemas.smartflow.notifications import NotificationPreferences, NotificationSettingsUpdateRequest

class SettingsUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    avatar_url: str | None = None
    date_of_birth: date | None = None
    country: str | None = Field(default=None, max_length=120)
    language_preference: str | None = Field(default=None, min_length=2, max_length=10)
    notification_preferences: NotificationSettingsUpdateRequest | None = None


class ProfileResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    is_verified: bool
    email_verification_required: bool = False
    avatar_url: str | None = None
    date_of_birth: date | None = None
    country: str | None = None
    language_preference: str = "EN"
    notification_preferences: NotificationPreferences
    created_at: datetime | None = None
    updated_at: datetime | None = None


class BusinessAddress(BaseModel):
    street_address: str | None = Field(default=None, max_length=180)
    suite: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    postal_code: str | None = Field(default=None, max_length=40)
    country: str | None = Field(default=None, max_length=120)


class BusinessProfileUpdateRequest(BaseModel):
    business_name: str | None = Field(default=None, min_length=2, max_length=160)
    email: EmailStr | None = None
    phone_number: str | None = Field(default=None, max_length=40)
    website: str | None = Field(default=None, max_length=300)
    logo_url: str | None = Field(default=None, max_length=1000)
    office_address: BusinessAddress | None = None
    office_address_text: str | None = Field(default=None, max_length=600)

    @field_validator("website")
    @classmethod
    def normalize_website(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        if "://" not in cleaned:
            cleaned = f"https://{cleaned}"
        if "." not in cleaned.split("://", 1)[1]:
            raise ValueError("Website must include a valid domain.")
        return cleaned


class BusinessProfileResponse(BaseModel):
    id: str | None = None
    business_name: str | None = None
    email: EmailStr | None = None
    phone_number: str | None = None
    website: str | None = None
    logo_url: str | None = None
    office_address: BusinessAddress = Field(default_factory=BusinessAddress)
    office_address_text: str | None = None
    office_location_lines: list[str] = Field(default_factory=list)
    profile_completed: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None


class SubscriptionPlanResponse(BaseModel):
    code: str
    name: str
    description: str
    price_cents: int = Field(ge=0)
    currency: str = "USD"
    billing_interval: Literal["month", "year", "one_time"] = "month"
    features: list[str] = Field(default_factory=list)
    is_popular: bool = False
    is_active: bool = True
    display_order: int = 0


class CurrentSubscriptionResponse(BaseModel):
    status: Literal["active", "trialing", "past_due", "cancelled", "free"] = "free"
    plan: SubscriptionPlanResponse
    started_at: datetime | None = None
    renews_at: datetime | None = None
    cancelled_at: datetime | None = None
