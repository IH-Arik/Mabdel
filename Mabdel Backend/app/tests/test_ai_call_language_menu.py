from __future__ import annotations

import asyncio
import json

from app.api.v1.endpoints.calls import active_sessions
from app.core.config import settings
from app.services.ai_phone_agent import AIPhoneAgent
from app.services.call_phrases import phrase
from app.services.gocustify_ai_service import GoCustifyAIService
from app.services.smartflow.ai_call_settings_service import AICallSettingsService
from app.services.smartflow_service import SmartFlowService
from app.tests.test_ai_call_reliability import install_fake_streaming_tts


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


# ── The offer is part of the greeting ──────────────────────────────────


def test_greeting_ends_by_offering_the_other_language(mock_db, monkeypatch):
    """The caller hears who is calling and the recording disclosure first, then is
    told which key gets them Spanish."""
    spoken: list[str] = []
    install_fake_streaming_tts(monkeypatch, on_call=lambda text, voice_id: spoken.append(text))

    asyncio.run(_menu_agent(mock_db).greet(lambda _m: asyncio.sleep(0)))

    greeting = " ".join(spoken)
    offer = phrase("language_menu_option", "es", digit="2")
    assert greeting.rstrip().endswith(offer), greeting
    assert greeting.index(phrase("recording_disclosure", "en")) < greeting.index(offer)


def test_greeting_does_not_offer_the_language_it_is_already_speaking(mock_db, monkeypatch):
    spoken: list[str] = []
    install_fake_streaming_tts(monkeypatch, on_call=lambda text, voice_id: spoken.append(text))

    asyncio.run(_menu_agent(mock_db).greet(lambda _m: asyncio.sleep(0)))

    assert phrase("language_menu_option", "en", digit="1") not in " ".join(spoken)


def test_outbound_calls_offer_the_language_too(mock_db, monkeypatch):
    """Make AI Call used to skip the menu entirely, so there was no way to switch."""
    spoken: list[str] = []
    install_fake_streaming_tts(monkeypatch, on_call=lambda text, voice_id: spoken.append(text))

    asyncio.run(_menu_agent(mock_db, is_outbound=True).greet(lambda _m: asyncio.sleep(0)))

    assert phrase("language_menu_option", "es", digit="2") in " ".join(spoken)


def test_menu_disabled_is_not_offered(mock_db, monkeypatch):
    spoken: list[str] = []
    install_fake_streaming_tts(monkeypatch, on_call=lambda text, voice_id: spoken.append(text))

    agent = _menu_agent(mock_db)
    agent.call_settings = AICallSettingsService.merge_settings(
        {"language_menu_enabled": False, "language_menu": [{"digit": "2", "language": "es"}]}
    )
    asyncio.run(agent.greet(lambda _m: asyncio.sleep(0)))

    assert phrase("language_menu_option", "es", digit="2") not in " ".join(spoken)


def test_choosing_a_language_re_greets_in_it_with_the_disclosure(mock_db, monkeypatch):
    """The switch has to be audible, and the caller who needed Spanish may not have
    understood the English recording disclosure the first time."""
    spoken: list[str] = []
    install_fake_streaming_tts(monkeypatch, on_call=lambda text, voice_id: spoken.append(text))

    async def _run():
        agent = _menu_agent(mock_db)
        agent.send_callback = lambda _m: asyncio.sleep(0)
        assert agent.set_language_from_digit("2") is True
        await agent.acknowledge_language_switch()

    asyncio.run(_run())

    said = " ".join(spoken)
    assert phrase("recording_disclosure", "es") in said
    assert phrase("language_menu_option", "es", digit="2") not in said, "must not offer Spanish again"


def test_business_custom_greeting_is_not_replayed_after_switching_language(mock_db, monkeypatch):
    """A custom greeting is in whatever language the business typed it."""
    spoken: list[str] = []
    install_fake_streaming_tts(monkeypatch, on_call=lambda text, voice_id: spoken.append(text))

    async def _run():
        agent = _menu_agent(mock_db)
        agent.call_settings["greeting_inbound"] = "Welcome to Apex Dental, how may we help?"
        agent.send_callback = lambda _m: asyncio.sleep(0)
        agent.set_language_from_digit("2")
        await agent.acknowledge_language_switch()

    asyncio.run(_run())
    assert "Welcome to Apex Dental" not in " ".join(spoken)


def test_keypress_during_the_greeting_cuts_it_short():
    agent = AIPhoneAgent("call_menu_cut", GoCustifyAIService(), None)
    agent.call_settings = AICallSettingsService.merge_settings(
        {"language_menu_enabled": True, "language_menu": [{"digit": "2", "language": "es"}]}
    )
    agent.is_speaking = True

    agent.set_language_from_digit("2")

    assert agent.barge_in_triggered is True


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
