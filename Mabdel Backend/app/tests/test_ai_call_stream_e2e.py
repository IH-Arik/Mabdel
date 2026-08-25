from __future__ import annotations

from app.tests.test_ai_call_reliability import install_fake_streaming_tts


def test_ai_greeting_audio_is_sent_back_over_the_stream(client, mock_db, monkeypatch) -> None:
    """The real gap the existing test_call_stream_handles_telnyx_media_events leaves open:
    it only asserts the socket doesn't crash, never that the AI actually speaks."""
    install_fake_streaming_tts(monkeypatch)

    with client.websocket_connect("/api/v1/calls/stream/CAgreet") as websocket:
        websocket.send_json({"event": "connected"})
        websocket.send_json({"event": "start", "stream_id": "MZ_greet"})

        first = websocket.receive_json()

    assert first["event"] == "media", f"expected AI audio frame, got {first}"
    assert first["media"]["payload"], "media frame carried no audio payload"
    assert set(first.keys()) == {"event", "media"}, (
        f"Telnyx rejects outbound frames with extra top-level keys, got {sorted(first.keys())}"
    )
