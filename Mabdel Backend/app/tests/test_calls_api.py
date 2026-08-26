from __future__ import annotations

import base64
import json
import time

from app.core.config import settings
from app.services.call_service import CallService


def _make_ed25519_keypair() -> tuple[str, "object"]:
    from nacl.signing import SigningKey

    signing_key = SigningKey.generate()
    public_key_b64 = base64.b64encode(bytes(signing_key.verify_key)).decode()
    return public_key_b64, signing_key


def _sign_telnyx_payload(signing_key, body: bytes, timestamp: str | None = None) -> dict[str, str]:
    ts = timestamp or str(int(time.time()))
    message = f"{ts}|{body.decode()}".encode()
    signature = base64.b64encode(signing_key.sign(message).signature).decode()
    return {"Telnyx-Signature-Ed25519": signature, "Telnyx-Timestamp": ts}


def _webhook_envelope(event_type: str, payload: dict) -> bytes:
    return json.dumps(
        {
            "data": {
                "event_type": event_type,
                "id": "evt_test",
                "occurred_at": "2026-01-01T00:00:00Z",
                "payload": payload,
            }
        }
    ).encode()


async def _noop_answer(self, call_control_id: str, *, websocket_url: str) -> None:
    return None


def test_incoming_call_webhook_creates_ringing_call_log(client, mock_db, monkeypatch) -> None:
    public_key, signing_key = _make_ed25519_keypair()
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", True)
    monkeypatch.setattr(settings, "TELNYX_PUBLIC_KEY", public_key)
    monkeypatch.setattr(settings, "PUBLIC_BACKEND_URL", "https://api.mabdel.test")
    monkeypatch.setattr(CallService, "answer_call", _noop_answer)

    body = _webhook_envelope(
        "call.initiated",
        {
            "call_control_id": "v2:test-call-1",
            "direction": "incoming",
            "from": "+15550001111",
            "to": "+15550002222",
        },
    )
    headers = _sign_telnyx_payload(signing_key, body)

    response = client.post("/api/v1/calls/webhook", content=body, headers=headers)

    assert response.status_code == 200
    assert response.json() == {}

    import asyncio

    call_log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "v2:test-call-1"}))
    assert call_log is not None
    assert call_log["status"] == "ringing"
    assert call_log["direction"] == "inbound"
    assert call_log["from_number"] == "+15550001111"


def test_call_webhook_rejects_invalid_signature(client, monkeypatch) -> None:
    public_key, _signing_key = _make_ed25519_keypair()
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", True)
    monkeypatch.setattr(settings, "TELNYX_PUBLIC_KEY", public_key)

    body = _webhook_envelope("call.initiated", {"call_control_id": "v2:bad", "direction": "incoming"})

    response = client.post(
        "/api/v1/calls/webhook",
        content=body,
        headers={"Telnyx-Signature-Ed25519": "bogus", "Telnyx-Timestamp": str(int(time.time()))},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TELNYX_SIGNATURE_INVALID"


def test_call_webhook_root_alias_matches_v1_route(client, mock_db, monkeypatch) -> None:
    """TELNYX_WEBHOOK_URL in .env points at the unprefixed alias, not /api/v1/calls/webhook."""
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)
    monkeypatch.setattr(CallService, "answer_call", _noop_answer)

    body = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:alias-test", "direction": "incoming", "from": "+1555", "to": "+1666"},
    )
    response = client.post("/webhooks/telnyx/voice", content=body)
    assert response.status_code == 200

    import asyncio

    call_log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "v2:alias-test"}))
    assert call_log is not None


def test_call_webhook_hangup_updates_status(client, mock_db, monkeypatch) -> None:
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)
    monkeypatch.setattr(CallService, "answer_call", _noop_answer)

    import asyncio

    inbound_body = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:hangup-test", "direction": "incoming", "from": "+1555", "to": "+1666"},
    )
    assert client.post("/api/v1/calls/webhook", content=inbound_body).status_code == 200

    hangup_body = _webhook_envelope(
        "call.hangup",
        {
            "call_control_id": "v2:hangup-test",
            "hangup_cause": "normal_clearing",
            "call_duration_secs": 42,
            "from": "+1555",
            "to": "+1666",
        },
    )
    response = client.post("/api/v1/calls/webhook", content=hangup_body)
    assert response.status_code == 200

    call_log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "v2:hangup-test"}))
    assert call_log["status"] == "completed"
    assert call_log["duration"] == 42


def test_call_webhook_busy_hangup_maps_to_busy_status(client, mock_db, monkeypatch) -> None:
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)
    monkeypatch.setattr(CallService, "answer_call", _noop_answer)

    import asyncio

    inbound_body = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:busy-test", "direction": "incoming", "from": "+1555", "to": "+1666"},
    )
    client.post("/api/v1/calls/webhook", content=inbound_body)

    hangup_body = _webhook_envelope(
        "call.hangup",
        {"call_control_id": "v2:busy-test", "hangup_cause": "user_busy"},
    )
    client.post("/api/v1/calls/webhook", content=hangup_body)

    call_log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "v2:busy-test"}))
    assert call_log["status"] == "busy"


def test_recording_saved_webhook_transcribes_and_summarizes(client, mock_db, monkeypatch) -> None:
    """The call.recording.saved webhook is the real end of the recording -> transcript
    -> AI analysis pipeline: downloads the audio, transcribes it, summarizes it, and
    saves both onto the call log."""
    import asyncio

    import httpx

    from app.services.gocustify_ai_service import GoCustifyAIService

    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)
    monkeypatch.setattr(CallService, "answer_call", _noop_answer)

    inbound_body = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:recording-test", "direction": "incoming", "from": "+1555", "to": "+1666"},
    )
    assert client.post("/api/v1/calls/webhook", content=inbound_body).status_code == 200

    class FakeResponse:
        status_code = 200
        content = b"fake-mp3-bytes"

    async def fake_get(self, url, *args, **kwargs):
        assert url == "https://recordings.telnyx.test/rec-123.mp3"
        return FakeResponse()

    def fake_transcribe(self, audio_base64, audio_mime_type, audio_filename):
        return "Caller asked about pricing and office hours.", None

    def fake_summarize(self, transcript):
        assert transcript == "Caller asked about pricing and office hours."
        return {"summary": "Pricing and hours inquiry.", "key_points": ["pricing", "hours"], "status": "generated"}

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    monkeypatch.setattr(GoCustifyAIService, "_transcribe_audio_with_openai", fake_transcribe)
    monkeypatch.setattr(GoCustifyAIService, "summarize_call", fake_summarize)

    recording_body = _webhook_envelope(
        "call.recording.saved",
        {
            "call_control_id": "v2:recording-test",
            "recording_urls": {"mp3": "https://recordings.telnyx.test/rec-123.mp3"},
        },
    )
    response = client.post("/api/v1/calls/webhook", content=recording_body)
    assert response.status_code == 200

    call_log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "v2:recording-test"}))
    assert call_log["recording_url"] == "https://recordings.telnyx.test/rec-123.mp3"
    assert call_log["recording_transcript"] == "Caller asked about pricing and office hours."
    assert call_log["ai_summary"]["summary"] == "Pricing and hours inquiry."
    assert call_log["ai_summary"]["status"] == "generated"


def test_call_stream_handles_telnyx_media_events(client) -> None:
    with client.websocket_connect("/api/v1/calls/stream/CAstream") as websocket:
        websocket.send_json({"event": "connected"})
        websocket.send_json({"event": "start", "stream_id": "MZ123"})
        websocket.send_json({"event": "media", "stream_id": "MZ123", "media": {"payload": "aGVsbG8="}})
        websocket.send_json({"event": "stop", "stream_id": "MZ123"})


def test_old_twilio_browser_voice_endpoints_are_gone(client) -> None:
    assert client.get("/api/v1/twilio/voice/token").status_code == 404
    assert client.post("/api/v1/twilio/voice/registration", json={"identity": "x"}).status_code == 404
    assert client.post("/api/v1/twilio/voice/outbound").status_code == 404
    assert client.post("/api/v1/twilio/voice/session-sync", json={"call_sid": "x", "status": "y"}).status_code == 404


def test_incoming_call_without_registration_answers_into_ai(client, mock_db, monkeypatch) -> None:
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    answer_calls: list[dict] = []

    async def fake_answer(self, call_control_id: str, *, websocket_url: str | None = None) -> None:
        answer_calls.append({"websocket_url": websocket_url})

    monkeypatch.setattr(CallService, "answer_call", fake_answer)

    body = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:no-reg-test", "direction": "incoming", "from": "+1555", "to": "+1666"},
    )
    client.post("/api/v1/calls/webhook", content=body)

    assert len(answer_calls) == 1
    assert answer_calls[0]["websocket_url"] is not None  # answered straight into the AI stream


def test_browser_outbound_call_creates_log_from_client_state(client, mock_db, monkeypatch) -> None:
    """Browser-originated outbound calls never hit our REST API before dialing — the
    webhook is the first signal, and client_state (set by newCall()) says who called."""
    import asyncio

    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)
    state = CallService.encode_client_state({"user_id": "user-abc-123", "display_name": "Jane Caller"})

    body = _webhook_envelope(
        "call.initiated",
        {
            "call_control_id": "v2:browser-outbound-1",
            "direction": "outgoing",
            "from": "+15551230000",
            "to": "+15559998888",
            "client_state": state,
        },
    )
    response = client.post("/api/v1/calls/webhook", content=body)
    assert response.status_code == 200

    call_log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "v2:browser-outbound-1"}))
    assert call_log is not None
    assert call_log["user_id"] == "user-abc-123"
    assert call_log["contact_name"] == "Jane Caller"
    assert call_log["direction"] == "outbound"
    assert call_log["status"] == "initiated"


def test_browser_outbound_call_does_not_duplicate_existing_log(client, mock_db, monkeypatch) -> None:
    import asyncio

    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    async def _seed():
        await mock_db.call_logs.insert_one(
            {"user_id": "user-xyz", "twilio_call_sid": "v2:already-tracked", "status": "queued"}
        )

    asyncio.run(_seed())

    state = CallService.encode_client_state({"user_id": "someone-else"})
    body = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:already-tracked", "direction": "outgoing", "client_state": state},
    )
    client.post("/api/v1/calls/webhook", content=body)

    count = asyncio.run(mock_db.call_logs.count_documents({"twilio_call_sid": "v2:already-tracked"}))
    assert count == 1


def test_browser_outbound_call_without_client_state_is_ignored(client, mock_db, monkeypatch) -> None:
    import asyncio

    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    body = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:no-state", "direction": "outgoing"},
    )
    client.post("/api/v1/calls/webhook", content=body)

    call_log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "v2:no-state"}))
    assert call_log is None


def test_normalize_call_status_maps_events_and_hangup_causes() -> None:
    assert CallService.normalize_call_status("call.initiated") == "initiated"
    assert CallService.normalize_call_status("call.ringing") == "ringing"
    assert CallService.normalize_call_status("call.answered") == "in_progress"
    assert CallService.normalize_call_status("call.hangup", "user_busy") == "busy"
    assert CallService.normalize_call_status("call.hangup", "call_rejected") == "busy"
    assert CallService.normalize_call_status("call.hangup", "no_answer") == "no_answer"
    assert CallService.normalize_call_status("call.hangup", "originator_cancel") == "canceled"
    assert CallService.normalize_call_status("call.hangup", "normal_clearing") == "completed"
    assert CallService.normalize_call_status("call.hangup", None) == "completed"
