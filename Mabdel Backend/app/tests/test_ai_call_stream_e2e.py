from __future__ import annotations

import base64
import io
import wave

from app.services.gocustify_ai_service import GoCustifyAIService


def _short_wav_base64(num_samples: int = 3000) -> str:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(24000)
        wav_file.writeframes(b"\x00\x00" * num_samples)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def test_ai_greeting_audio_is_sent_back_over_the_stream(client, mock_db, monkeypatch) -> None:
    """The real gap the existing test_call_stream_handles_telnyx_media_events leaves open:
    it only asserts the socket doesn't crash, never that the AI actually speaks."""

    async def fake_synthesize(self, text, voice_id=None):
        return {"audio_base64": _short_wav_base64(), "status": "generated"}

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech", fake_synthesize)

    with client.websocket_connect("/api/v1/calls/stream/CAgreet") as websocket:
        websocket.send_json({"event": "connected"})
        websocket.send_json({"event": "start", "stream_id": "MZ_greet"})

        first = websocket.receive_json()

    assert first["event"] == "media", f"expected AI audio frame, got {first}"
    assert first["media"]["payload"], "media frame carried no audio payload"
    assert set(first.keys()) == {"event", "media"}, (
        f"Telnyx rejects outbound frames with extra top-level keys, got {sorted(first.keys())}"
    )
