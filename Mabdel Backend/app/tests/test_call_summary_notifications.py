from __future__ import annotations

import asyncio

from app.services.ai_phone_agent import AIPhoneAgent
from app.services.gocustify_ai_service import GoCustifyAIService
from app.services.smartflow_service import SmartFlowService
from app.utils.helpers import utc_now


def _make_agent(mock_db, user_id: str) -> AIPhoneAgent:
    flow_service = SmartFlowService(mock_db)
    agent = AIPhoneAgent("call_summary_1", GoCustifyAIService(), flow_service)
    agent.user_id = user_id
    agent.is_outbound = False
    agent.business_name = "Test Biz"
    return agent


def _fake_email(monkeypatch):
    from app.services.email_service import EmailService

    sent = []

    async def fake_send(self, **kwargs):
        sent.append(kwargs)

    monkeypatch.setattr(EmailService, "send", fake_send)
    return sent


def _fake_sms(monkeypatch):
    from app.services.call_service import CallService

    sent = []

    async def fake_send_sms(self, **kwargs):
        sent.append(kwargs)
        return {"status": "sent"}

    monkeypatch.setattr(CallService, "send_sms", fake_send_sms)
    return sent


def test_inbound_call_summary_emails_the_owner_and_texts_the_caller(mock_db, monkeypatch):
    sent_emails = _fake_email(monkeypatch)
    sent_sms = _fake_sms(monkeypatch)

    user_doc = {
        "email": "owner@example.com",
        "original_email": "owner@example.com",
        "role": "owner",
        "telnyx_phone_number": "+15550001111",
    }
    result = asyncio.run(mock_db.users.insert_one(user_doc))
    user_id = result.inserted_id

    agent = _make_agent(mock_db, user_id)
    call_log = {"direction": "inbound", "from_number": "+15559998888"}
    summary = {"purpose": "Caller wants to book a cleaning.", "status": "generated"}

    asyncio.run(agent._notify_summary(summary, call_log))

    assert len(sent_emails) == 1
    assert sent_emails[0]["email"] == "owner@example.com"
    assert "Caller wants to book a cleaning." in sent_emails[0]["text"]

    assert len(sent_sms) == 1
    assert sent_sms[0]["to_number"] == "+15559998888"
    assert sent_sms[0]["from_number"] == "+15550001111"
    assert "Caller wants to book a cleaning." in sent_sms[0]["message"]


def test_outbound_call_summary_emails_the_owner_but_does_not_text_the_business_itself(mock_db, monkeypatch):
    sent_emails = _fake_email(monkeypatch)
    sent_sms = _fake_sms(monkeypatch)

    user_doc = {"email": "owner2@example.com", "original_email": "owner2@example.com", "role": "owner"}
    result = asyncio.run(mock_db.users.insert_one(user_doc))
    agent = _make_agent(mock_db, result.inserted_id)
    agent.is_outbound = True
    call_log = {"direction": "outbound", "from_number": "+15550001111"}
    summary = {"purpose": "Reminder call completed.", "status": "generated"}

    asyncio.run(agent._notify_summary(summary, call_log))

    assert len(sent_emails) == 1
    assert sent_sms == []


def test_guest_call_sends_no_notifications(mock_db, monkeypatch):
    sent_emails = _fake_email(monkeypatch)
    sent_sms = _fake_sms(monkeypatch)

    agent = _make_agent(mock_db, "guest")
    asyncio.run(agent._notify_summary({"purpose": "hi", "status": "generated"}, {"direction": "inbound"}))

    assert sent_emails == []
    assert sent_sms == []


def test_empty_purpose_sends_no_notifications(mock_db, monkeypatch):
    sent_emails = _fake_email(monkeypatch)
    sent_sms = _fake_sms(monkeypatch)

    user_doc = {"email": "owner3@example.com", "original_email": "owner3@example.com", "role": "owner"}
    result = asyncio.run(mock_db.users.insert_one(user_doc))
    agent = _make_agent(mock_db, result.inserted_id)

    asyncio.run(agent._notify_summary({"status": "failed"}, {"direction": "inbound"}))

    assert sent_emails == []
    assert sent_sms == []
