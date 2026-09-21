from __future__ import annotations

import base64
import json
import time

from app.core.config import settings
from app.services.call_service import CallService
from app.services.smartflow_service import SmartFlowService


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


def test_call_webhook_hangup_computes_duration_when_provider_omits_it(client, mock_db, monkeypatch) -> None:
    """Real Telnyx call.hangup webhooks never actually carry call_duration_secs (that
    field is a schema leftover, not something Telnyx populates) — so duration used to
    never get set at all. This is the fix: answered_at is recorded on call.answered,
    and call.hangup turns the elapsed time since then into a real duration."""
    import asyncio
    from datetime import datetime, timezone

    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)
    monkeypatch.setattr(CallService, "answer_call", _noop_answer)

    # call.initiated runs unpatched (it calls utc_now() itself for unrelated
    # bookkeeping) — only the answered/hangup pair needs deterministic timing.
    inbound_body = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:duration-test", "direction": "incoming", "from": "+1555", "to": "+1666"},
    )
    assert client.post("/api/v1/calls/webhook", content=inbound_body).status_code == 200

    times = iter(
        [
            datetime(2026, 1, 1, 0, 0, 1, tzinfo=timezone.utc),  # call.answered -> answered_at
            datetime(2026, 1, 1, 0, 0, 31, tzinfo=timezone.utc),  # call.hangup -> +30s elapsed
        ]
    )
    monkeypatch.setattr("app.api.v1.endpoints.calls.utc_now", lambda: next(times))

    answered_body = _webhook_envelope(
        "call.answered",
        {"call_control_id": "v2:duration-test", "from": "+1555", "to": "+1666"},
    )
    assert client.post("/api/v1/calls/webhook", content=answered_body).status_code == 200

    hangup_body = _webhook_envelope(
        "call.hangup",
        {"call_control_id": "v2:duration-test", "hangup_cause": "normal_clearing", "from": "+1555", "to": "+1666"},
    )
    assert client.post("/api/v1/calls/webhook", content=hangup_body).status_code == 200

    call_log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "v2:duration-test"}))
    assert call_log["status"] == "completed"
    assert call_log["duration"] == 30


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


def test_outbound_ai_stream_keeps_sending_silence_while_the_ai_listens(client, mock_db, monkeypatch):
    """Telnyx's send_silence_when_idle only exists on the answer action, so an outbound
    call (joined with start_streaming, because the callee answered it) has nothing
    holding the bidirectional stream open between utterances — Telnyx tears it down and
    the AI is mute for the rest of the call, which is why outbound behaved worse than
    inbound. We send the idle silence ourselves instead."""
    import asyncio as _asyncio

    from app.api.v1.endpoints.calls import SILENCE_FRAME_PAYLOAD
    from app.services.gocustify_ai_service import GoCustifyAIService

    async def tiny_tts(self, text, voice_id=None):
        yield b"\x00\x00" * 240  # a very short utterance, so the greeting ends quickly

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech_stream", tiny_tts)

    call_id = "v2:ws-keepalive"
    _asyncio.run(
        mock_db.call_logs.insert_one(
            {
                "user_id": "guest",
                "twilio_call_sid": call_id,
                "call_type": "outbound",
                "direction": "outbound",
                "phone_number": "+8801700000011",
                "status": "in_progress",
            }
        )
    )

    with client.websocket_connect(f"/api/v1/calls/stream/{call_id}") as websocket:
        websocket.send_json({"event": "start", "stream_id": "stream-keepalive"})
        payloads = [websocket.receive_json()["media"]["payload"] for _ in range(60)]

    assert SILENCE_FRAME_PAYLOAD in payloads, "no idle silence was sent, the stream will be torn down"


def test_greeting_is_not_cut_short_by_loud_audio_on_the_line(client, mock_db, monkeypatch):
    """Production cut a 10s greeting 1.7s in: with no echo cancellation the AI's own
    voice comes back on the line and reads as the caller interrupting. The greeting
    carries the mandatory recording disclosure and answers nothing, so it is never
    interruptible — barge-in only applies once the AI is actually replying."""
    import asyncio as _asyncio

    from app.api.v1.endpoints import calls as calls_module
    from app.services.gocustify_ai_service import GoCustifyAIService

    # Remove the timing cushions so a single loud frame would be enough to barge in.
    monkeypatch.setattr(calls_module, "BARGE_IN_GRACE_SECONDS", 0.0)
    monkeypatch.setattr(calls_module, "BARGE_IN_THRESHOLD_MS", 20)

    greeting_chunks = 6

    async def slow_tts(self, text, voice_id=None):
        for _ in range(greeting_chunks):
            await _asyncio.sleep(0.02)  # leaves room for the loud frames to be read mid-greeting
            yield b"\x7f\x00" * 480     # 480 samples -> 160 mu-law bytes -> exactly one frame

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech_stream", slow_tts)

    call_id = "v2:ws-greeting-bargein"
    _asyncio.run(
        mock_db.call_logs.insert_one(
            {
                "user_id": "guest",
                "twilio_call_sid": call_id,
                "call_type": "outbound",
                "direction": "outbound",
                "phone_number": "+8801700000012",
                "status": "in_progress",
            }
        )
    )

    loud = base64.b64encode(bytes([0x00] * 160)).decode()  # full-scale mu-law, far above the threshold
    with client.websocket_connect(f"/api/v1/calls/stream/{call_id}") as websocket:
        websocket.send_json({"event": "start", "stream_id": "stream-greeting"})
        for _ in range(40):
            websocket.send_json({"event": "media", "media": {"payload": loud}})
        spoken = 0
        while spoken < greeting_chunks:
            payload = websocket.receive_json()["media"]["payload"]
            if payload != calls_module.SILENCE_FRAME_PAYLOAD:
                spoken += 1

    assert spoken == greeting_chunks


def test_speech_threshold_rises_above_a_noisy_line_but_leaves_a_quiet_one_alone():
    """A fixed threshold made every chunk of a noisy line look like speech, so the
    600ms-of-silence check that ends a caller's turn never fired and each reply waited
    out the backstop instead. The threshold now sits above the measured background."""
    from app.api.v1.endpoints.calls import (
        ENERGY_THRESHOLD,
        speech_threshold,
        update_noise_floor,
    )

    def floor_after(energies, *, mid_utterance=False):
        noise_floor = None
        for energy in energies:
            noise_floor = update_noise_floor(noise_floor, energy, allow_rise=not mid_utterance)
        return noise_floor

    quiet = floor_after([5, 8, 3, 6, 1200, 4])  # 1200 is the caller actually speaking
    assert speech_threshold(quiet) == ENERGY_THRESHOLD, "a clean line must behave exactly as before"

    noisy = floor_after([500, 520, 480, 510, 2000, 2100, 495])
    assert speech_threshold(noisy) > 1000
    assert 500 < speech_threshold(noisy) <= 2000, "background reads as silence, real speech still doesn't"

    # An unbroken stretch of speech must not drag the floor up to its own level —
    # that would leave the AI deaf to the caller for the rest of the call.
    assert speech_threshold(floor_after([5] + [3000] * 500, mid_utterance=True)) == ENERGY_THRESHOLD


def test_outbound_ai_stream_starts_before_the_call_log_bookkeeping(client, mock_db, monkeypatch):
    """Every Atlas round-trip before start_streaming is dead air for the person who
    just picked up — ~2s of the 4-5s gap in production."""
    import asyncio as _asyncio

    from app.services.call_service import CallService

    order: list[str] = []

    async def fake_start_streaming(self, call_control_id: str, *, websocket_url: str) -> bool:
        order.append("stream")
        return True

    monkeypatch.setattr(CallService, "start_streaming", fake_start_streaming)
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    original_update = SmartFlowService.update_call_log_from_provider_callback

    async def tracked_update(self, **kwargs):
        order.append("bookkeeping")
        return await original_update(self, **kwargs)

    monkeypatch.setattr(SmartFlowService, "update_call_log_from_provider_callback", tracked_update)

    call_id = "v2:stream-before-bookkeeping"
    _asyncio.run(
        mock_db.call_logs.insert_one(
            {
                "user_id": "guest",
                "twilio_call_sid": call_id,
                "call_type": "outbound",
                "ai_ready": True,
                "phone_number": "+8801700000013",
                "status": "ringing",
            }
        )
    )

    response = client.post(
        "/api/v1/calls/webhook",
        content=json.dumps(
            {
                "data": {
                    "event_type": "call.answered",
                    "id": "evt_order",
                    "occurred_at": "2026-01-01T00:00:00Z",
                    "payload": {"call_control_id": call_id, "from": "+15550000000", "to": "+8801700000013"},
                }
            }
        ).encode(),
    )
    assert response.status_code == 200
    assert order[0] == "stream", f"bookkeeping ran before the AI stream: {order}"
