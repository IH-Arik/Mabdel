from __future__ import annotations

import asyncio
import json
from datetime import date, datetime, timezone

from app.tests.test_realtime_receptionist import FakeCallControl, FakeOpenAI, _business, _receptionist
from app.tests.test_stripe_connect import FakeAccount, _install_fake_stripe


def _invoice_document(owner_id: str, *, status: str = "sent", client_phone: str | None = None, client_email: str | None = None, total_amount: float = 150.0) -> dict:
    now = datetime.now(timezone.utc)
    today = date.today()
    return {
        "owner_user_id": owner_id,
        "invoice_seq": 1,
        "invoice_number": "INV-0001",
        "client_name": "Nadia Rahman",
        "client_email": client_email,
        "client_phone": client_phone,
        "billing_address": None,
        "currency": "USD",
        "issue_date": today.isoformat(),
        "due_date": today.isoformat(),
        "subtotal": total_amount,
        "tax_rate": 0.0,
        "tax_amount": 0.0,
        "total_amount": total_amount,
        "notes": None,
        "status": status,
        "sent_at": now,
        "viewed_at": None,
        "paid_at": None,
        "items": [{"id": 1, "description": "Service", "details": None, "quantity": 1.0, "unit_price": total_amount, "line_total": total_amount, "sort_order": 0}],
        "timeline": [],
        "created_at": now,
        "updated_at": now,
    }


def _connect_stripe(mock_db, owner_id, monkeypatch) -> tuple[list, list]:
    account_store = {"acct_connected": FakeAccount(id="acct_connected", charges_enabled=True, details_submitted=True, payouts_enabled=True)}
    payment_link_calls: list[dict] = []
    _install_fake_stripe(monkeypatch, account_store, payment_link_calls)
    asyncio.run(
        mock_db.organizations.update_one(
            {"organization_id": owner_id},
            {"$set": {"stripe_account_id": "acct_connected", "stripe_charges_enabled": True}},
        )
    )
    return account_store, payment_link_calls


def test_send_payment_link_finds_an_unpaid_invoice_by_phone_and_texts_it(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "paylink-phone@example.com")
    _connect_stripe(mock_db, owner_id, monkeypatch)
    asyncio.run(mock_db.invoices.insert_one(_invoice_document(owner_id, client_phone="+15551230000")))

    control = FakeCallControl()

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI(), control=control)
        return await agent.run_tool("send_payment_link", json.dumps({}))

    result = asyncio.run(run())

    assert result["sent"] is True
    assert result["invoice_number"] == "INV-0001"
    assert result["amount"] == 150.0
    assert len(control.sms_sent) == 1
    assert control.sms_sent[0]["to_number"] == "+15551230000"
    assert "INV-0001" in control.sms_sent[0]["message"] and "150.00" in control.sms_sent[0]["message"]

    conversation = asyncio.run(mock_db.conversations.find_one({"user_id": owner_id, "platform": "ai_receptionist"}))
    message = asyncio.run(mock_db.messages.find_one({"conversation_id": str(conversation["_id"])}))
    assert "INV-0001" in message["content"]


def test_send_payment_link_finds_an_unpaid_invoice_by_email_when_phone_differs(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "paylink-email@example.com")
    _connect_stripe(mock_db, owner_id, monkeypatch)
    asyncio.run(
        mock_db.contacts.insert_one(
            {"user_id": owner_id, "name": "Nadia", "email": "nadia@example.com", "phone": "+15551230000", "identities": [], "presence": "offline"}
        )
    )
    asyncio.run(mock_db.invoices.insert_one(_invoice_document(owner_id, client_email="nadia@example.com", client_phone=None)))

    control = FakeCallControl()

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI(), control=control)
        return await agent.run_tool("send_payment_link", json.dumps({}))

    result = asyncio.run(run())
    assert result["sent"] is True
    assert len(control.sms_sent) == 1


def test_send_payment_link_refuses_safely_when_no_open_invoice_exists(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "paylink-none@example.com")
    _connect_stripe(mock_db, owner_id, monkeypatch)

    control = FakeCallControl()

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI(), control=control)
        return await agent.run_tool("send_payment_link", json.dumps({}))

    result = asyncio.run(run())
    assert result["sent"] is False
    assert control.sms_sent == []


def test_send_payment_link_ignores_a_paid_invoice(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "paylink-paid@example.com")
    _connect_stripe(mock_db, owner_id, monkeypatch)
    asyncio.run(mock_db.invoices.insert_one(_invoice_document(owner_id, client_phone="+15551230000", status="paid")))

    control = FakeCallControl()

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI(), control=control)
        return await agent.run_tool("send_payment_link", json.dumps({}))

    result = asyncio.run(run())
    assert result["sent"] is False
    assert control.sms_sent == []


def test_send_payment_link_refuses_safely_when_stripe_is_not_connected(client, mock_db, monkeypatch):
    owner_id = _business(client, mock_db, monkeypatch, "paylink-not-connected@example.com")
    asyncio.run(mock_db.invoices.insert_one(_invoice_document(owner_id, client_phone="+15551230000")))

    control = FakeCallControl()

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI(), control=control)
        return await agent.run_tool("send_payment_link", json.dumps({}))

    result = asyncio.run(run())
    assert result["sent"] is False
    assert control.sms_sent == []


def test_a_caller_can_never_get_a_dollar_amount_into_the_prompt_except_from_the_tool(client, mock_db, monkeypatch):
    """The AI must never invent a price - the prompt instructs it to only state what
    send_payment_link itself returns."""
    owner_id = _business(client, mock_db, monkeypatch, "paylink-prompt@example.com")

    async def run():
        agent = _receptionist(mock_db, owner_id, FakeOpenAI())
        return await agent.build_instructions()

    instructions = asyncio.run(run())
    assert "never estimate or invent a price" in instructions
    assert "Never ask the caller for card numbers" in instructions
    assert "send_payment_link" in instructions
