"""Provider failure and browser fallback regression tests; no real communications."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from app.api.v1.endpoints import calls as call_routes
from app.services.call_service import CallService
from app.services.email_service import EmailService
from app.services.smartflow.receptionist_action_service import ReceptionistActionService
from app.services.smartflow_service import SmartFlowService
from app.tests.test_realtime_receptionist import FakeOpenAI, _business, _receptionist


@pytest.mark.parametrize("tool,recipient", [("send_sms", "+15551234567"), ("send_email", "caller@example.com")])
def test_provider_timeout_never_becomes_a_success_or_automatic_duplicate(client, mock_db, monkeypatch, tool, recipient):
    owner = _business(client, mock_db, monkeypatch, f"timeout-{tool}@example.com")
    attempts = []
    async def fail(*args, **kwargs):
        attempts.append(kwargs)
        raise TimeoutError("Provider response did not arrive")
    monkeypatch.setattr(CallService, "send_sms", fail)
    monkeypatch.setattr(EmailService, "send_business_email", fail)
    async def run():
        agent = _receptionist(mock_db, owner, FakeOpenAI())
        result = await agent.run_tool(tool, {"recipient": recipient, "message": "Requested information", "caller_confirmed": True})
        assert result.get("sent") is not True, result
        assert result.get("error") or result.get("status") or result.get("note"), result
        assert len(attempts) == 1
        assert not any(item.get("status") in {"sent", "delivered"} for item in await mock_db.messages.find({}).to_list(length=20))
    asyncio.run(run())


@pytest.mark.parametrize("tool,recipient", [("send_sms", "+15551234567"), ("send_email", "caller@example.com")])
def test_failed_approved_delivery_cannot_be_replayed_by_review_retry(client, mock_db, monkeypatch, tool, recipient):
    owner = _business(client, mock_db, monkeypatch, f"approved-timeout-{tool}@example.com", ai_capabilities={tool: "human_approval_required"})
    attempts = []
    async def fail(*args, **kwargs):
        attempts.append(kwargs)
        raise TimeoutError("Provider response did not arrive")
    monkeypatch.setattr(CallService, "send_sms", fail)
    monkeypatch.setattr(EmailService, "send_business_email", fail)
    async def run():
        agent = _receptionist(mock_db, owner, FakeOpenAI())
        pending = await agent.run_tool(tool, {"recipient": recipient, "message": "Requested information", "caller_confirmed": True})
        assert not attempts
        service = ReceptionistActionService(mock_db)
        result = await service.decide(owner, pending["request_id"], approve=True)
        assert result["status"] == "failed", result
        with pytest.raises(Exception) as error:
            await service.decide(owner, pending["request_id"], approve=True)
        assert getattr(error.value, "status_code", None) == 409
        assert len(attempts) == 1
    asyncio.run(run())


@pytest.mark.parametrize("fallback", ["timeout", "bridge_failure"])
@pytest.mark.parametrize("permission", ["disabled", "human_approval_required", "ai_allowed"])
def test_real_browser_fallback_handlers_apply_answer_permission_once(client, mock_db, monkeypatch, fallback, permission):
    owner = _business(client, mock_db, monkeypatch, f"browser-{fallback}-{permission}@example.com", ai_capabilities={"answer_calls": permission})
    answers = []
    async def hangup(*args, **kwargs):
        return None
    monkeypatch.setattr(CallService, "hangup_call", hangup)
    async def answer(self, call_id, **kwargs):
        answers.append(call_id)
    async def bridge(*args, **kwargs):
        return False
    monkeypatch.setattr(CallService, "answer_call", answer)
    monkeypatch.setattr(call_routes.call_service, "bridge_calls", bridge)
    async def run():
        inbound_id, browser_id = "inbound-local-acceptance", "browser-local-acceptance"
        await mock_db.call_logs.insert_one({"twilio_call_sid": inbound_id, "user_id": owner, "status": "ringing", "direction": "inbound"})
        call_routes.pending_browser_rings[browser_id] = inbound_id
        try:
            for _ in range(2):
                if fallback == "timeout":
                    await call_routes._handle_browser_ring_hangup(browser_id, SimpleNamespace(hangup_cause="timeout"), SmartFlowService(mock_db))
                else:
                    await call_routes._handle_browser_ring_answered(browser_id, SmartFlowService(mock_db))
            assert answers == ([inbound_id] if permission == "ai_allowed" else [])
            assert await mock_db.receptionist_actions.count_documents({}) == (1 if permission == "human_approval_required" else 0)
        finally:
            call_routes.pending_browser_rings.pop(browser_id, None)
    asyncio.run(run())


def test_browser_rejection_never_runs_ai_even_when_ai_is_allowed(client, mock_db, monkeypatch):
    owner = _business(client, mock_db, monkeypatch, "browser-rejection-local@example.com", ai_capabilities={"answer_calls": "ai_allowed"})
    hangups = []
    async def hangup(call_id):
        hangups.append(call_id)
    async def forbidden(*args, **kwargs):
        raise AssertionError("Browser rejection must not answer with AI")
    monkeypatch.setattr(call_routes.call_service, "hangup_call", hangup)
    monkeypatch.setattr(CallService, "answer_call", forbidden)
    async def run():
        await mock_db.call_logs.insert_one({"twilio_call_sid": "declined-inbound", "user_id": owner, "status": "ringing"})
        call_routes.pending_browser_rings["declined-browser"] = "declined-inbound"
        try:
            await call_routes._handle_browser_ring_hangup("declined-browser", SimpleNamespace(hangup_cause="call_rejected"), SmartFlowService(mock_db))
            assert hangups == ["declined-inbound"]
        finally:
            call_routes.pending_browser_rings.pop("declined-browser", None)
    asyncio.run(run())
