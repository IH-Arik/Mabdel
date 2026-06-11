from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class PermissionsIdentifier(BaseModel):
    user_id: str | None = Field(default=None, examples=["user_123"])
    device_id: str | None = Field(default=None, examples=["device_abc"])

    @model_validator(mode="after")
    def validate_identifier(self) -> "PermissionsIdentifier":
        if not self.user_id and not self.device_id:
            raise ValueError("Either user_id or device_id must be provided.")
        return self


class PermissionToggle(BaseModel):
    key: str
    title: str
    description: str
    enabled: bool
    recommended: bool = True


class PermissionsResponseData(BaseModel):
    user_id: str | None = None
    device_id: str | None = None
    permissions: list[PermissionToggle]
    privacy_message_title: str = "PRIVACY SECURED"
    privacy_message_body: str = "Mabdel uses end-to-end encryption for all shared data."
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PermissionsUpdateRequest(PermissionsIdentifier):
    microphone_enabled: bool = True
    notifications_enabled: bool = True
    contacts_enabled: bool = False


class AcceptAllPermissionsRequest(PermissionsIdentifier):
    pass
