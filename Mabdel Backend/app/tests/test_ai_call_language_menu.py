from __future__ import annotations

import asyncio
import json

from app.api.v1.endpoints.calls import LANGUAGE_MENU_TIMEOUT_SECONDS, active_sessions
from app.core.config import settings
from app.services.ai_phone_agent import AIPhoneAgent
from app.services.call_phrases import phrase
from app.services.gocustify_ai_service import GoCustifyAIService
from app.services.smartflow.ai_call_settings_service import AICallSettingsService
from app.services.smartflow_service import SmartFlowService
from app.tests.test_ai_call_reliability import _short_wav_base64


def _webhook_envelope(event_type: str, payload: dict) -> bytes:
    return json.dumps(
        {"data": {"event_type": event_type, "id": "evt_test", "occurred_at": "2026-01-01T00:00:00Z", "payload": payload}}
    ).encode()


def _menu_agent(mock_db, *, is_outbound: bool = False) -> AIPhoneAgent:
    agent = AIPhoneAgent("call_menu_1", GoCustifyAIService(), SmartFlowService(mock_db))
    agent.user_id = "guest"
    agent.stream_sid = "MZ_test"
    agent.is_outbound = is_outbound
    agent.call_settings = AICallSettingsService.merge_settings(
        {
            "language_menu_enabled": True,
            "language_menu": [{"digit": "1", "language": "en"}, {"digit": "2", "language": "es"}],
        }
    )
    return agent


# ── Agent-level menu logic (no webhook / no WebSocket involved) ───────────


def test_menu_is_spoken_in_each_options_own_language(mock_db, monkeypatch):
    spoken: list[str] = []

    async def fake_synthesize(self, text, voice_id=None):
        spoken.append(text)
        return {"audio_base64": _short_wav_base64()}

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech", fake_synthesize)

    agent = _menu_agent(mock_db)
    played = asyncio.run(agent.offer_language_menu(lambda _m: asyncio.sleep(0)))

    assert played is True
    assert phrase("language_menu_option", "en", digit="1") in spoken[0]
    assert phrase("language_menu_option", "es", digit="2") in spoken[0]


def test_menu_is_skipped_on_outbound_calls(mock_db, monkeypatch):
    """We dialled them — a keypad menu on an outbound call makes no sense."""
    called = False

    async def fake_synthesize(self, text, voice_id=None):
        nonlocal called
        called = True
        return {"audio_base64": _short_wav_base64()}

    monkeypatch.setattr(GoCustifyAIService, "synthesize_speech", fake_synthesize)

    agent = _menu_agent(mock_db, is_outbound=True)
    played = asyncio.run(agent.offer_language_menu(lambda _m: asyncio.sleep(0)))

    assert played is False
    assert called is False


def test_menu_disabled_never_plays(mock_db):
    agent = AIPhoneAgent("call_menu_2", GoCustifyAIService(), SmartFlowService(mock_db))
    agent.call_settings = AICallSettingsService.merge_settings({"language_menu_enabled": False})
    played = asyncio.run(agent.offer_language_menu(lambda _m: asyncio.sleep(0)))
    assert played is False


def test_keypress_on_the_menu_locks_the_language():
    agent = AIPhoneAgent("call_menu_3", GoCustifyAIService(), None)
    agent.call_settings = AICallSettingsService.merge_settings(
        {"language_menu_enabled": True, "language_menu": [{"digit": "2", "language": "es"}]}
    )

    assert agent.set_language_from_digit("2") is True
    assert agent.language == "es"
    assert agent.language_locked is True
    assert agent.language_menu_answered is True


def test_keypress_not_on_the_menu_is_ignored_not_applied():
    """A stray DTMF tone (line noise, a caller fumbling their phone) must not switch
    the call to an unoffered language."""
    agent = AIPhoneAgent("call_menu_4", GoCustifyAIService(), None)
    agent.call_settings = AICallSettingsService.merge_settings(
        {"language_menu_enabled": True, "language_menu": [{"digit": "1", "language": "en"}]}
    )
    original_language = agent.language

    assert agent.set_language_from_digit("9") is False
    assert agent.language == original_language
    assert agent.language_locked is False


# ── Webhook wiring: call.dtmf.received reaches the live session ──────────


def test_dtmf_webhook_applies_the_choice_to_the_live_session(client, monkeypatch, mock_db):
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    agent = AIPhoneAgent("v2:dtmf-live", GoCustifyAIService(), SmartFlowService(mock_db))
    agent.call_settings = AICallSettingsService.merge_settings(
        {"language_menu_enabled": True, "language_menu": [{"digit": "2", "language": "es"}]}
    )
    active_sessions["v2:dtmf-live"] = agent
    try:
        body = _webhook_envelope("call.dtmf.received", {"call_control_id": "v2:dtmf-live", "digit": "2"})
        response = client.post("/api/v1/calls/webhook", content=body)

        assert response.status_code == 200, response.text
        assert agent.language == "es"
        assert agent.language_locked is True
    finally:
        active_sessions.pop("v2:dtmf-live", None)


def test_dtmf_webhook_for_a_call_with_no_live_session_does_not_crash(client, monkeypatch):
    """A human-answered call, or one that already hung up, has no AIPhoneAgent in
    active_sessions — the webhook must degrade to a no-op, not a 500."""
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)
    active_sessions.pop("v2:no-session", None)

    body = _webhook_envelope("call.dtmf.received", {"call_control_id": "v2:no-session", "digit": "1"})
    response = client.post("/api/v1/calls/webhook", content=body)

    assert response.status_code == 200, response.text


def test_dtmf_webhook_ignores_an_unmapped_digit(client, monkeypatch, mock_db):
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    agent = AIPhoneAgent("v2:dtmf-unmapped", GoCustifyAIService(), SmartFlowService(mock_db))
    agent.call_settings = AICallSettingsService.merge_settings(
        {"language_menu_enabled": True, "language_menu": [{"digit": "1", "language": "en"}]}
    )
    active_sessions["v2:dtmf-unmapped"] = agent
    try:
        body = _webhook_envelope("call.dtmf.received", {"call_control_id": "v2:dtmf-unmapped", "digit": "9"})
        response = client.post("/api/v1/calls/webhook", content=body)

        assert response.status_code == 200, response.text
        assert agent.language_locked is False
    finally:
        active_sessions.pop("v2:dtmf-unmapped", None)


# ── Timeout fallback ───────────────────────────────────────────────────────


def test_menu_times_out_short_enough_for_a_call_not_to_feel_stuck():
    """Not really a test of behaviour so much as a tripwire: if this constant is ever
    bumped way up, a caller who doesn't answer the menu sits in silence that long
    before the normal greeting (and Whisper auto-detect) kicks in."""
    assert 0 < LANGUAGE_MENU_TIMEOUT_SECONDS <= 10
