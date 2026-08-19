from __future__ import annotations

import base64
import json
import logging
from urllib.parse import urlencode

import telnyx
from fastapi import Request
from starlette import status

from app.core.config import settings
from app.core.exceptions import AppException
from app.schemas.call import CallStreamEvent, TelnyxStreamMessage, TelnyxWebhookEvent

logger = logging.getLogger(__name__)


class CallService:
    """Telephony via Telnyx Call Control.

    Unlike Twilio's per-purpose callback URLs (VoiceUrl/StatusCallback/RecordingStatusCallback),
    Telnyx sends every event for a connection to one webhook URL, tagged by ``event_type``. That
    single endpoint is registered once on the Call Control Application in the Telnyx portal (or
    via ``build_webhook_url`` + the provisioning API) — not per call.
    """

    def _client(self) -> telnyx.Client:
        if not settings.TELNYX_API_KEY:
            raise AppException(
                status_code=503,
                code="TELNYX_NOT_CONFIGURED",
                message="Telnyx is not configured on this server.",
            )
        return telnyx.Client(api_key=settings.TELNYX_API_KEY, public_key=settings.TELNYX_PUBLIC_KEY)

    def build_webhook_url(self) -> str:
        """The single Call Control webhook URL for every voice event.

        Prefers TELNYX_WEBHOOK_URL when set — that's the URL already registered on
        the Telnyx Voice Application, served by the unprefixed alias route so it
        doesn't need to change.
        """
        if settings.TELNYX_WEBHOOK_URL:
            return settings.TELNYX_WEBHOOK_URL
        return f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}{settings.API_V1_PREFIX}/calls/webhook"

    def build_media_stream_url(self, call_id: str) -> str:
        base_url = settings.PUBLIC_BACKEND_URL.rstrip("/")
        websocket_base = f"{base_url}{settings.API_V1_PREFIX}/calls/stream/{call_id}"
        if websocket_base.startswith("https://"):
            return "wss://" + websocket_base.removeprefix("https://")
        if websocket_base.startswith("http://"):
            return "ws://" + websocket_base.removeprefix("http://")
        return websocket_base

    # ── outbound actions ─────────────────────────────────────────────────

    async def initiate_outbound_call(
        self,
        *,
        to_number: str,
        from_number: str | None,
        user_id: str,
        call_log_id: str,
    ) -> dict:
        self._validate_telnyx_outbound_config()
        client = self._client()
        request_from_number = from_number or settings.TELNYX_PHONE_NUMBER or ""
        try:
            response = client.calls.dial(
                connection_id=settings.TELNYX_VOICE_APPLICATION_ID or "",
                to=to_number,
                from_=request_from_number,
                timeout_secs=60,
                client_state=self._encode_client_state({"user_id": user_id, "call_log_id": call_log_id}),
            )
        except telnyx.TelnyxError as exc:
            raise AppException(
                status_code=502,
                code="TELNYX_CALL_CREATE_FAILED",
                message="Telnyx could not create the outbound call.",
                details={"error": str(exc)},
            ) from exc

        data = response.model_dump() if hasattr(response, "model_dump") else dict(response)
        nested_data = data.get("data") or {}
        sid = nested_data.get("call_control_id") or nested_data.get("call_leg_id") or data.get("call_control_id") or data.get("call_leg_id")
        return {
            "sid": sid,
            "status": "queued",
            "to": to_number,
            "from": request_from_number,
        }

    async def send_sms(self, *, to_number: str, message: str) -> dict:
        self._validate_telnyx_outbound_config()
        client = self._client()
        try:
            response = client.messages.send(
                to=to_number,
                from_=settings.TELNYX_PHONE_NUMBER or "",
                text=message,
                messaging_profile_id=settings.TELNYX_MESSAGING_PROFILE_ID or telnyx.NOT_GIVEN,
            )
        except telnyx.TelnyxError as exc:
            raise AppException(
                status_code=502,
                code="TELNYX_SMS_SEND_FAILED",
                message="Telnyx could not send the SMS.",
                details={"error": str(exc)},
            ) from exc
        return response.model_dump() if hasattr(response, "model_dump") else dict(response)

    async def answer_call(self, call_control_id: str, *, websocket_url: str | None = None) -> None:
        """Answer a ringing call. Pass ``websocket_url`` to bridge straight into the AI
        media stream; omit it when the call is about to be handed to a human instead
        (e.g. transferred into the browser dialer right after)."""
        client = self._client()
        kwargs: dict = {}
        if websocket_url:
            kwargs = {
                "stream_url": websocket_url,
                "stream_track": settings.TELNYX_STREAM_TRACK,
                # send_silence_when_idle keeps the Telnyx WebSocket connection alive
                # when we are not actively sending audio back (prevents stream_error).
                # Do NOT set stream_bidirectional_mode="rtp" — that sends raw RTP bytes
                # instead of WebSocket JSON frames and causes stream_error 100002.
                "send_silence_when_idle": True,
            }
        try:
            client.calls.actions.answer(call_control_id, **kwargs)
        except telnyx.TelnyxError as exc:
            logger.warning("Telnyx answer failed for %s: %s", call_control_id, exc)


    async def hangup_call(self, call_control_id: str) -> bool:
        client = self._client()
        try:
            client.calls.actions.hangup(call_control_id)
            return True
        except telnyx.TelnyxError as exc:
            logger.warning("Telnyx hangup failed for %s: %s", call_control_id, exc)
            return False

    async def transfer_call(self, call_control_id: str, *, to_number: str) -> bool:
        client = self._client()
        try:
            client.calls.actions.transfer(call_control_id, to=to_number)
            return True
        except telnyx.TelnyxError as exc:
            logger.warning("Telnyx transfer failed for %s: %s", call_control_id, exc)
            return False

    async def start_streaming(self, call_control_id: str, *, websocket_url: str) -> bool:
        import asyncio
        client = self._client()
        print(f"[start_streaming] call_id={call_control_id} url={websocket_url}", flush=True)

        def _do_start_streaming():
            return client.calls.actions.start_streaming(
                call_control_id,
                stream_url=websocket_url,
                stream_track=settings.TELNYX_STREAM_TRACK,
                # Keep the bidirectional WebSocket alive even when the AI is between
                # turns, matching the inbound answer-call streaming behavior that is
                # already known to work.
                send_silence_when_idle=True,
            )

        try:
            await asyncio.to_thread(_do_start_streaming)
            print(f"[start_streaming] SUCCESS for {call_control_id}", flush=True)
            return True
        except telnyx.TelnyxError as exc:
            print(f"[start_streaming] FAILED for {call_control_id}: {exc}", flush=True)
            logger.warning("Telnyx start_streaming failed for %s: %s", call_control_id, exc)
            return False

    # ── inbound webhook + signature ─────────────────────────────────────

    async def validate_telnyx_request(self, request: Request, raw_body: bytes) -> None:
        if not settings.TELNYX_VALIDATE_SIGNATURE:
            return
        if not settings.TELNYX_PUBLIC_KEY:
            raise AppException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                code="TELNYX_PUBLIC_KEY_MISSING",
                message="TELNYX_PUBLIC_KEY must be configured when Telnyx signature validation is enabled.",
            )
        try:
            from telnyx.lib.webhook_verification import (
                WebhookVerificationError,
                verify_webhook_signature,
            )

            verify_webhook_signature(raw_body, request.headers, settings.TELNYX_PUBLIC_KEY)
        except WebhookVerificationError as exc:
            raise AppException(
                status_code=401, code="TELNYX_SIGNATURE_INVALID", message="Invalid Telnyx webhook signature."
            ) from exc

    @staticmethod
    def parse_webhook_event(raw_body: bytes) -> TelnyxWebhookEvent:
        try:
            envelope = json.loads(raw_body)
        except json.JSONDecodeError as exc:
            raise AppException(status_code=400, code="TELNYX_WEBHOOK_INVALID", message="Invalid webhook payload.") from exc
        data = envelope.get("data") or {}
        return TelnyxWebhookEvent.model_validate(data)

    def parse_stream_message(self, raw_message: str) -> TelnyxStreamMessage | None:
        try:
            payload = json.loads(raw_message)
        except json.JSONDecodeError:
            return None
        return TelnyxStreamMessage.model_validate(payload)

    def build_connected_event(self, call_id: str) -> CallStreamEvent:
        return CallStreamEvent(event="connected", call_id=call_id, message="Telnyx media stream connected.")

    def build_stream_started_event(self, call_id: str, stream_sid: str | None = None) -> CallStreamEvent:
        return CallStreamEvent(event="stream_started", call_id=call_id, stream_sid=stream_sid, message="Telnyx stream started.")

    def build_audio_ack(self, call_id: str, chunk_size: int, stream_sid: str | None = None) -> CallStreamEvent:
        return CallStreamEvent(event="audio_ack", call_id=call_id, stream_sid=stream_sid, bytes_received=chunk_size)

    def build_text_ack(self, call_id: str, message: str, stream_sid: str | None = None) -> CallStreamEvent:
        return CallStreamEvent(event="text_ack", call_id=call_id, stream_sid=stream_sid, message=message)

    def build_stream_stopped_event(self, call_id: str, stream_sid: str | None = None) -> CallStreamEvent:
        return CallStreamEvent(event="stream_stopped", call_id=call_id, stream_sid=stream_sid, message="Telnyx stream stopped.")

    @staticmethod
    def media_payload_size(stream_message: TelnyxStreamMessage) -> int:
        media_payload = (stream_message.media or {}).get("payload")
        if not media_payload:
            return 0
        try:
            return len(base64.b64decode(media_payload))
        except Exception:
            return len(str(media_payload))

    @staticmethod
    def _encode_client_state(data: dict) -> str:
        """Telnyx round-trips an opaque base64 string on every webhook for this call leg."""
        return base64.b64encode(json.dumps(data).encode("utf-8")).decode("utf-8")

    @staticmethod
    def decode_client_state(client_state: str | None) -> dict:
        if not client_state:
            return {}
        try:
            return json.loads(base64.b64decode(client_state).decode("utf-8"))
        except Exception:
            return {}

    @staticmethod
    def normalize_call_status(event_type: str | None, hangup_cause: str | None = None) -> str:
        """Map a Telnyx Call Control ``event_type`` (+ hangup cause) to our call_logs status."""
        event = (event_type or "").strip().lower()
        if event in {"call.initiated"}:
            return "initiated"
        if event in {"call.ringing"}:
            return "ringing"
        if event in {"call.answered", "call.bridged", "call.streaming.started"}:
            return "in_progress"
        if event == "call.hangup":
            cause = (hangup_cause or "").strip().lower()
            if cause in {"user_busy", "call_rejected"}:
                return "busy"
            if cause in {"no_answer", "no_user_response", "no_answer_timeout"}:
                return "no_answer"
            if cause in {"originator_cancel", "unallocated_number", "unspecified"}:
                return "canceled" if cause == "originator_cancel" else "failed"
            return "completed"
        if event == "call.machine.detection.ended":
            return "in_progress"
        return "completed"

    @staticmethod
    def _validate_telnyx_outbound_config() -> None:
        missing = []
        if not settings.TELNYX_API_KEY:
            missing.append("TELNYX_API_KEY")
        if not settings.TELNYX_PHONE_NUMBER:
            missing.append("TELNYX_PHONE_NUMBER")
        if not settings.TELNYX_VOICE_APPLICATION_ID:
            missing.append("TELNYX_VOICE_APPLICATION_ID")
        if missing:
            raise AppException(
                status_code=503,
                code="TELNYX_NOT_CONFIGURED",
                message="Telnyx outbound calling is not configured yet.",
                details={"missing": missing},
            )
