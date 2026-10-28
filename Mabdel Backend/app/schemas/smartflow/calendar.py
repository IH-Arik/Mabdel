from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field
from app.schemas.smartflow._types import MeetingMode, MeetingStatus

class CalendarEventCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: str | None = None
    starts_at: datetime
    ends_at: datetime
    contact_ids: list[str] = Field(default_factory=list)
    meeting_mode: MeetingMode = "offline"
    location: str | None = Field(default=None, max_length=200)
    meeting_link: str | None = Field(default=None, max_length=500)
    notify_via_push: bool = True
    notify_via_email: bool = False
    notify_via_sms: bool = False
    timezone: str = Field(default="UTC", max_length=64)
    reminder_minutes: int = Field(default=15, ge=0, le=10080)
    google_event_id: str | None = None
    status: MeetingStatus = "scheduled"
    provider_id: str | None = None
    appointment_type_id: str | None = None

    location_id: str | None = None
    location_name: str | None = None


class CalendarEventUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    contact_ids: list[str] | None = None
    meeting_mode: MeetingMode | None = None
    location: str | None = Field(default=None, max_length=200)
    meeting_link: str | None = Field(default=None, max_length=500)
    notify_via_push: bool | None = None
    notify_via_email: bool | None = None
    notify_via_sms: bool | None = None
    timezone: str | None = Field(default=None, max_length=64)
    reminder_minutes: int | None = Field(default=None, ge=0, le=10080)
    google_event_id: str | None = None
    status: MeetingStatus | None = None
    provider_id: str | None = None
    appointment_type_id: str | None = None

    location_id: str | None = None
    location_name: str | None = None


class CalendarAttendeeResponse(BaseModel):
    id: str
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    avatar_url: str | None = None
    initials: str


class CalendarEventResponse(BaseModel):
    id: str
    title: str
    description: str | None = None
    starts_at: datetime
    ends_at: datetime
    contact_ids: list[str] = Field(default_factory=list)
    attendees: list[CalendarAttendeeResponse] = Field(default_factory=list)
    attendee_count: int = 0
    meeting_mode: MeetingMode = "offline"
    location: str | None = None
    meeting_link: str | None = None
    notify_via_push: bool = True
    notify_via_email: bool = False
    notify_via_sms: bool = False
    timezone: str = "UTC"
    reminder_minutes: int
    google_event_id: str | None = None
    sync_status: str = "local"
    status: MeetingStatus = "scheduled"
    share_url: str | None = None
    provider_id: str | None = None
    provider_name: str | None = None
    appointment_type_id: str | None = None
    appointment_type_name: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    location_id: str | None = None
    location_name: str | None = None


class CalendarEventShareRequest(BaseModel):
    channel: Literal["email", "link", "manual"] = "link"
    recipient_email: EmailStr | None = None
    message: str | None = Field(default=None, max_length=1000)


class CalendarEventShareResponse(BaseModel):
    event_id: str
    channel: Literal["email", "link", "manual"]
    recipient_email: EmailStr | None = None
    share_url: str | None = None
