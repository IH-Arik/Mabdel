import asyncio

from bson import ObjectId
import pytest

from app.core.exceptions import AppException
from app.services.smartflow.appointment_notifications import AppointmentNotifier
from app.services.smartflow.receptionist_action_service import ReceptionistActionService
from app.services.smartflow.call_history_service import CallHistoryService
from app.tests.test_realtime_receptionist import FakeOpenAI, _business, _receptionist
from app.tests.test_ai_call_scheduling import _owner_with_org


def test_message_requires_approval_and_executes_only_once(client, mock_db, monkeypatch):
    owner = _business(client, mock_db, monkeypatch, "approve-message@example.com",
                      ai_capabilities={"take_message": "human_approval_required"})
    async def run():
        agent = _receptionist(mock_db, owner, FakeOpenAI())
        args = {"message": "Please review my invoice", "caller_name": "Jane"}
        result = await agent.run_tool("take_message", args)
        assert result["status"] == "REQUIRES_HUMAN" and not result["saved"]
        assert await mock_db.notifications.count_documents({}) == 0
        assert await mock_db.messages.count_documents({}) == 0
        repeated = await agent.run_tool("take_message", args)
        assert repeated["request_id"] == result["request_id"]
        service = ReceptionistActionService(mock_db)
        approved = await service.decide(owner, result["request_id"], approve=True)
        assert approved["status"] == "completed", approved
        assert await mock_db.messages.count_documents({}) == 1
        notifications = await mock_db.notifications.count_documents({})
        with pytest.raises(AppException) as error:
            await service.decide(owner, result["request_id"], approve=True)
        assert error.value.status_code == 409
        assert await mock_db.messages.count_documents({}) == 1
        assert await mock_db.notifications.count_documents({}) == notifications
    asyncio.run(run())


def test_approval_is_tenant_scoped_and_rechecks_disabled_permission(client, mock_db, monkeypatch):
    owner = _business(client, mock_db, monkeypatch, "approve-tenant@example.com",
                      ai_capabilities={"take_message": "human_approval_required"})
    _, other = _owner_with_org(client, mock_db, "approve-other@example.com")
    async def run():
        agent = _receptionist(mock_db, owner, FakeOpenAI())
        result = await agent.run_tool("take_message", {"message": "Confidential details"})
        service = ReceptionistActionService(mock_db)
        assert (await service.list_actions(other))["items"] == []
        with pytest.raises(AppException) as error:
            await service.decide(other, result["request_id"], approve=True)
        assert error.value.status_code == 404
        await mock_db.organizations.update_one({"organization_id": owner},
            {"$set": {"ai_call_settings.ai_capabilities.take_message": "disabled"}})
        reviewed = await service.decide(owner, result["request_id"], approve=True)
        assert reviewed["status"] == "failed"
        assert await mock_db.notifications.count_documents({}) == 0
        assert await mock_db.messages.count_documents({}) == 0
    asyncio.run(run())


def test_sms_disabled_blocks_notification_delivery(client, mock_db, monkeypatch):
    owner = _business(client, mock_db, monkeypatch, "approve-sms-disabled@example.com",
                      ai_capabilities={"send_sms": "disabled"})
    async def run():
        notifier = AppointmentNotifier(mock_db)
        sent = await notifier._sms_allowed(owner, owner, "+15551234567", "Jane", "Reminder")
        assert sent is False
        deliveries = []
        async def create_message(*args, **kwargs):
            deliveries.append((args, kwargs))
            return {"id": "unexpected"}
        monkeypatch.setattr(notifier, "create_message", create_message)
        assert await notifier.notify_outbound_followup(owner, phone="+15551234567", name="Jane", template="Thanks from {business}") is None
        assert deliveries == []
        assert await mock_db.messages.count_documents({}) == 0
        assert await mock_db.receptionist_actions.count_documents({}) == 0
        agent = _receptionist(mock_db, owner, FakeOpenAI())
        result = await agent.run_tool("send_sms", {"phone": "+15551234567", "message": "Hello"})
        assert result["status"] == "PERMISSION_DENIED"
        assert not agent.call_control.sms_sent
    asyncio.run(run())


def test_simulated_business_request_has_no_real_side_effects(client, mock_db, monkeypatch):
    owner = _business(client, mock_db, monkeypatch, "approve-simulation@example.com")
    async def run():
        agent = _receptionist(mock_db, owner, FakeOpenAI())
        agent.is_simulation = True
        result = await agent.run_tool("create_business_request", {"kind": "task", "summary": "Simulated request"})
        assert result.get("test_mode")
        assert await mock_db.receptionist_work_items.count_documents({}) == 0
        assert await mock_db.notifications.count_documents({}) == 0
    asyncio.run(run())


def test_approval_cannot_execute_in_creators_new_organization(client, mock_db, monkeypatch):
    owner = _business(client, mock_db, monkeypatch, "approve-moved-owner@example.com",
                      ai_capabilities={"create_task": "human_approval_required"})
    async def run():
        reviewer = ObjectId()
        await mock_db.users.insert_one({"_id": reviewer, "organization_id": owner, "email": "reviewer@example.com"})
        pending = await _receptionist(mock_db, owner, FakeOpenAI()).run_tool(
            "create_business_request", {"kind": "task", "summary": "Original business task"})
        await mock_db.users.update_one({"_id": ObjectId(owner)}, {"$set": {"organization_id": "another-business"}})
        result = await ReceptionistActionService(mock_db).decide(str(reviewer), pending["request_id"], approve=True)
        assert result["status"] == "failed"
        assert await mock_db.receptionist_work_items.count_documents({}) == 0
    asyncio.run(run())


def test_crm_disabled_does_not_prevent_message_persistence(client, mock_db, monkeypatch):
    owner = _business(client, mock_db, monkeypatch, "approve-no-crm@example.com",
                      ai_capabilities={"create_crm_contact": "disabled"})
    async def run():
        result = await _receptionist(mock_db, owner, FakeOpenAI()).run_tool(
            "take_message", {"message": "Please call me about the bill", "caller_name": "Jane"})
        assert result["saved"]
        assert await mock_db.contacts.count_documents({}) == 0
        assert await mock_db.messages.count_documents({}) == 1
        thread = await mock_db.conversations.find_one({"platform": "ai_receptionist"})
        assert thread["external_phone"] == "+15551230000" and thread["contact_id"] is None
    asyncio.run(run())


def test_business_request_respects_permission_and_routes_selected_employee(client, mock_db, monkeypatch):
    employee = str(ObjectId())
    owner = _business(client, mock_db, monkeypatch, "approve-task@example.com",
        ai_capabilities={"create_task": "human_approval_required", "provide_quote": "disabled"},
        call_routing_rules=[{"id": "dispatch", "name": "Dispatch", "target_user_ids": [employee]}])
    async def run():
        await mock_db.users.insert_one({"_id": ObjectId(employee), "organization_id": owner,
                                       "email": "dispatch@example.com", "name": "Dispatch employee"})
        agent = _receptionist(mock_db, owner, FakeOpenAI())
        blocked = await agent.run_tool("create_business_request", {"kind": "quote", "summary": "Roof quote"})
        assert blocked["status"] == "PERMISSION_DENIED"
        result = await agent.run_tool("create_business_request", {"kind": "task", "summary": "Call customer", "department": "Dispatch"})
        assert result["status"] == "REQUIRES_HUMAN"
        assert await mock_db.receptionist_work_items.count_documents({}) == 0
        approved = await ReceptionistActionService(mock_db).decide(owner, result["request_id"], approve=True)
        assert approved["status"] == "completed", approved
        item = await mock_db.receptionist_work_items.find_one({})
        assert item["assignee_ids"] == [employee]
        assert await mock_db.notifications.count_documents({"user_id": employee}) == 1
        assert await mock_db.notifications.count_documents({"user_id": owner}) == 0
    asyncio.run(run())


@pytest.mark.parametrize("state", ["disabled", "human_approval_required"])
def test_ai_outbound_call_does_not_dial_without_permission(client, mock_db, monkeypatch, state):
    owner = _business(client, mock_db, monkeypatch, f"approve-outbound-{state}@example.com",
                      ai_capabilities={"outbound_calls": state})
    async def run():
        service = CallHistoryService(mock_db)
        if state == "disabled":
            with pytest.raises(AppException) as error:
                await service.create_outbound_call(owner, {"phone_number": "+15551234567", "ai_ready": True})
            assert error.value.status_code == 403
        else:
            result = await service.create_outbound_call(owner, {"phone_number": "+15551234567", "ai_ready": True})
            assert result["approval_required"]
            row = await mock_db.receptionist_actions.find_one({})
            assert row["tool"] == "outbound_call" and row["status"] == "pending"
        assert await mock_db.call_logs.count_documents({}) == 0
    asyncio.run(run())


@pytest.mark.parametrize("tool,recipient", [("send_sms", "+15551234567"), ("send_email", "jane@example.com")])
def test_direct_communications_require_confirmation_and_simulation_has_no_delivery(client, mock_db, monkeypatch, tool, recipient):
    owner = _business(client, mock_db, monkeypatch, f"approve-confirm-{tool}@example.com")
    async def run():
        agent = _receptionist(mock_db, owner, FakeOpenAI())
        args = {"recipient": recipient, "message": "Requested information", "caller_confirmed": False}
        result = await agent.run_tool(tool, args)
        assert result["sent"] is False and result.get("error")
        assert await mock_db.messages.count_documents({}) == 0
        agent.is_simulation = True
        result = await agent.run_tool(tool, {**args, "caller_confirmed": True})
        assert result.get("test_mode")
        assert await mock_db.messages.count_documents({}) == 0
        assert not agent.call_control.sms_sent
    asyncio.run(run())


def test_live_sms_approval_uses_the_confirmed_recipient(client, mock_db, monkeypatch):
    owner = _business(client, mock_db, monkeypatch, "approve-live-sms@example.com",
                      ai_capabilities={"send_sms": "human_approval_required"})
    deliveries = []
    async def fake_send_sms(flow, user_id, args):
        deliveries.append(args)
        return {"sent": bool(args.get("phone"))}
    monkeypatch.setattr(ReceptionistActionService, "_send_sms", staticmethod(fake_send_sms))
    async def run():
        pending = await _receptionist(mock_db, owner, FakeOpenAI()).run_tool("send_sms", {
            "recipient": "+15551234567", "message": "Requested information", "caller_confirmed": True})
        assert not deliveries
        result = await ReceptionistActionService(mock_db).decide(owner, pending["request_id"], approve=True)
        assert result["status"] == "completed"
        assert deliveries[0]["phone"] == "+15551234567"
    asyncio.run(run())
