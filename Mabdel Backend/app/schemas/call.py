from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CallStreamEvent(BaseModel):
    event: str
    call_id: str
    stream_sid: str | None = None
    bytes_received: int | None = None
    message: str | None = None


# ── Telnyx (calls, SMS, provisioning) ───────────────────────────────────────


class TelnyxWebhookPayload(BaseModel):
    """The inner ``data.payload`` object of a Telnyx Call Control webhook."""

    call_control_id: str | None = None
    call_leg_id: str | None = None
    call_session_id: str | None = None
    connection_id: str | None = None
    client_state: str | None = None
    from_number: str | None = Field(default=None, alias="from")
    to_number: str | None = Field(default=None, alias="to")
    direction: str | None = None
    state: str | None = None
    hangup_cause: str | None = None
    hangup_source: str | None = None
    call_duration_secs: int | None = None
    recording_urls: dict[str, Any] | None = None

    model_config = {"populate_by_name": True}


class TelnyxWebhookEvent(BaseModel):
    """Top-level envelope: ``{"data": {"event_type": ..., "payload": {...}}}``."""

    event_type: str
    id: str | None = None
    occurred_at: str | None = None
    payload: TelnyxWebhookPayload = Field(default_factory=TelnyxWebhookPayload)


class TelnyxStreamMessage(BaseModel):
    """A single media-streaming websocket frame."""

    event: str
    sequence_number: str | None = None
    stream_id: str | None = None
    start: dict[str, Any] | None = None
    media: dict[str, Any] | None = None
    stop: dict[str, Any] | None = None


class CallActionRequest(BaseModel):
    action: str  # "receive", "transfer_to_ai", "cancel"
    user_id: str
