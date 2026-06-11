from __future__ import annotations

import base64
import hashlib
import hmac

from app.core.config import settings


def _twilio_signature(url: str, form_data: dict[str, str], auth_token: str) -> str:
    payload = url + "".join(f"{key}{form_data[key]}" for key in sorted(form_data))
    digest = hmac.new(auth_token.encode("utf-8"), payload.encode("utf-8"), hashlib.sha1).digest()
    return base64.b64encode(digest).decode("utf-8")


def test_incoming_call_returns_twiml_stream_response(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "TWILIO_VALIDATE_SIGNATURE", False)
    monkeypatch.setattr(settings, "PUBLIC_BACKEND_URL", "https://api.mabdel.test")

    response = client.post(
        "/api/v1/calls/incoming",
        data={"CallSid": "CA123456", "From": "+15550001111", "To": "+15550002222"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    assert "<Say>Welcome to Mabdel. Please wait while I connect you to our team.</Say>" in response.text
    assert "<Play loop=\"0\">http://com.twilio.music.classical.s3.amazonaws.com/Classical_1.mp3</Play>" in response.text


def test_incoming_call_rejects_invalid_twilio_signature(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "TWILIO_VALIDATE_SIGNATURE", True)
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "test-token")

    response = client.post(
        "/api/v1/calls/incoming",
        data={"CallSid": "CAinvalid"},
        headers={"X-Twilio-Signature": "invalid-signature"},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TWILIO_SIGNATURE_INVALID"


def test_twilio_status_callback_accepts_valid_signature(client, monkeypatch) -> None:
    monkeypatch.setattr(settings, "TWILIO_VALIDATE_SIGNATURE", True)
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "test-token")

    form_data = {"CallSid": "CA123456", "CallStatus": "completed", "CallDuration": "42"}
    url = "http://testserver/api/v1/calls/status"
    signature = _twilio_signature(url, form_data, settings.TWILIO_AUTH_TOKEN)

    response = client.post(
        "/api/v1/calls/status",
        data=form_data,
        headers={"X-Twilio-Signature": signature},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["call_status"] == "completed"
    assert payload["data"]["call_duration"] == "42"


def test_call_stream_acknowledges_twilio_media_events(client) -> None:
    with client.websocket_connect("/api/v1/calls/stream/CAstream") as websocket:
        connected = websocket.receive_json()
        assert connected["event"] == "connected"

        websocket.send_json({"event": "start", "streamSid": "MZ123"})
        started = websocket.receive_json()
        assert started["event"] == "stream_started"
        assert started["stream_sid"] == "MZ123"

        # Drain greeting media events if any (AI greeting starts on 'start')
        # We might receive multiple 'media' events for the greeting.
        # We send our own media and look for 'audio_ack'.
        websocket.send_json({"event": "media", "streamSid": "MZ123", "media": {"payload": "aGVsbG8="}})
        
        # Keep receiving until we get audio_ack, ignoring any 'media' (AI speaking)
        received_ack = False
        for _ in range(500): # High limit to handle long greetings
            msg = websocket.receive_json()
            if msg["event"] == "audio_ack":
                assert msg["bytes_received"] == 5
                received_ack = True
                break
            elif msg["event"] == "media":
                continue # Skip AI media
        
        assert received_ack, "Did not receive audio_ack"

        websocket.send_json({"event": "stop", "streamSid": "MZ123"})
        
        # Drain lingering media until we get stream_stopped
        received_stop = False
        for _ in range(1000): # High limit to handle all lingering media
            msg = websocket.receive_json()
            if msg["event"] == "stream_stopped":
                received_stop = True
                break
            elif msg["event"] == "media":
                continue

        assert received_stop, "Did not receive stream_stopped"
