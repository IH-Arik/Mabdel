from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str | None = Field(default=None, alias="_id")
    full_name: str
    email: EmailStr
    original_email: EmailStr | None = None
    password_hash: str
    is_verified: bool = False
    is_subordinate_account: bool = False
    created_by: str | None = None
    auth_provider: str = "email"
    avatar_url: str | None = None
    date_of_birth: date | None = None
    country: str | None = None
    phone_number: str | None = None
    forwarding_number: str | None = None
    language_preference: str = "EN"
    # ── RBAC ──────────────────────────────────────────────────────────────────
    # primary_role is the canonical slug used for quick checks and fallback.
    # Effective permissions are resolved via rbac_user_roles + rbac_roles collections.
    role: str = "user"  # legacy compat — mirrors primary role slug
    primary_role: str = "user"  # "super_admin" | "admin" | "owner" | "supervisor" | "staff" | "user"
    organization_id: str | None = None
    organization_name: str | None = None
    # Telnyx number provisioning is organization-level, not per-user — one number per
    # business, shared by every member with calls:manage permission. See the
    # ``organizations`` collection / app/services/telnyx_provisioning_service.py.
    # Browser (WebRTC) calling — this user's On-Demand Credential (their SIP identity).
    telnyx_credential_id: str | None = None
    telnyx_sip_username: str | None = None
    subscription_plan: str | None = None
    subscription_expiration: datetime | None = None
    created_at: datetime
    updated_at: datetime
