from __future__ import annotations

import asyncio

from app.services.gocustify_ai_service import GoCustifyAIService
from app.tests.test_shared_inbox import _inbound
from app.tests.test_team_direct_messaging import _same_org, _signup

COMPOSE = "/api/v1/smartflow/ai/compose"


def test_draft_reply_uses_the_conversation_and_leaves_no_ai_history(client, mock_db, monkeypatch):
    headers, owner_id = _signup(client, mock_db, "writer@example.com", "Owner")
    _same_org(mock_db, owner_id)
    message = _inbound(mock_db, owner_id, "whatsapp", "8801700000001@s.whatsapp.net", "Is the flat still free?", name="Karim")
    seen = {}

    def fake_compose(self, action, **kwargs):
        seen.update(action=action, **kwargs)
        return "Yes, it's still available. Would you like to visit tomorrow?"

    monkeypatch.setattr(GoCustifyAIService, "compose_message", fake_compose)
    conversations_before = asyncio.run(mock_db.conversations.count_documents({}))

    response = client.post(COMPOSE, headers=headers, json={"action": "draft_reply", "conversation_id": message["conversation_id"]})

    assert response.status_code == 200, response.text
    assert response.json()["data"]["text"].startswith("Yes, it's still available")
    assert "Karim: Is the flat still free?" in seen["transcript"] and seen["channel"] == "whatsapp"
    assert asyncio.run(mock_db.conversations.count_documents({})) == conversations_before  # no AI chat created


def test_rewrite_needs_a_draft_and_translate_passes_the_language(client, mock_db, monkeypatch):
    headers, _ = _signup(client, mock_db, "writer2@example.com", "Owner")
    monkeypatch.setattr(GoCustifyAIService, "compose_message", lambda self, action, **kw: f"{action}:{kw['language']}:{kw['draft']}")

    assert client.post(COMPOSE, headers=headers, json={"action": "improve", "draft": "  "}).status_code == 400
    translated = client.post(COMPOSE, headers=headers, json={"action": "translate", "draft": "hello", "language": "Bangla"})
    assert translated.json()["data"]["text"] == "translate:Bangla:hello"
    assert client.post(COMPOSE, headers=headers, json={"action": "write_a_poem", "draft": "x"}).status_code == 422


def test_compose_cannot_read_another_business_conversation(client, mock_db, monkeypatch):
    _, owner_id = _signup(client, mock_db, "writer-owner@example.com", "Owner")
    stranger_headers, _ = _signup(client, mock_db, "writer-stranger@example.com", "Stranger")
    _same_org(mock_db, owner_id)
    message = _inbound(mock_db, owner_id, "sms", "+15550001234", "private")
    monkeypatch.setattr(GoCustifyAIService, "compose_message", lambda self, action, **kw: "leak")

    response = client.post(COMPOSE, headers=stranger_headers, json={"action": "draft_reply", "conversation_id": message["conversation_id"]})
    assert response.status_code == 404


def test_transcribe_only_transcribes(client, mock_db, monkeypatch):
    headers, _ = _signup(client, mock_db, "dictate@example.com", "Owner")
    monkeypatch.setattr(GoCustifyAIService, "transcribe_voice", lambda self, **kw: {"transcript": "see you at ten"})

    response = client.post(
        "/api/v1/smartflow/ai/transcribe",
        headers=headers,
        files={"audio_file": ("voice.webm", b"\x1a\x45\xdf\xa3fakeaudio", "audio/webm")},
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"] == {"transcript": "see you at ten"}
    assert asyncio.run(mock_db.messages.count_documents({})) == 0  # nothing chatted or stored
