from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator
from app.schemas.smartflow._types import PlatformType, MessageDirection, MessageStatus

class MessageAttachment(BaseModel):
    type: Literal["image", "document", "audio", "video", "file"] = "file"
    url: str = Field(min_length=5, max_length=1000)
    file_name: str | None = Field(default=None, max_length=255)
    mime_type: str | None = Field(default=None, max_length=120)
    file_size_bytes: int | None = Field(default=None, ge=0)
    thumbnail_url: str | None = Field(default=None, max_length=1000)


class MessageMentionRef(BaseModel):
    contact_id: str = Field(min_length=1)
    name: str | None = Field(default=None, max_length=120)


class MessageCreateRequest(BaseModel):
    conversation_id: str
    contact_id: str | None = None
    platform: PlatformType
    direction: MessageDirection
    content: str | None = None
    media_url: str | None = None
    attachments: list[MessageAttachment] = Field(default_factory=list)
    mentions: list[str] = Field(default_factory=list)
    reply_to_message_id: str | None = None
    forward_from_message_id: str | None = None

    @model_validator(mode="after")
    def validate_message_body(self) -> "MessageCreateRequest":
        text = (self.content or "").strip()
        if not text and not self.media_url and not self.attachments:
            raise ValueError("Message content, media_url, or attachments are required.")
        self.content = text
        return self


class MessageUpdateRequest(BaseModel):
    status: MessageStatus | None = None
    is_archived: bool | None = None
    unread_count: int | None = Field(default=None, ge=0)


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    contact_id: str | None = None
    platform: PlatformType
    direction: MessageDirection
    content: str
    media_url: str | None = None
    attachments: list[MessageAttachment] = Field(default_factory=list)
    attachment_count: int = 0
    has_attachments: bool = False
    mentions: list[MessageMentionRef] = Field(default_factory=list)
    status: MessageStatus
    timestamp: datetime
    unread_count: int = 0
    is_archived: bool = False
    read_at: datetime | None = None
    delivered_at: datetime | None = None
    is_read: bool = False
    read_receipt_label: str | None = None
    status_timestamps: dict[str, datetime | None] = Field(default_factory=dict)
    reply_to_message_id: str | None = None
    forward_from_message_id: str | None = None
    reply_to_message_preview: dict[str, Any] | None = None
    forward_from_message_preview: dict[str, Any] | None = None
    sender_name: str | None = None
    sender_avatar_url: str | None = None
    sender_presence: str | None = None
    sender_is_self: bool = False
class ReplyMessageRequest(BaseModel):
    content: str | None = None
    platform: PlatformType
    contact_id: str | None = None
    media_url: str | None = None
    attachments: list[MessageAttachment] = Field(default_factory=list)
    mentions: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_message_body(self) -> "ReplyMessageRequest":
        text = (self.content or "").strip()
        if not text and not self.media_url and not self.attachments:
            raise ValueError("Reply content, media_url, or attachments are required.")
        self.content = text
        return self


class ForwardMessageRequest(BaseModel):
    conversation_id: str
    platform: PlatformType
    contact_id: str | None = None
    content: str | None = Field(default=None, min_length=1)
    media_url: str | None = None
    attachments: list[MessageAttachment] | None = None
    mentions: list[str] | None = None


class TypingStateRequest(BaseModel):
    is_typing: bool = True
    actor_name: str | None = Field(default=None, max_length=120)
    actor_type: Literal["user", "ai", "contact"] = "ai"
    preview_text: str | None = Field(default=None, max_length=280)
    state_label: str | None = Field(default=None, max_length=80)


class TypingStateResponse(BaseModel):
    conversation_id: str
    is_typing: bool
    actor_name: str | None = None
    actor_type: Literal["user", "ai", "contact"] = "ai"
    preview_text: str | None = None
    state_label: str | None = None
    updated_at: datetime | None = None
    expires_at: datetime | None = None
