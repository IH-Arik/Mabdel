from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator

class GroupCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    member_ids: list[str] = Field(default_factory=list)
    admin_ids: list[str] = Field(default_factory=list)
    avatar_url: str | None = Field(default=None, max_length=1000)
    description: str | None = Field(default=None, max_length=500)
    role_slug: Literal["manager", "staff", "assistant"] | None = None


class GroupUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    member_ids: list[str] | None = None
    admin_ids: list[str] | None = None
    avatar_url: str | None = Field(default=None, max_length=1000)
    description: str | None = Field(default=None, max_length=500)
    role_slug: Literal["manager", "staff", "assistant"] | None = None


class GroupMemberResponse(BaseModel):
    id: str
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    avatar_url: str | None = None
    presence: str = "offline"
    role: Literal["owner", "admin", "member"] = "member"
    status: Literal["active", "pending"] = "active"
    is_self: bool = False


class GroupInviteRequest(BaseModel):
    email: EmailStr | None = None
    phone: str | None = None
    name: str | None = Field(default=None, max_length=120)
    role: Literal["member", "admin"] = "member"

    @model_validator(mode="after")
    def validate_target(self) -> "GroupInviteRequest":
        if not self.email and not self.phone:
            raise ValueError("Invite email or phone is required.")
        return self


class GroupInviteResponse(BaseModel):
    id: str
    email: EmailStr | None = None
    phone: str | None = None
    name: str | None = None
    role: Literal["member", "admin"] = "member"
    status: Literal["pending"] = "pending"
    invited_at: datetime


class GroupMemberAddRequest(BaseModel):
    member_ids: list[str] = Field(default_factory=list, min_length=1)
    admin_ids: list[str] = Field(default_factory=list)


class GroupMemberRoleUpdateRequest(BaseModel):
    role: Literal["admin", "member"]


class GroupResponse(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None
    description: str | None = None
    role_slug: Literal["manager", "staff", "assistant"] | None = None
    member_ids: list[str] = Field(default_factory=list)
    admin_ids: list[str] = Field(default_factory=list)
    members: list[GroupMemberResponse] = Field(default_factory=list)
    pending_invites: list[GroupInviteResponse] = Field(default_factory=list)
    member_count: int = 0
    pending_invite_count: int = 0
    admin_count: int = 0
    can_manage: bool = False
    can_leave: bool = True
    conversation_id: str | None = None
    created_at: datetime
    updated_at: datetime | None = None
