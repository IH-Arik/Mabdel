from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CallStreamEvent(BaseModel):
    event: str
    call_id: str
    stream_sid: str | None = None
    bytes_received: int | None = None
    message: str | None = None


class TwilioWebhookPayload(BaseModel):
    call_sid: str | None = Field(default=None, alias="CallSid")
    from_number: str | None = Field(default=None, alias="From")
    to_number: str | None = Field(default=None, alias="To")
    call_status: str | None = Field(default=None, alias="CallStatus")
    stream_sid: str | None = Field(default=None, alias="StreamSid")

    model_config = {"populate_by_name": True}


class TwilioStatusCallbackPayload(BaseModel):
    call_sid: str | None = Field(default=None, alias="CallSid")
    call_status: str | None = Field(default=None, alias="CallStatus")
    call_duration: str | None = Field(default=None, alias="CallDuration")
    from_number: str | None = Field(default=None, alias="From")
    to_number: str | None = Field(default=None, alias="To")

    model_config = {"populate_by_name": True}


class TwilioStreamMessage(BaseModel):
    event: str
    sequence_number: str | None = Field(default=None, alias="sequenceNumber")
    stream_sid: str | None = Field(default=None, alias="streamSid")
    start: dict[str, Any] | None = None
    media: dict[str, Any] | None = None
    stop: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}


class CallActionRequest(BaseModel):
    action: str  # "receive", "transfer_to_ai", "cancel"
    user_id: str
