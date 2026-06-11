from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CalendarEventRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=160)
    description: str | None = Field(None, max_length=1000)
    location: str | None = Field(None, max_length=255)
    starts_at: datetime
    ends_at: datetime
    attendees: list[str] = Field(default_factory=list, description="List of participant identifiers (emails or user IDs)")
    notify_via: list[Literal["push", "email", "sms"]] = Field(default_factory=list)
    reminder_time: int = Field(15, description="Minutes before event to send reminder")


class CalendarEventResponse(BaseModel):
    id: str
    title: str
    description: str | None = None
    location: str | None = None
    starts_at: datetime
    ends_at: datetime
    attendees: list[str] = Field(default_factory=list)
    status: str = "scheduled"
    created_at: datetime
