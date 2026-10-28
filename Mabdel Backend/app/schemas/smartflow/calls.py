from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field
from app.schemas.smartflow._types import CallType, CallStatus
from app.schemas.smartflow.ai_call_settings import OutboundCallPurpose

class CallLogCreateRequest(BaseModel):
    contact_id: str | None = None
    contact_name: str | None = Field(default=None, max_length=120)
    call_type: CallType
    phone_number: str | None = Field(default=None, max_length=40)
    scheduled_at: datetime | None = None
    duration: int = Field(default=0, ge=0)
    ai_ready: bool = False
    callback_requested: bool = False
    recording_url: str | None = Field(default=None, max_length=1000)
    transcript: str | None = Field(default=None, max_length=50000)
    ai_summary: dict[str, Any] | None = None


class CallLogUpdateRequest(BaseModel):
    call_type: CallType | None = None
    contact_name: str | None = Field(default=None, max_length=120)
    phone_number: str | None = Field(default=None, max_length=40)
    scheduled_at: datetime | None = None
    duration: int | None = Field(default=None, ge=0)
    ai_ready: bool | None = None
    callback_requested: bool | None = None
    status: CallStatus | None = None
    recording_url: str | None = Field(default=None, max_length=1000)
    transcript: str | None = Field(default=None, max_length=50000)
    ai_summary: dict[str, Any] | None = None


class CallTranscriptUpdateRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=50000)
    speaker_segments: list[dict[str, Any]] = Field(default_factory=list)


class CallAISummaryUpdateRequest(BaseModel):
    purpose: str | None = Field(default=None, max_length=500)
    key_points: list[str] = Field(default_factory=list)
    action_items: list[str] = Field(default_factory=list)
    highlights: list[dict[str, Any]] = Field(default_factory=list)


class CallRecordingUpdateRequest(BaseModel):
    recording_url: str = Field(min_length=5, max_length=1000)
    recording_duration: int | None = Field(default=None, ge=0)


class CallLogResponse(BaseModel):
    id: str
    contact_id: str | None = None
    contact_name: str | None = None
    contact: dict[str, Any] | None = None
    phone_number: str | None = None
    call_type: CallType
    call_type_label: str = "Call"
    scheduled_at: datetime | None = None
    duration: int
    duration_label: str = "--"
    ai_ready: bool
    callback_requested: bool
    timestamp: datetime
    display_time_label: str | None = None
    date_bucket: Literal["today", "yesterday", "older"] = "older"
    status: CallStatus
    status_label: str = "Completed"
    status_tone: str = "muted"
    twilio_call_sid: str | None = None
    from_number: str | None = None
    recording_url: str | None = None
    recording_available: bool = False
    transcript: str | None = None
    transcript_available: bool = False
    speaker_segments: list[dict[str, Any]] = Field(default_factory=list)
    ai_summary: dict[str, Any] | None = None
    ai_summary_available: bool = False
    repeat_count: int = 1
    initials: str = "NA"
    actions: list[str] = Field(default_factory=list)
    disposition: str | None = None
    disposition_label: str | None = None


class OutboundCallRequest(BaseModel):
    contact_id: str | None = None
    phone_number: str | None = None
    from_number: str | None = None
    ai_ready: bool = True
    # Which configured OutboundCallPurpose this call is about - looked up by id from
    # the org's own ai_call_settings.outbound_call_purposes at call time (see
    # realtime_receptionist.py). Free string rather than a fixed enum so the owner's
    # own named purposes work here, not just the 3 legacy built-in ones; an unknown id
    # just falls back to a generic outbound framing rather than failing the call.
    purpose: str = Field(default="follow_up", max_length=64)
    script_notes: str | None = Field(default=None, max_length=1000)


class OutboundCallResponse(BaseModel):
    call_log: CallLogResponse
    twilio_call_sid: str
    twilio_status: str
