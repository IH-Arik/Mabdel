from __future__ import annotations

import asyncio
import json

from app.tests.test_realtime_receptionist import FakeCallControl, FakeOpenAI, _business, _receptionist


def _disable(mock_db, owner_id, capability: str) -> None:
    asyncio.run(
        mock_db.organizations.update_one(
            {"organization_id": owner_id}, {"$set": {f"ai_call_settings.ai_capabilities.{capability}": "disabled"}}
        )
    )


def test_take_message_refuses_when_disabled(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "cap-take-message@example.com")
    _disable(mock_db, owner_id, "take_message")

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        return await agent.run_tool("take_message", json.dumps({"message": "Please call me back", "caller_name": "Karim"}))

    result = asyncio.run(run())
    assert result["saved"] is False
    assert asyncio.run(mock_db.notifications.count_documents({"user_id": owner_id})) == 0
    assert asyncio.run(mock_db.conversations.count_documents({"platform": "ai_receptionist"})) == 0


def test_take_message_still_works_when_not_disabled(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "cap-take-message-ok@example.com")

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        return await agent.run_tool("take_message", json.dumps({"message": "Please call me back", "caller_name": "Karim"}))

    result = asyncio.run(run())
    assert result["saved"] is True


def test_transfer_to_human_refuses_when_disabled_even_with_a_transfer_number_configured(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "cap-transfer@example.com", transfer_number="+15559990000")
    _disable(mock_db, owner_id, "transfer_to_human")

    async def run():
        control = FakeCallControl()
        agent = _receptionist(mock_db, owner_id, FakeOpenAI(), control=control)
        result = await agent.run_tool("transfer_to_human", json.dumps({"reason": "caller asked for a person"}))
        return result, control

    result, control = asyncio.run(run())
    assert result["transferred"] is False
    assert control.transfers == []


def test_capture_lead_refuses_when_disabled(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "cap-lead@example.com")
    _disable(mock_db, owner_id, "capture_lead")

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        return await agent.run_tool(
            "capture_lead", json.dumps({"caller_name": "Priya", "phone": "+15559998888", "service_interested": "Cleaning"})
        )

    result = asyncio.run(run())
    assert result["saved"] is False
    assert asyncio.run(mock_db.contacts.count_documents({"user_id": owner_id})) == 0


def test_send_payment_link_refuses_when_disabled_even_with_an_open_invoice(client, mock_db, monkeypatch):
    from datetime import date, datetime, timezone

    owner_id = _business(client, mock_db, monkeypatch, "cap-payment@example.com")
    asyncio.run(
        mock_db.organizations.update_one(
            {"organization_id": owner_id},
            {"$set": {"stripe_account_id": "acct_connected", "stripe_charges_enabled": True}},
        )
    )
    today = date.today()
    now = datetime.now(timezone.utc)
    asyncio.run(
        mock_db.invoices.insert_one(
            {
                "owner_user_id": owner_id,
                "invoice_seq": 1,
                "invoice_number": "INV-0001",
                "client_name": "Nadia",
                "client_email": None,
                "client_phone": "+15551230000",
                "billing_address": None,
                "currency": "USD",
                "issue_date": today.isoformat(),
                "due_date": today.isoformat(),
                "subtotal": 100.0,
                "tax_rate": 0.0,
                "tax_amount": 0.0,
                "total_amount": 100.0,
                "notes": None,
                "status": "sent",
                "sent_at": now,
                "viewed_at": None,
                "paid_at": None,
                "items": [],
                "timeline": [],
                "created_at": now,
                "updated_at": now,
            }
        )
    )
    _disable(mock_db, owner_id, "send_payment_link")

    async def run():
        control = FakeCallControl()
        agent = _receptionist(mock_db, owner_id, FakeOpenAI(), control=control)
        result = await agent.run_tool("send_payment_link", json.dumps({}))
        return result, control

    result, control = asyncio.run(run())
    assert result["sent"] is False
    assert control.sms_sent == []


def test_a_capability_left_unset_defaults_to_allowed(client, mock_db, monkeypatch):
    """Capabilities with no legacy boolean (take_message, transfer, capture_lead,
    send_payment_link) must default to ai_allowed - today's actual behavior - for
    every existing business that has never touched this new settings section."""
    owner_id = _business(client, mock_db, monkeypatch, "cap-default-allowed@example.com")

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        return await agent.run_tool("take_message", json.dumps({"message": "hi", "caller_name": "X"}))

    result = asyncio.run(run())
    assert result["saved"] is True
