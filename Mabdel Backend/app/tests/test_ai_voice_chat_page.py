from __future__ import annotations

import asyncio
import threading

from app.services.gocustify_ai_service import GoCustifyAIService
from app.services.smartflow.workflow_service import WorkflowService
from app.tests.test_team_direct_messaging import _signup


def _fake_ai(monkeypatch, *, transcribe_thread=None):
    def fake_transcribe(self, transcript=None, audio_url=None, audio_base64=None, audio_mime_type="audio/wav", audio_filename="voice.wav"):
        if transcribe_thread is not None:
            transcribe_thread.append(threading.current_thread() is threading.main_thread())
        return {"state": "responded", "transcript": "What are your hours?", "source": "audio", "status": "transcribed"}

    async def fake_speech(self, text, voice_id=None):
        return {"mime_type": "audio/wav", "audio_base64": "UklGRg==", "status": "generated"}

    monkeypatch.setattr(GoCustifyAIService, "transcribe_voice", fake_transcribe)
    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech", fake_speech)


def test_a_spoken_question_gets_a_transcript_a_reply_and_playable_audio(client, mock_db, monkeypatch):
    _fake_ai(monkeypatch)
    headers, _ = _signup(client, mock_db, "voice-page@example.com", "Owner")
    response = client.post(
        "/api/v1/smartflow/ai/voice-chat-upload",
        headers=headers,
        files={"audio_file": ("voice.webm", b"\x1aE\xdf\xa3fake-webm", "audio/webm")},
        data={"response_mode": "audio"},
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["transcript"] == "What are your hours?"
    assert data["ai_response"]
    assert data["audio"]["audio_base64"] == "UklGRg==" and data["audio"]["mime_type"] == "audio/wav"


def test_a_huge_recording_is_refused(client, mock_db, monkeypatch):
    _fake_ai(monkeypatch)
    headers, _ = _signup(client, mock_db, "voice-big@example.com", "Owner")
    response = client.post(
        "/api/v1/smartflow/ai/voice-chat-upload",
        headers=headers,
        files={"audio_file": ("voice.webm", b"0" * (25 * 1024 * 1024 + 10), "audio/webm")},
        data={"response_mode": "audio"},
    )
    assert response.status_code == 413


def test_transcription_does_not_block_the_server(mock_db, monkeypatch):
    on_main_thread: list[bool] = []
    _fake_ai(monkeypatch, transcribe_thread=on_main_thread)
    service = WorkflowService(mock_db)

    async def run():
        try:
            await service.process_workflow_prefill("000000000000000000000001", {"transcript": "Create invoice for Sarah"})
        except Exception:
            pass  # only where the transcription ran matters here

    asyncio.run(run())
    assert on_main_thread == [False]
