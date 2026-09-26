from __future__ import annotations

import asyncio

from bson import ObjectId

from app.core.config import settings
from app.services.call_service import CallService
from app.services.smartflow.conversation_service import ConversationService
from app.tests.test_team_direct_messaging import _same_org, _signup

WEBHOOK = "/api/v1/smartflow/integrations/sms/webhook"


def _business_with_number(client, mock_db, email: str, number: str) -> tuple[dict, str]:
    headers, owner_id = _signup(client, mock_db, email, "Owner")
    _same_org(mock_db, owner_id)
    asyncio.run(mock_db.organizations.insert_one({"organization_id": owner_id, "telnyx_mode": "provisioned", "telnyx_phone_number": number}))
    return headers, owner_id


def _received(from_number: str, to_number: str, text: str, message_id: str = "sms-1") -> dict:
    return {
        "data": {
            "event_type": "message.received",
            "id": f"evt-{message_id}",
            "occurred_at": "2026-09-26T10:00:00Z",
            "payload": {
                "id": message_id,
                "direction": "inbound",
                "from": {"phone_number": from_number},
                "to": [{"phone_number": to_number}],
                "text": text,
                "received_at": "2026-09-26T10:00:00Z",
            },
        }
    }


def test_inbound_sms_lands_in_the_number_owners_inbox(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    headers, owner_id = _business_with_number(client, mock_db, "sms-owner@example.com", "+15550001111")

    response = client.post(WEBHOOK, json=_received("+15552223333", "+15550001111", "Do you have openings tomorrow?"))
    assert response.status_code == 200 and response.json()["data"]["status"] == "processed"

    items = client.get("/api/v1/smartflow/conversations", headers=headers, params={"platform": "sms"}).json()["data"]["items"]
    assert len(items) == 1 and items[0]["last_message_preview"] == "Do you have openings tomorrow?"
    contact = asyncio.run(mock_db.contacts.find_one({"user_id": owner_id}))
    assert contact["phone"] == "+15552223333"

    # Telnyx retries the same event - stored once.
    client.post(WEBHOOK, json=_received("+15552223333", "+15550001111", "Do you have openings tomorrow?"))
    assert asyncio.run(mock_db.messages.count_documents({"platform": "sms"})) == 1


def test_sms_to_an_unknown_number_is_ignored(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    response = client.post(WEBHOOK, json=_received("+15552223333", "+15559999999", "hello?"))
    assert response.json()["data"] == {"status": "ignored", "reason": "unknown_number"}
    assert asyncio.run(mock_db.messages.count_documents({})) == 0


def test_unsigned_sms_webhook_is_refused_outside_development(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    response = client.post(WEBHOOK, json=_received("+15552223333", "+15550001111", "spoof"))
    assert response.status_code == 401
    assert asyncio.run(mock_db.messages.count_documents({})) == 0


def test_sms_reply_goes_out_from_the_business_number_and_receipt_updates_it(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    _, owner_id = _business_with_number(client, mock_db, "sms-reply@example.com", "+15550004444")
    client.post(WEBHOOK, json=_received("+15556667777", "+15550004444", "hi"))
    inbound = asyncio.run(mock_db.messages.find_one({"platform": "sms"}))

    sent = []

    async def fake_send(self, *, to_number, message, from_number=None):
        sent.append((to_number, from_number, message))
        return {"data": {"id": "telnyx-out-1"}}

    monkeypatch.setattr(CallService, "send_sms", fake_send)
    reply = asyncio.run(mock_db.messages.insert_one({"conversation_id": inbound["conversation_id"], "user_id": owner_id, "platform": "sms", "content": "Yes, 10am"}))
    asyncio.run(
        ConversationService(mock_db)._finalize_outbound_delivery(
            user_id=owner_id, conversation_id=inbound["conversation_id"], message_id=str(reply.inserted_id),
            platform="sms", contact_id=inbound["contact_id"], content="Yes, 10am",
        )
    )
    assert sent == [("+15556667777", "+15550004444", "Yes, 10am")]
    assert asyncio.run(mock_db.messages.find_one({"_id": reply.inserted_id}))["provider_message_id"] == "telnyx-out-1"

    receipt = {
        "data": {
            "event_type": "message.finalized",
            "payload": {"id": "telnyx-out-1", "to": [{"phone_number": "+15556667777", "status": "delivery_failed"}], "errors": [{"title": "Unreachable"}]},
        }
    }
    assert client.post(WEBHOOK, json=receipt).status_code == 200
    stored = asyncio.run(mock_db.messages.find_one({"_id": reply.inserted_id}))
    assert stored["status"] == "failed" and "Unreachable" in stored["delivery_error"]


def test_sms_reply_without_a_business_number_fails_with_a_reason(client, mock_db):
    _, owner_id = _signup(client, mock_db, "sms-nonumber@example.com", "Owner")
    _same_org(mock_db, owner_id)
    contact_id = asyncio.run(mock_db.contacts.insert_one({"user_id": owner_id, "phone": "+15551112222", "identities": [{"platform": "sms", "external_id": "+15551112222"}]})).inserted_id
    errors: list[str] = []
    delivered = asyncio.run(ConversationService(mock_db)._deliver_outbound(owner_id, "sms", str(contact_id), "hi", errors))
    assert delivered is False and "no SMS number" in errors[0]
