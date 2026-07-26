from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

MeetingRequestStatus = Literal["pending", "proposed", "confirmed", "declined"]


class MeetingRequestCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str | None = Field(None, max_length=32)
    requested_start: datetime
    requested_end: datetime
    timezone: str | None = None
    notes: str | None = Field(None, max_length=2000)


class MeetingProposeRequest(BaseModel):
    proposed_start: datetime
    proposed_end: datetime
    note: str | None = Field(None, max_length=2000)


class MeetingConfirmRequest(BaseModel):
    pass
