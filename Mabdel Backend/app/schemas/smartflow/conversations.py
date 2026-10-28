from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field
from app.schemas.smartflow._types import PlatformType, ConversationType

class ConversationCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    contact_id: str | None = None
    member_ids: list[str] = Field(default_factory=list)
    type: ConversationType = "direct"
    platform: PlatformType = "whatsapp"


class ConversationAssignRequest(BaseModel):
    assignee_id: str | None = Field(default=None, max_length=64)


ConversationStatus = Literal["new", "read", "completed"]


class ConversationStatusUpdateRequest(BaseModel):
    status: ConversationStatus


class ConversationResponse(BaseModel):
    id: str
    title: str | None = None
    type: ConversationType
    platform: PlatformType
    platform_label: str = "WhatsApp"
    platform_icon_key: str = "whatsapp"
    platform_badge_color: str = "#25D366"
    member_ids: list[str] = Field(default_factory=list)
    archived: bool = False
    avatar_url: str | None = None
    presence: str = "offline"
    presence_label: str = "Offline"
    is_ai_assistant: bool = False
    is_group: bool = False
    contact_name: str | None = None
    participant_preview: list[str] = Field(default_factory=list)
    member_count: int = 0
    last_message_preview: str | None = None
    last_message_sender_name: str | None = None
    unread_count: int = 0
    has_unread: bool = False
    delivery_state: str | None = None
    display_time_label: str | None = None
    status: ConversationStatus = "new"
    updated_at: datetime
