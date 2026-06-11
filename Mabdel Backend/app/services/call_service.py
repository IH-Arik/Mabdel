from __future__ import annotations

import base64
import hashlib
import hmac
import json
from urllib.parse import urlencode
from xml.etree.ElementTree import Element, SubElement, tostring

import httpx
from fastapi import Request
from starlette import status

from app.core.config import settings
from app.core.exceptions import AppException
from app.schemas.call import CallStreamEvent, TwilioStreamMessage


class CallService:
    def build_incoming_webhook_url(self) -> str:
        return f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}{settings.API_V1_PREFIX}/calls/incoming"

    def build_media_stream_url(self, call_id: str) -> str:
        base_url = settings.PUBLIC_BACKEND_URL.rstrip("/")
        websocket_base = f"{base_url}{settings.API_V1_PREFIX}/calls/stream/{call_id}"
        if websocket_base.startswith("https://"):
            return "wss://" + websocket_base.removeprefix("https://")
        if websocket_base.startswith("http://"):
            return "ws://" + websocket_base.removeprefix("http://")
        return websocket_base

    def build_status_callback_url(self) -> str:
        return f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}{settings.API_V1_PREFIX}/calls/status"

    def build_status_callback_url_with_context(self, *, user_id: str | None = None, call_log_id: str | None = None) -> str:
        base = self.build_status_callback_url()
        params = {key: value for key, value in {"user_id": user_id, "call_log_id": call_log_id}.items() if value}
        if not params:
            return base
        return f"{base}?{urlencode(params)}"

    def build_recording_callback_url(self, user_id: str) -> str:
        base = f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}{settings.API_V1_PREFIX}/calls/recording"
        return f"{base}?user_id={user_id}"

    def build_twiml_response(
        self,
        *,
        websocket_url: str,
        call_id: str,
        from_number: str | None = None,
        to_number: str | None = None,
    ) -> str:
        response = Element("Response")
        connect = SubElement(response, "Connect")
        stream = SubElement(
            connect,
            "Stream",
            url=websocket_url,
            track=settings.TWILIO_STREAM_TRACK,
            statusCallback=self.build_status_callback_url(),
            statusCallbackMethod="POST",
        )
        parameters = {"call_id": call_id}
        if from_number:
            parameters["from_number"] = from_number
        if to_number:
            parameters["to_number"] = to_number
        for name, value in parameters.items():
            SubElement(stream, "Parameter", name=name, value=value)
        xml = tostring(response, encoding="unicode")
        return '<?xml version="1.0" encoding="UTF-8"?>' + xml

    def build_dial_twiml(self, to_number: str) -> str:
        response = Element("Response")
        SubElement(response, "Dial").text = to_number
        xml = tostring(response, encoding="unicode")
        return '<?xml version="1.0" encoding="UTF-8"?>' + xml

    def build_hold_twiml(self, message: str = "Please wait while I connect you...") -> str:
        response = Element("Response")
        SubElement(response, "Say").text = message
        SubElement(response, "Play", loop="0").text = "http://com.twilio.music.classical.s3.amazonaws.com/Classical_1.mp3"
        xml = tostring(response, encoding="unicode")
        return '<?xml version="1.0" encoding="UTF-8"?>' + xml

    async def initiate_outbound_call(
        self,
        *,
        to_number: str,
        from_number: str | None,
        user_id: str,
        call_log_id: str,
    ) -> dict:
        self._validate_twilio_outbound_config()
        request_from_number = from_number or settings.TWILIO_PHONE_NUMBER
        status_callback = self.build_status_callback_url_with_context(user_id=user_id, call_log_id=call_log_id)
        form_data = {
            "To": to_number,
            "From": request_from_number or "",
            "Url": self.build_incoming_webhook_url(),
            "Method": "POST",
            "StatusCallback": status_callback,
            "StatusCallbackMethod": "POST",
            "StatusCallbackEvent": ["initiated", "ringing", "answered", "completed"],
        }
        endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Calls.json"
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                endpoint,
                data=form_data,
                auth=(settings.TWILIO_ACCOUNT_SID or "", settings.TWILIO_AUTH_TOKEN or ""),
            )
        if response.status_code >= 400:
            try:
                details = response.json()
            except ValueError:
                details = {"body": response.text}
            raise AppException(
                status_code=502,
                code="TWILIO_CALL_CREATE_FAILED",
                message="Twilio could not create the outbound call.",
                details=details,
            )
        return {
            "sid": payload.get("sid"),
            "status": payload.get("status") or "queued",
            "to": payload.get("to") or to_number,
            "from": payload.get("from") or request_from_number,
        }

    async def send_sms(self, *, to_number: str, message: str) -> dict:
        self._validate_twilio_outbound_config()
        endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
        form_data = {
            "To": to_number,
            "From": settings.TWILIO_PHONE_NUMBER or "",
            "Body": message,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                endpoint,
                data=form_data,
                auth=(settings.TWILIO_ACCOUNT_SID or "", settings.TWILIO_AUTH_TOKEN or ""),
            )
        if response.status_code >= 400:
            try:
                details = response.json()
            except ValueError:
                details = {"body": response.text}
            raise AppException(
                status_code=502,
                code="TWILIO_SMS_SEND_FAILED",
                message="Twilio could not send the SMS.",
                details=details,
            )
        return response.json()

    async def update_call_twiml(self, call_sid: str, twiml: str) -> bool:
        self._validate_twilio_outbound_config()
        endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Calls/{call_sid}.json"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                endpoint,
                data={"Twiml": twiml},
                auth=(settings.TWILIO_ACCOUNT_SID or "", settings.TWILIO_AUTH_TOKEN or ""),
            )
        return response.status_code < 400

    async def validate_twilio_request(self, request: Request, form_fields: dict[str, str]) -> None:
        if not settings.TWILIO_VALIDATE_SIGNATURE:
            return
        if not settings.TWILIO_AUTH_TOKEN:
            raise AppException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                code="TWILIO_AUTH_TOKEN_MISSING",
                message="TWILIO_AUTH_TOKEN must be configured when Twilio signature validation is enabled.",
            )

        provided_signature = request.headers.get("X-Twilio-Signature")
        if not provided_signature:
            raise AppException(status_code=401, code="TWILIO_SIGNATURE_MISSING", message="Missing Twilio signature header.")

        expected_signature = self._compute_twilio_signature(str(request.url), form_fields, settings.TWILIO_AUTH_TOKEN)
        if not hmac.compare_digest(provided_signature, expected_signature):
            raise AppException(status_code=401, code="TWILIO_SIGNATURE_INVALID", message="Invalid Twilio request signature.")

    def parse_stream_message(self, raw_message: str) -> TwilioStreamMessage | None:
        try:
            payload = json.loads(raw_message)
        except json.JSONDecodeError:
            return None
        return TwilioStreamMessage.model_validate(payload)

    def build_connected_event(self, call_id: str) -> CallStreamEvent:
        return CallStreamEvent(event="connected", call_id=call_id, message="Twilio media stream connected.")

    def build_stream_started_event(self, call_id: str, stream_sid: str | None = None) -> CallStreamEvent:
        return CallStreamEvent(event="stream_started", call_id=call_id, stream_sid=stream_sid, message="Twilio stream started.")

    def build_audio_ack(self, call_id: str, chunk_size: int, stream_sid: str | None = None) -> CallStreamEvent:
        return CallStreamEvent(event="audio_ack", call_id=call_id, stream_sid=stream_sid, bytes_received=chunk_size)

    def build_text_ack(self, call_id: str, message: str, stream_sid: str | None = None) -> CallStreamEvent:
        return CallStreamEvent(event="text_ack", call_id=call_id, stream_sid=stream_sid, message=message)

    def build_stream_stopped_event(self, call_id: str, stream_sid: str | None = None) -> CallStreamEvent:
        return CallStreamEvent(event="stream_stopped", call_id=call_id, stream_sid=stream_sid, message="Twilio stream stopped.")

    @staticmethod
    def media_payload_size(stream_message: TwilioStreamMessage) -> int:
        media_payload = (stream_message.media or {}).get("payload")
        if not media_payload:
            return 0
        try:
            return len(base64.b64decode(media_payload))
        except Exception:
            return len(str(media_payload))

    @staticmethod
    def _compute_twilio_signature(url: str, form_fields: dict[str, str], auth_token: str) -> str:
        payload = url + "".join(f"{key}{form_fields[key]}" for key in sorted(form_fields))
        digest = hmac.new(auth_token.encode("utf-8"), payload.encode("utf-8"), hashlib.sha1).digest()
        return base64.b64encode(digest).decode("utf-8")

    @staticmethod
    def normalize_twilio_status(status_value: str | None) -> str:
        mapping = {
            "queued": "queued",
            "initiated": "initiated",
            "ringing": "ringing",
            "in-progress": "in_progress",
            "in_progress": "in_progress",
            "answered": "in_progress",
            "completed": "completed",
            "busy": "busy",
            "no-answer": "no_answer",
            "no_answer": "no_answer",
            "failed": "failed",
            "canceled": "canceled",
            "cancelled": "canceled",
        }
        normalized = (status_value or "").strip().lower()
        return mapping.get(normalized, "completed")

    @staticmethod
    def _validate_twilio_outbound_config() -> None:
        missing = []
        if not settings.TWILIO_ACCOUNT_SID:
            missing.append("TWILIO_ACCOUNT_SID")
        if not settings.TWILIO_AUTH_TOKEN:
            missing.append("TWILIO_AUTH_TOKEN")
        if not settings.TWILIO_PHONE_NUMBER:
            missing.append("TWILIO_PHONE_NUMBER")
        if missing:
            raise AppException(
                status_code=503,
                code="TWILIO_NOT_CONFIGURED",
                message="Twilio outbound calling is not configured yet.",
                details={"missing": missing},
            )
