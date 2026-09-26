from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from bson import ObjectId

from app.services.smartflow.conversation_service import ConversationService
from app.services.smartflow.integration_service import IntegrationService
from app.tests.test_team_direct_messaging import _same_org, _signup


def _inbound(mock_db, owner_id: str, platform: str, external_id: str, content: str, *, name=None, when=None, history=False, event_id=None):
    service = IntegrationService(mock_db)
    payload = {
        "event_id": event_id or f"{platform}-{external_id}-{content}",
        "contact_external_id": external_id,
        "content": content,
        "contact_name": name,
        "direction": "inbound",
        "timestamp": when,
    }
    return asyncio.run(service._record_inbound_message(owner_id, platform, payload, is_history_import=history))


def _list(client, headers, **params):
    response = client.get("/api/v1/smartflow/conversations", headers=headers, params={"page_size": 50, **params})
    assert response.status_code == 200, response.text
    return response.json()["data"]


def test_teammate_sees_and_reads_the_owners_customer_threads_but_another_business_does_not(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "inbox-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "inbox-mate@example.com", "Mate")
    stranger_headers, _ = _signup(client, mock_db, "inbox-stranger@example.com", "Stranger")
    _same_org(mock_db, owner_id, mate_id)

    message = _inbound(mock_db, owner_id, "whatsapp", "8801711111111@s.whatsapp.net", "Is the flat free?", name="Karim")
    conversation_id = message["conversation_id"]

    items = _list(client, mate_headers)["items"]
    assert [item["id"] for item in items] == [conversation_id]
    assert items[0]["contact_name"] == "Karim" and items[0]["unread_count"] == 1

    thread = client.get(f"/api/v1/smartflow/conversations/{conversation_id}/messages", headers=mate_headers)
    assert thread.status_code == 200 and thread.json()["data"]["items"][0]["content"] == "Is the flat free?"
    assert thread.json()["data"]["items"][0]["sender_name"] == "Karim"

    assert client.post(f"/api/v1/smartflow/conversations/{conversation_id}/mark-read", headers=mate_headers).status_code == 200
    assert _list(client, owner_headers)["items"][0]["unread_count"] == 0  # read for the whole team

    assert _list(client, stranger_headers)["items"] == []
    assert client.get(f"/api/v1/smartflow/conversations/{conversation_id}/messages", headers=stranger_headers).status_code == 404


def test_teammate_reply_goes_out_through_the_owners_connection(client, mock_db, monkeypatch):
    _, owner_id = _signup(client, mock_db, "reply-owner@example.com", "Owner")
    _, mate_id = _signup(client, mock_db, "reply-mate@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)
    asyncio.run(mock_db.social_integrations.insert_one({"user_id": owner_id, "platform": "whatsapp", "status": "connected", "organization_id": owner_id}))
    message = _inbound(mock_db, owner_id, "whatsapp", "8801722222222@s.whatsapp.net", "hello")

    sent = []

    async def fake_whatsapp(self, integration, token, recipient, content, errors=None, receipt=None):
        sent.append((integration["user_id"], recipient, content))
        return True

    monkeypatch.setattr(ConversationService, "_deliver_whatsapp", fake_whatsapp)
    service = ConversationService(mock_db)
    reply = asyncio.run(mock_db.messages.insert_one({"conversation_id": message["conversation_id"], "user_id": owner_id, "content": "yes"}))
    asyncio.run(
        service._finalize_outbound_delivery(
            user_id=mate_id,
            conversation_id=message["conversation_id"],
            message_id=str(reply.inserted_id),
            platform="whatsapp",
            contact_id=message["contact_id"],
            content="yes",
        )
    )

    assert sent == [(owner_id, "8801722222222", "yes")]  # the canonical number, via the owner's link


def test_failed_reply_records_a_readable_reason(client, mock_db):
    _, owner_id = _signup(client, mock_db, "fail-owner@example.com", "Owner")
    message = _inbound(mock_db, owner_id, "whatsapp", "8801733333333@s.whatsapp.net", "hi")
    service = ConversationService(mock_db)
    reply = asyncio.run(mock_db.messages.insert_one({"conversation_id": message["conversation_id"], "user_id": owner_id, "content": "hey"}))

    asyncio.run(
        service._finalize_outbound_delivery(
            user_id=owner_id,
            conversation_id=message["conversation_id"],
            message_id=str(reply.inserted_id),
            platform="whatsapp",
            contact_id=message["contact_id"],
            content="hey",
        )
    )

    stored = asyncio.run(mock_db.messages.find_one({"_id": reply.inserted_id}))
    assert stored["status"] == "failed"
    assert "not connected" in stored["delivery_error"]


def test_assignment_and_the_mine_unassigned_filters(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "assign-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "assign-mate@example.com", "Mate")
    _, outsider_id = _signup(client, mock_db, "assign-outsider@example.com", "Outsider")
    _same_org(mock_db, owner_id, mate_id)
    first = _inbound(mock_db, owner_id, "whatsapp", "8801744444444@s.whatsapp.net", "one")
    _inbound(mock_db, owner_id, "facebook_messenger", "PSID-1", "two")

    assert client.patch(
        f"/api/v1/smartflow/conversations/{first['conversation_id']}/assign", headers=owner_headers, json={"assignee_id": outsider_id}
    ).status_code == 404
    assigned = client.patch(
        f"/api/v1/smartflow/conversations/{first['conversation_id']}/assign", headers=owner_headers, json={"assignee_id": mate_id}
    )
    assert assigned.status_code == 200 and assigned.json()["data"]["assigned_to"] == mate_id

    mine = _list(client, mate_headers, assignee="me")
    assert [item["id"] for item in mine["items"]] == [first["conversation_id"]]
    assert len(_list(client, mate_headers, assignee="unassigned")["items"]) == 1
    summary = _list(client, mate_headers)["summary"]
    assert summary["assigned_to_me_count"] == 1 and summary["unassigned_count"] == 1
    assert summary["conversation_counts"] == {"whatsapp": 1, "facebook_messenger": 1}
    assert asyncio.run(mock_db.notifications.count_documents({"user_id": mate_id, "title": "A conversation was assigned to you"})) == 1

    members = client.get("/api/v1/smartflow/conversations/assignees", headers=mate_headers).json()["data"]
    assert {member["id"] for member in members} == {owner_id, mate_id}


def test_history_import_keeps_real_order_instead_of_import_time(client, mock_db):
    headers, owner_id = _signup(client, mock_db, "order-owner@example.com", "Owner")
    recent = _inbound(mock_db, owner_id, "whatsapp", "8801755555555@s.whatsapp.net", "live today")
    old = _inbound(
        mock_db, owner_id, "whatsapp", "8801766666666@s.whatsapp.net", "from last year",
        when=datetime(2025, 1, 5, tzinfo=timezone.utc), history=True,
    )

    ids = [item["id"] for item in _list(client, headers)["items"]]
    assert ids == [recent["conversation_id"], old["conversation_id"]]


def test_qr_and_official_whatsapp_ids_land_on_one_contact_with_a_phone(client, mock_db):
    _, owner_id = _signup(client, mock_db, "wa-merge@example.com", "Owner")
    qr = _inbound(mock_db, owner_id, "whatsapp", "8801777777777:12@s.whatsapp.net", "via QR")
    official = _inbound(mock_db, owner_id, "whatsapp", "8801777777777", "via Cloud API", name="Rahim")

    assert qr["contact_id"] == official["contact_id"] and qr["conversation_id"] == official["conversation_id"]
    contact = asyncio.run(mock_db.contacts.find_one({"_id": ObjectId(qr["contact_id"])}))
    assert contact["phone"] == "+8801777777777"
    assert contact["name"] == "Rahim"  # the placeholder is replaced once a real name arrives


def test_our_own_profile_name_never_becomes_the_customer_name(client, mock_db):
    _, owner_id = _signup(client, mock_db, "wa-self@example.com", "Owner")
    service = IntegrationService(mock_db)
    asyncio.run(
        service._record_inbound_message(
            owner_id,
            "whatsapp",
            {"event_id": "out-1", "contact_external_id": "8801788888888@s.whatsapp.net", "content": "sent from phone", "contact_name": "Our Shop", "direction": "outbound"},
            is_history_import=False,
        )
    )
    contact = asyncio.run(mock_db.contacts.find_one({"user_id": owner_id}))
    assert contact["name"] == "WhatsApp Contact"


def test_contact_panel_links_the_same_person_on_other_channels(client, mock_db):
    headers, owner_id = _signup(client, mock_db, "panel-owner@example.com", "Owner")
    whatsapp = _inbound(mock_db, owner_id, "whatsapp", "8801799999999@s.whatsapp.net", "hi", name="Nadia")
    sms = _inbound(mock_db, owner_id, "sms", "+8801799999999", "hi by sms")

    response = client.get(f"/api/v1/smartflow/conversations/{whatsapp['conversation_id']}/contact", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["contact"]["phone"] == "+8801799999999"
    assert [(item["id"], item["platform"]) for item in data["related"]] == [(sms["conversation_id"], "sms")]


def test_gateway_contact_names_fill_placeholders_and_bridge_lid_threads(client, mock_db):
    _, owner_id = _signup(client, mock_db, "wa-names@example.com", "Owner")
    by_number = _inbound(mock_db, owner_id, "whatsapp", "8801755500000@s.whatsapp.net", "hi")
    by_lid = _inbound(mock_db, owner_id, "whatsapp", "998877@lid", "hello")
    named = _inbound(mock_db, owner_id, "whatsapp", "8801755500001@s.whatsapp.net", "yo", name="Typed Name")
    service = IntegrationService(mock_db)

    result = asyncio.run(
        service.apply_whatsapp_contact_names(
            owner_id,
            [
                {"phone_jid": "8801755500000@s.whatsapp.net", "lid": None, "name": "Nadia"},
                {"phone_jid": "8801755500002@s.whatsapp.net", "lid": "998877@lid", "name": "Rafi"},
                {"phone_jid": "8801755500001@s.whatsapp.net", "lid": None, "name": "Other"},
                {"phone_jid": "8801799990000@s.whatsapp.net", "lid": None, "name": "Not a customer"},
            ],
        )
    )

    contact = lambda message: asyncio.run(mock_db.contacts.find_one({"_id": ObjectId(message["contact_id"])}))
    assert contact(by_number)["name"] == "Nadia"
    lid_contact = contact(by_lid)
    assert lid_contact["name"] == "Rafi" and lid_contact["phone"] == "+8801755500002"
    assert contact(named)["name"] == "Typed Name"  # a real name is never overwritten
    assert asyncio.run(mock_db.contacts.count_documents({"user_id": owner_id})) == 3  # no address-book contacts created
    assert result["updated"] == 2  # Nadia and Rafi; the typed-name contact had nothing to fill
    conversation = asyncio.run(mock_db.conversations.find_one({"_id": ObjectId(by_number["conversation_id"])}))
    assert conversation["title"] == "Nadia"

    # A later message addressed by the number reaches the same @lid thread.
    again = _inbound(mock_db, owner_id, "whatsapp", "8801755500002@s.whatsapp.net", "same person")
    assert again["conversation_id"] == by_lid["conversation_id"]
