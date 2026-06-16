from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    full_name: str
    email: EmailStr
    password_hash: str
    is_verified: bool = False
    auth_provider: str = "email"
    avatar_url: str | None = None
    date_of_birth: date | None = None
    country: str | None = None
    phone_number: str | None = None
    forwarding_number: str | None = None
    language_preference: str = "EN"
    role: str = "user"
    organization_id: str | None = None
    # Twilio sub-account provisioning (platform-managed)
    twilio_sub_account_sid: str | None = None
    twilio_sub_auth_token_enc: str | None = None  # encrypted at rest
    twilio_phone_number: str | None = None
    twilio_setup_status: str = "not_provisioned"  # not_provisioned | provisioning | active | failed
    # Twilio custom credentials (user-provided)
    twilio_mode: str = "not_set"  # not_set | platform | custom
    twilio_custom_account_sid: str | None = None
    twilio_custom_auth_token_enc: str | None = None  # encrypted at rest
    twilio_custom_phone_number: str | None = None
    created_at: datetime
    updated_at: datetime
