from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

class UserReportCreateRequest(BaseModel):
    category: Literal["bug", "billing", "account", "ai_response", "abuse", "other"] = "other"
    subject: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=10, max_length=3000)
    screen: str | None = Field(default=None, max_length=120)
    metadata: dict[str, Any] = Field(default_factory=dict)


class SupportTicketCreateRequest(BaseModel):
    topic: Literal["general", "account", "billing", "technical", "feature_request"] = "general"
    subject: str = Field(min_length=3, max_length=160)
    message: str = Field(min_length=10, max_length=3000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str | None = Field(default=None, min_length=8, max_length=128)

    @model_validator(mode="after")
    def validate_passwords_match(self) -> "ChangePasswordRequest":
        if self.confirm_password is not None and self.new_password != self.confirm_password:
            raise ValueError("new_password and confirm_password must match.")
        return self


class SupportSessionCreateRequest(BaseModel):
    topic: Literal["general", "billing", "technical", "account"] = "general"


class SupportMessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=3000)
    topic: Literal["general", "billing", "technical", "account"] | None = None
    attachment_url: str | None = Field(default=None, max_length=1000)


class SupportMessageResponse(BaseModel):
    id: str
    session_id: str
    sender_type: Literal["user", "support", "system"]
    sender_name: str
    sender_avatar_url: str | None = None
    content: str
    attachment_url: str | None = None
    created_at: datetime


class SupportSessionResponse(BaseModel):
    id: str
    status: Literal["open", "closed"]
    topic: str = "general"
    agent: dict[str, Any]
    quick_replies: list[dict[str, str]] = Field(default_factory=list)
    support_typing: bool = False
    started_at: datetime
    updated_at: datetime
    latest_messages: list[SupportMessageResponse] = Field(default_factory=list)
