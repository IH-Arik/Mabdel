from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, model_validator
from app.schemas.smartflow._types import CallMeetingRequestStatus

class ProviderWorkingHours(BaseModel):
    start_hour: int = Field(ge=0, le=23)
    end_hour: int = Field(ge=1, le=24)

    @model_validator(mode="after")
    def validate_range(self):
        if self.end_hour <= self.start_hour:
            raise ValueError("Closing hour must be after opening hour.")
        return self


class BusinessLocationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    address: str | None = Field(default=None, max_length=500)
    capacity: int = Field(default=1, ge=1, le=1000)
    working_days: list[Annotated[int, Field(ge=0, le=6)]] | None = Field(default=None, max_length=7)
    working_hours: ProviderWorkingHours | None = None


class BusinessLocationUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    address: str | None = Field(default=None, max_length=500)
    capacity: int | None = Field(default=None, ge=1, le=1000)
    active: bool | None = None
    working_days: list[Annotated[int, Field(ge=0, le=6)]] | None = Field(default=None, max_length=7)
    working_hours: ProviderWorkingHours | None = None


class ProviderCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    role_title: str | None = Field(default=None, max_length=60)
    # A real team member's user id, when this provider is a colleague and not a
    # login-less named resource (a chair, a technician with no account).
    linked_user_id: str | None = None
    # When unset, this provider is assumed available whenever the business itself is
    # open (today's behavior, unchanged) - set only to restrict further, e.g. a
    # specialist who only works Tue/Thu.
    working_days: list[Annotated[int, Field(ge=0, le=6)]] | None = Field(default=None, max_length=7)
    working_hours: ProviderWorkingHours | None = None

    location_ids: list[str] | None = Field(default=None, max_length=50)


class ProviderUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    role_title: str | None = Field(default=None, max_length=60)
    linked_user_id: str | None = None
    active: bool | None = None
    working_days: list[Annotated[int, Field(ge=0, le=6)]] | None = Field(default=None, max_length=7)
    working_hours: ProviderWorkingHours | None = None

    location_ids: list[str] | None = Field(default=None, max_length=50)


class AppointmentTypeCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    duration_minutes: int = Field(ge=5, le=480)
    # When empty/unset, any provider can perform this type (today's behavior,
    # unchanged) - set to restrict it to specific providers only.
    eligible_provider_ids: list[str] | None = Field(default=None, max_length=50)

    eligible_location_ids: list[str] | None = Field(default=None, max_length=50)


class AppointmentTypeUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    duration_minutes: int | None = Field(default=None, ge=5, le=480)
    active: bool | None = None
    eligible_provider_ids: list[str] | None = Field(default=None, max_length=50)

    eligible_location_ids: list[str] | None = Field(default=None, max_length=50)


class AICallTestStartResponse(BaseModel):
    session_id: str
    greeting: str


class AICallTestMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class AICallTestMessageResponse(BaseModel):
    reply: str
    ended: bool


class CalendarProviderSettingsUpdateRequest(BaseModel):
    provider: str | None = Field(default=None, max_length=32)


class CallMeetingRequestResponse(BaseModel):
    id: str
    organization_id: str
    call_sid: str | None = None
    caller_name: str
    caller_email: str | None = None
    caller_phone: str | None = None
    requested_start: datetime
    requested_end: datetime
    status: CallMeetingRequestStatus
    meeting_link: str | None = None
    confirmed_by_user_id: str | None = None
    created_at: datetime
    updated_at: datetime
