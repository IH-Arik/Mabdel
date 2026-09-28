from __future__ import annotations

import asyncio

from app.services.call_service import CallService
from app.services.email_service import EmailService
from app.services.smartflow._base import SmartFlowBase
from app.services.smartflow.bulk_message_service import BulkMessageService
from app.tests.test_team_direct_messaging import _same_org, _signup


def _fake_channels(monkeypatch):
    sent = {"email": [], "sms": []}

    async def fake_email(self, **kwargs) -> None:
        sent["email"].append(kwargs)

    async def fake_sms(self, *, to_number: str, message: str, from_number: str | None = None) -> dict:
        sent["sms"].append({"to": to_number, "message": message})
        return {}

    monkeypatch.setattr(EmailService, "send_business_email", fake_email)
    monkeypatch.setattr(CallService, "send_sms", fake_sms)
    return sent


def _contact(client, headers, name, email, phone):
    response = client.post("/api/v1/smartflow/contacts", headers=headers, json={"name": name, "email": email, "phone": phone})
    assert response.status_code == 201, response.text
    return response.json()["data"]["id"]


def test_name_phone_and_date_are_filled_in_for_every_recipient(client, mock_db, monkeypatch):
    sent = _fake_channels(monkeypatch)
    headers, _ = _signup(client, mock_db, "bulk-vars@example.com", "Owner")
    karim = _contact(client, headers, "Karim Rahman", "karim@example.com", "+8801711111111")

    response = client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={
            "channel": "email",
            "contact_ids": [karim],
            "recipient_emails": ["walkin@example.com"],
            "subject": "Hello {name}",
            "content": "Hi {name},\nyour number {phone} is on file. Today is {date}.",
            "send_now": True,
        },
    )
    assert response.status_code == 201, response.text
    by_address = {item["email"]: item for item in sent["email"]}
    karim_mail = by_address["karim@example.com"]
    assert karim_mail["subject"] == "Hello Karim Rahman"
    assert "Hi Karim Rahman," in karim_mail["text"] and "+8801711111111" in karim_mail["text"] and "{" not in karim_mail["text"]
    assert by_address["walkin@example.com"]["subject"] == "Hello there"  # no name known: never "Hello walkin@..."
    assert "Hi there," in by_address["walkin@example.com"]["text"]


def test_line_breaks_survive_in_the_email(client, mock_db, monkeypatch):
    sent = _fake_channels(monkeypatch)
    headers, _ = _signup(client, mock_db, "bulk-br@example.com", "Owner")
    client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={"channel": "email", "recipient_emails": ["a@example.com"], "subject": "S", "content": "Line one\nLine two <b>", "send_now": True},
    )
    html = sent["email"][0]["html"]
    assert "Line one<br>Line two &lt;b&gt;" in html


def test_sms_variables_and_parts_for_non_latin_text(client, mock_db, monkeypatch):
    sent = _fake_channels(monkeypatch)
    headers, _ = _signup(client, mock_db, "bulk-sms-vars@example.com", "Owner")
    karim = _contact(client, headers, "Karim", "karim@example.com", "+8801711111111")
    response = client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={"channel": "sms", "contact_ids": [karim], "content": "{name}, আপনার অ্যাপয়েন্টমেন্ট কাল।", "send_now": True},
    )
    assert response.status_code == 201, response.text
    assert sent["sms"][0]["message"].startswith("Karim, আপনার")
    assert SmartFlowBase._bulk_segment_count("sms", "a" * 160) == 1
    assert SmartFlowBase._bulk_segment_count("sms", "a" * 161) == 2
    assert SmartFlowBase._bulk_segment_count("sms", "ক" * 70) == 1
    assert SmartFlowBase._bulk_segment_count("sms", "ক" * 71) == 2  # Bengali is 70 a part, not 160


def test_a_teammate_can_message_the_owners_contacts_and_groups(client, mock_db, monkeypatch):
    sent = _fake_channels(monkeypatch)
    owner_headers, owner_id = _signup(client, mock_db, "bulk-team-owner@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "bulk-team-mate@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)
    karim = _contact(client, owner_headers, "Karim", "karim@example.com", "+8801711111111")
    nadia = _contact(client, owner_headers, "Nadia", "nadia@example.com", "+8801722222222")
    group = client.post("/api/v1/smartflow/groups", headers=owner_headers, json={"name": "Crew", "member_ids": [nadia, mate_id]}).json()["data"]["id"]

    checked = client.post(
        "/api/v1/smartflow/bulk-messages/recipients/validate",
        headers=mate_headers,
        json={"channel": "email", "contact_ids": [karim], "group_ids": [group]},
    ).json()["data"]
    assert checked["valid_count"] == 2 and not checked["unavailable_contact_ids"] and not checked["unavailable_group_ids"]


def test_two_sends_at_once_deliver_only_once(client, mock_db, monkeypatch):
    sent = _fake_channels(monkeypatch)
    headers, owner_id = _signup(client, mock_db, "bulk-race@example.com", "Owner")
    created = client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={"channel": "email", "recipient_emails": ["a@example.com", "b@example.com", "c@example.com"], "subject": "S", "content": "Hi", "send_now": False},
    ).json()["data"]
    assert created["status"] == "draft"

    async def double_click():
        service = BulkMessageService(mock_db)
        return await asyncio.gather(service.send_bulk_message(owner_id, created["id"]), service.send_bulk_message(owner_id, created["id"]))

    first, second = asyncio.run(double_click())
    assert len(sent["email"]) == 3  # three recipients, one delivery each
    assert {first["status"], second["status"]} <= {"sent", "processing"}


def test_searching_broadcasts_by_text_with_symbols_does_not_crash(client, mock_db, monkeypatch):
    _fake_channels(monkeypatch)
    headers, _ = _signup(client, mock_db, "bulk-search@example.com", "Owner")
    client.post("/api/v1/smartflow/bulk-messages", headers=headers, json={"channel": "email", "recipient_emails": ["a@example.com"], "subject": "Sale (50%)", "content": "Hi", "send_now": False})
    for term in ("(", "[x", "a*"):
        assert client.get("/api/v1/smartflow/bulk-messages", headers=headers, params={"search": term}).status_code == 200, term
    found = client.get("/api/v1/smartflow/bulk-messages", headers=headers, params={"search": "Sale ("}).json()["data"]["items"]
    assert len(found) == 1
