from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field
from app.schemas.smartflow._types import BulkMessageChannel, BulkMessageStatus, BulkRecipientStatus

class BulkMessageRecipientRef(BaseModel):
    id: str | None = None
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    avatar_url: str | None = None
    initials: str | None = None
    source: Literal["contact", "group_member", "raw_email", "raw_phone"]


class BulkMessageAttachment(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    url: str = Field(min_length=5, max_length=1000)


class BulkRecipientValidationRequest(BaseModel):
    channel: BulkMessageChannel = "email"
    recipient_emails: list[str] = Field(default_factory=list)
    contact_ids: list[str] = Field(default_factory=list)
    group_ids: list[str] = Field(default_factory=list)


class BulkRecipientValidationResponse(BaseModel):
    channel: BulkMessageChannel
    valid_count: int = 0
    invalid_count: int = 0
    duplicate_count: int = 0
    recipients: list[BulkMessageRecipientRef] = Field(default_factory=list)
    invalid_entries: list[str] = Field(default_factory=list)
    duplicate_entries: list[str] = Field(default_factory=list)
    unavailable_contact_ids: list[str] = Field(default_factory=list)
    unavailable_group_ids: list[str] = Field(default_factory=list)


class BulkMessageImproveRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class BulkMessageCreateRequest(BaseModel):
    channel: BulkMessageChannel = "email"
    recipient_emails: list[str] = Field(default_factory=list)
    contact_ids: list[str] = Field(default_factory=list)
    group_ids: list[str] = Field(default_factory=list)
    subject: str | None = Field(default=None, min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=5000)
    attachments: list[BulkMessageAttachment] = Field(default_factory=list)
    scheduled_at: datetime | None = None
    timezone: str = Field(default="UTC", max_length=64)
    send_now: bool = True
    ai_transcript: str | None = None
    # Local part of the sender address on the organization's verified domain
    # (e.g. "market" -> market@dentist.gocustify.com). Email channel only.
    from_prefix: str | None = Field(default=None, max_length=64)


class BulkMessageUpdateRequest(BaseModel):
    recipient_emails: list[str] | None = None
    contact_ids: list[str] | None = None
    group_ids: list[str] | None = None
    subject: str | None = Field(default=None, max_length=200)
    content: str | None = Field(default=None, min_length=1, max_length=5000)
    attachments: list[BulkMessageAttachment] | None = None
    scheduled_at: datetime | None = None
    timezone: str | None = Field(default=None, max_length=64)
    send_now: bool | None = None
    ai_transcript: str | None = None
    from_prefix: str | None = Field(default=None, max_length=64)


class BulkMessageRecipientDelivery(BaseModel):
    target: str
    contact_id: str | None = None
    name: str | None = None
    status: BulkRecipientStatus
    error: str | None = None
    sent_at: datetime | None = None


class BulkMessageResponse(BaseModel):
    id: str
    channel: BulkMessageChannel
    status: BulkMessageStatus
    subject: str | None = None
    content: str
    attachments: list[BulkMessageAttachment] = Field(default_factory=list)
    recipient_emails: list[str] = Field(default_factory=list)
    contact_ids: list[str] = Field(default_factory=list)
    group_ids: list[str] = Field(default_factory=list)
    recipients: list[BulkMessageRecipientRef] = Field(default_factory=list)
    deliveries: list[BulkMessageRecipientDelivery] = Field(default_factory=list)
    scheduled_at: datetime | None = None
    timezone: str = "UTC"
    ai_transcript: str | None = None
    character_count: int = 0
    segment_count: int = 0
    sent_count: int = 0
    failed_count: int = 0
    from_email: str | None = None
    from_name: str | None = None
    created_at: datetime
    updated_at: datetime
    sent_at: datetime | None = None
