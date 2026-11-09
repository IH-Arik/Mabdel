from __future__ import annotations

import asyncio

from bson import ObjectId

from app.core.config import settings
from app.tests.test_webhooks import _create_user

WEBHOOK = "/api/v1/smartflow/integrations/{platform}/webhook"


def _connect(mock_db, user_id: str, platform: str, account_id: str) -> None:
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {"user_id": user_id, "platform": platform, "status": "connected", "external_account_id": account_id}
        )
    )


def _messenger(events: list[dict], page_id: str = "PAGE1") -> dict:
    return {"object": "page", "entry": [{"id": page_id, "time": 1758900000000, "messaging": events}]}


def _dm(mid: str, text: str, sender: str = "PSID_A", page_id: str = "PAGE1", ts: int = 1758900000000) -> dict:
    return {"sender": {"id": sender}, "recipient": {"id": page_id}, "timestamp": ts, "message": {"mid": mid, "text": text}}


def test_batched_messenger_delivery_stores_every_message(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    user_id = asyncio.run(_create_user(mock_db, email="meta-batch@example.com"))
    _connect(mock_db, user_id, "facebook_messenger", "PAGE1")

    response = client.post(
        WEBHOOK.format(platform="facebook_messenger"),
        json=_messenger([_dm("m1", "first", sender="PSID_A"), _dm("m2", "second", sender="PSID_B", ts=1758900001000)]),
    )

    assert response.status_code == 200, response.text
    assert response.json()["data"] == {"status": "processed", "processed": 2, "ignored": 0}
    assert asyncio.run(mock_db.messages.count_documents({"platform": "facebook_messenger"})) == 2
    stored = asyncio.run(mock_db.messages.find_one({"provider_event_id": "m2"}))
    assert stored["timestamp"].year == 2025  # the event's own time, not "now"


def test_echo_is_stored_as_outbound_without_notifying(client, mock_db, monkeypatch):
    """When a page owner replies from Meta's own inbox, Meta echoes it back with the
    page as sender - it belongs in the thread of the *recipient*, as an outbound message."""
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    user_id = asyncio.run(_create_user(mock_db, email="meta-echo@example.com"))
    _connect(mock_db, user_id, "facebook_messenger", "PAGE1")
    client.post(WEBHOOK.format(platform="facebook_messenger"), json=_messenger([_dm("m1", "hi")]))
    notifications = asyncio.run(mock_db.notifications.count_documents({"user_id": user_id}))

    echo = {
        "sender": {"id": "PAGE1"},
        "recipient": {"id": "PSID_A"},
        "timestamp": 1758900005000,
        "message": {"mid": "m-echo", "is_echo": True, "text": "our reply"},
    }
    response = client.post(WEBHOOK.format(platform="facebook_messenger"), json=_messenger([echo]))

    assert response.status_code == 200
    stored = asyncio.run(mock_db.messages.find_one({"provider_event_id": "m-echo"}))
    assert stored["direction"] == "outbound"
    conversations = asyncio.run(mock_db.conversations.count_documents({"platform": "facebook_messenger"}))
    assert conversations == 1  # same PSID thread, not a new one for the page
    assert asyncio.run(mock_db.notifications.count_documents({"user_id": user_id})) == notifications


def test_receipts_and_reads_are_acknowledged_not_errors(client, mock_db, monkeypatch):
    """Meta sends delivery/read events to the same URL and retries any non-200 for 36
    hours - they must be a quiet 200 with nothing stored."""
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    user_id = asyncio.run(_create_user(mock_db, email="meta-receipt@example.com"))
    _connect(mock_db, user_id, "facebook_messenger", "PAGE1")

    delivery = {"sender": {"id": "PSID_A"}, "recipient": {"id": "PAGE1"}, "delivery": {"mids": ["m1"], "watermark": 4}}
    read = {"sender": {"id": "PSID_A"}, "recipient": {"id": "PAGE1"}, "timestamp": 5, "read": {"watermark": 5}}
    response = client.post(WEBHOOK.format(platform="facebook_messenger"), json=_messenger([delivery, read]))

    assert response.status_code == 200
    assert response.json()["data"]["processed"] == 0
    assert asyncio.run(mock_db.messages.count_documents({})) == 0


# ── Section 6 (client audit): AI summary + opt-in auto-reply ───────────────


def _fake_summarize(monkeypatch, summary: dict):
    from app.services.gocustify_ai_service import GoCustifyAIService

    monkeypatch.setattr(GoCustifyAIService, "summarize_social_message", lambda self, content, sender_name=None: summary)


def _fake_answer(monkeypatch, reply_text):
    from app.services.gocustify_ai_service import GoCustifyAIService

    calls = []

    def fake(self, content, business_context):
        calls.append({"content": content, "business_context": business_context})
        return reply_text

    monkeypatch.setattr(GoCustifyAIService, "answer_social_message", fake)
    return calls


def test_inbound_messenger_message_gets_an_ai_summary_stored(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    _fake_summarize(monkeypatch, {"summary": "Asking about pricing", "requirement": "pricing", "status": "generated"})
    _fake_answer(monkeypatch, None)
    user_id = asyncio.run(_create_user(mock_db, email="meta-summary@example.com"))
    _connect(mock_db, user_id, "facebook_messenger", "PAGE1")

    client.post(WEBHOOK.format(platform="facebook_messenger"), json=_messenger([_dm("m1", "how much do you charge?")]))

    stored = asyncio.run(mock_db.messages.find_one({"provider_event_id": "m1"}))
    assert stored["ai_summary"]["requirement"] == "pricing"


def test_auto_reply_is_not_sent_when_disabled(client, mock_db, monkeypatch):
    """Default-off: no organization has social_auto_reply_enabled set, so no reply
    should be generated or sent even though the AI could answer."""
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    _fake_summarize(monkeypatch, {"status": "no_content"})
    answer_calls = _fake_answer(monkeypatch, "We're open 9-5 Mon-Fri!")
    user_id = asyncio.run(_create_user(mock_db, email="meta-noauto@example.com"))
    _connect(mock_db, user_id, "facebook_messenger", "PAGE1")

    client.post(WEBHOOK.format(platform="facebook_messenger"), json=_messenger([_dm("m1", "what are your hours?")]))

    assert answer_calls == []
    assert asyncio.run(mock_db.messages.count_documents({"direction": "outbound"})) == 0


def test_auto_reply_is_sent_when_enabled(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    _fake_summarize(monkeypatch, {"status": "no_content"})
    answer_calls = _fake_answer(monkeypatch, "We're open 9-5 Mon-Fri!")

    async def fake_deliver(self, user_id, platform, contact_id, content, errors=None, receipt=None, conversation_id=None):
        return True

    import app.services.smartflow.conversation.delivery as delivery_module

    monkeypatch.setattr(delivery_module.ConversationDeliveryMixin, "_deliver_outbound", fake_deliver)

    user_id = asyncio.run(_create_user(mock_db, email="meta-auto@example.com"))
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"organization_id": user_id}}))
    asyncio.run(
        mock_db.organizations.insert_one({"organization_id": user_id, "social_auto_reply_enabled": True})
    )
    _connect(mock_db, user_id, "facebook_messenger", "PAGE1")

    client.post(WEBHOOK.format(platform="facebook_messenger"), json=_messenger([_dm("m1", "what are your hours?")]))

    assert len(answer_calls) == 1
    assert answer_calls[0]["content"] == "what are your hours?"
    reply = asyncio.run(mock_db.messages.find_one({"direction": "outbound", "content": "We're open 9-5 Mon-Fri!"}))
    assert reply is not None


def test_attachment_only_message_becomes_a_placeholder(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    user_id = asyncio.run(_create_user(mock_db, email="meta-attach@example.com"))
    _connect(mock_db, user_id, "facebook_messenger", "PAGE1")
    image = {
        "sender": {"id": "PSID_A"},
        "recipient": {"id": "PAGE1"},
        "timestamp": 1758900000000,
        "message": {"mid": "m-img", "attachments": [{"type": "image", "payload": {"url": "https://cdn.example/x.png"}}]},
    }

    response = client.post(WEBHOOK.format(platform="facebook_messenger"), json=_messenger([image]))

    assert response.status_code == 200
    stored = asyncio.run(mock_db.messages.find_one({"provider_event_id": "m-img"}))
    assert stored["content"] == "[Image]"
    assert stored["media_url"] == "https://cdn.example/x.png"


def test_each_entry_resolves_to_its_own_account(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    owner_one = asyncio.run(_create_user(mock_db, email="meta-owner1@example.com"))
    owner_two = asyncio.run(_create_user(mock_db, email="meta-owner2@example.com"))
    _connect(mock_db, owner_one, "facebook_messenger", "PAGE1")
    _connect(mock_db, owner_two, "facebook_messenger", "PAGE2")
    payload = {
        "object": "page",
        "entry": [
            {"id": "PAGE1", "messaging": [_dm("a1", "for one", page_id="PAGE1")]},
            {"id": "PAGE2", "messaging": [_dm("b1", "for two", page_id="PAGE2")]},
            {"id": "UNKNOWN", "messaging": [_dm("c1", "nobody's", page_id="UNKNOWN")]},
        ],
    }

    response = client.post(WEBHOOK.format(platform="facebook_messenger"), json=payload)

    assert response.status_code == 200
    assert response.json()["data"] == {"status": "processed", "processed": 2, "ignored": 1}
    assert asyncio.run(mock_db.messages.find_one({"provider_event_id": "a1"}))["user_id"] == owner_one
    assert asyncio.run(mock_db.messages.find_one({"provider_event_id": "b1"}))["user_id"] == owner_two


def test_redelivery_is_not_stored_twice(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    user_id = asyncio.run(_create_user(mock_db, email="meta-retry@example.com"))
    _connect(mock_db, user_id, "facebook_messenger", "PAGE1")
    body = _messenger([_dm("m1", "hello")])

    client.post(WEBHOOK.format(platform="facebook_messenger"), json=body)
    again = client.post(WEBHOOK.format(platform="facebook_messenger"), json=body)

    assert again.status_code == 200
    assert again.json()["data"]["processed"] == 0
    assert asyncio.run(mock_db.messages.count_documents({"platform": "facebook_messenger"})) == 1


def test_whatsapp_cloud_status_receipts_are_acknowledged(client, mock_db, monkeypatch):
    import hashlib
    import hmac
    import json

    monkeypatch.setattr(settings, "META_CLIENT_SECRET", "meta-app-secret")
    user_id = asyncio.run(_create_user(mock_db, email="meta-wa-status@example.com"))
    _connect(mock_db, user_id, "whatsapp", "PN1")
    status_update = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "WABA",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"phone_number_id": "PN1"},
                            "statuses": [{"id": "wamid.X", "status": "delivered", "recipient_id": "8801700000000"}],
                        },
                    }
                ],
            }
        ],
    }
    raw = json.dumps(status_update).encode()
    signature = "sha256=" + hmac.new(b"meta-app-secret", raw, hashlib.sha256).hexdigest()

    response = client.post(
        WEBHOOK.format(platform="whatsapp"),
        content=raw,
        headers={"content-type": "application/json", "X-Hub-Signature-256": signature},
    )

    assert response.status_code == 200
    assert asyncio.run(mock_db.messages.count_documents({})) == 0


def test_whatsapp_cloud_media_and_button_messages(client, mock_db, monkeypatch):
    import hashlib
    import hmac
    import json

    monkeypatch.setattr(settings, "META_CLIENT_SECRET", "meta-app-secret")
    user_id = asyncio.run(_create_user(mock_db, email="meta-wa-media@example.com"))
    _connect(mock_db, user_id, "whatsapp", "PN1")
    value = {
        "messaging_product": "whatsapp",
        "metadata": {"phone_number_id": "PN1"},
        "contacts": [{"profile": {"name": "Carol"}, "wa_id": "8801722222222"}],
        "messages": [
            {"from": "8801722222222", "id": "w-img", "timestamp": "1758900000", "type": "image", "image": {"id": "1", "caption": "receipt"}},
            {"from": "8801722222222", "id": "w-btn", "timestamp": "1758900001", "type": "interactive",
             "interactive": {"type": "button_reply", "button_reply": {"id": "y", "title": "Yes please"}}},
            {"from": "8801722222222", "id": "w-react", "timestamp": "1758900002", "type": "reaction", "reaction": {"emoji": "x"}},
        ],
    }
    body = {"object": "whatsapp_business_account", "entry": [{"id": "WABA", "changes": [{"field": "messages", "value": value}]}]}
    raw = json.dumps(body).encode()
    signature = "sha256=" + hmac.new(b"meta-app-secret", raw, hashlib.sha256).hexdigest()

    response = client.post(
        WEBHOOK.format(platform="whatsapp"),
        content=raw,
        headers={"content-type": "application/json", "X-Hub-Signature-256": signature},
    )

    assert response.status_code == 200
    assert response.json()["data"]["processed"] == 2  # the reaction is skipped
    assert asyncio.run(mock_db.messages.find_one({"provider_event_id": "w-img"}))["content"] == "[Image] receipt"
    assert asyncio.run(mock_db.messages.find_one({"provider_event_id": "w-btn"}))["content"] == "Yes please"
