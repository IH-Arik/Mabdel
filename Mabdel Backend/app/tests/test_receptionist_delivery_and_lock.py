import asyncio
from bson import ObjectId

from app.api.v1.endpoints import calls as call_routes
from app.services.smartflow.appointment_service import AppointmentService
from app.services.smartflow.receptionist_action_service import ReceptionistActionService
from app.tests.test_realtime_receptionist import _business
from app.tests.test_location_scheduling import _clock, _location
from app.tests.test_provider_aware_booking import _setup, _provider


def test_simultaneous_bookings_cannot_take_the_same_location(client, mock_db, monkeypatch):
    from app.services.smartflow.calendar_service import CalendarService
    owner = _setup(client, mock_db, "booking-race@example.com")
    _clock(monkeypatch)
    _location(mock_db, owner)
    _provider(mock_db, owner, "Dr. A")
    _provider(mock_db, owner, "Dr. B")
    original_check = CalendarService._assert_calendar_slot_available
    async def delayed_check(self, *args, **kwargs):
        await original_check(self, *args, **kwargs)
        # Simulate network/database latency precisely between validation and write.
        # Without the shared lock, both providers see the last place as available.
        await asyncio.sleep(0.02)
    monkeypatch.setattr(CalendarService, "_assert_calendar_slot_available", delayed_check)

    async def run():
        async def book(provider):
            return await AppointmentService(mock_db).book(owner, name="Jane", phone="+15551234567", email=None,
                day="2026-09-21", time="10:00", provider_name=provider, location_name="Main")
        outcomes = await asyncio.gather(book("Dr. A"), book("Dr. B"))
        assert sorted(item["outcome"] for item in outcomes) == ["booked", "unavailable"]
        assert await mock_db.calendar_events.count_documents({}) == 1
        assert await mock_db.booking_leases.count_documents({}) == 0
    asyncio.run(run())


def test_approval_cannot_follow_requester_to_another_business(client, mock_db, monkeypatch):
    owner = _business(client, mock_db, monkeypatch, "approval-org-move@example.com")
    async def run():
        service = ReceptionistActionService(mock_db)
        row = await service.request(owner, tool="take_message", arguments={"message": "Call back"}, capabilities=["take_message"])
        reviewer = str((await mock_db.users.insert_one({"organization_id": owner})).inserted_id)
        await mock_db.users.update_one({"_id": ObjectId(owner)}, {"$set": {"organization_id": "different-business"}})
        result = await service.decide(reviewer, row["id"], approve=True)
        assert result["status"] == "failed"
        assert await mock_db.messages.count_documents({}) == 0
    asyncio.run(run())


def test_inbound_ai_answer_requires_approval_and_replays_once(client, mock_db, monkeypatch):
    from app.services.smartflow_service import SmartFlowService
    from app.services.call_service import CallService
    owner = _business(client, mock_db, monkeypatch, "inbound-approval@example.com",
                      ai_capabilities={"answer_calls": "human_approval_required"})
    answered = []
    async def answer(self, call_id, **kwargs):
        answered.append(call_id)
    monkeypatch.setattr(CallService, "answer_call", answer)
    async def run():
        await mock_db.call_logs.insert_one({"twilio_call_sid": "incoming-1", "user_id": owner, "from_number": "+15551234567", "status": "ringing"})
        await call_routes._answer_with_ai_permission("incoming-1", SmartFlowService(mock_db))
        assert answered == []
        row = await mock_db.receptionist_actions.find_one({})
        assert row["status"] == "pending"
        result = await ReceptionistActionService(mock_db).decide(owner, str(row["_id"]), approve=True)
        assert result["status"] == "completed" and answered == ["incoming-1"]
    asyncio.run(run())


def test_attendance_confirmation_checks_the_callers_booking_and_consent(client, mock_db, monkeypatch):
    from datetime import timedelta
    from app.utils.helpers import utc_now
    from app.tests.test_realtime_receptionist import FakeOpenAI, _receptionist
    owner = _business(client, mock_db, monkeypatch, "attendance-confirm@example.com")
    async def run():
        event_id = (await mock_db.calendar_events.insert_one({"user_id": owner, "starts_at": utc_now() + timedelta(days=1),
            "customer": {"name": "Jane Doe", "phone": "+15551230000"}})).inserted_id
        agent = _receptionist(mock_db, owner, FakeOpenAI())
        args = {"appointment_id": str(event_id), "caller_name": "Jane Doe", "caller_confirmed": False}
        assert not (await agent.run_tool("confirm_appointment", args))["confirmed"]
        denied = await agent.run_tool("confirm_appointment", {**args, "caller_confirmed": True, "caller_name": "Wrong Person"})
        assert denied.get("error")
        assert (await agent.run_tool("confirm_appointment", {**args, "caller_confirmed": True}))["confirmed"]
        event = await mock_db.calendar_events.find_one({"_id": event_id})
        assert event["customer"]["confirmed_via"] == "ai_call"
    asyncio.run(run())


def test_contact_creation_permission_does_not_prevent_an_allowed_sms(client, mock_db, monkeypatch):
    from app.services.call_service import CallService
    from app.services.smartflow_service import SmartFlowService
    owner = _business(client, mock_db, monkeypatch, "sms-without-crm@example.com",
                      ai_capabilities={"create_crm_contact": "disabled"})
    deliveries = []
    async def send(self, **kwargs):
        deliveries.append(kwargs)
        return {"id": "provider-sms-1"}
    monkeypatch.setattr(CallService, "send_sms", send)
    async def run():
        result = await ReceptionistActionService._send_sms(SmartFlowService(mock_db), owner,
            {"phone": "+15551234567", "message": "Your requested information"})
        assert result["sent"]
        assert deliveries[0]["to_number"] == "+15551234567"
        assert await mock_db.contacts.count_documents({}) == 0
    asyncio.run(run())


def test_a_reviewed_outbound_request_does_not_block_future_requests(client, mock_db, monkeypatch):
    owner = _business(client, mock_db, monkeypatch, "repeat-outbound@example.com")
    async def run():
        service = ReceptionistActionService(mock_db)
        args = dict(tool="outbound_call", arguments={"phone_number": "+15551234567"}, capabilities=["outbound_calls"])
        first = await service.request(owner, **args)
        await service.decide(owner, first["id"], approve=False)
        second = await service.request(owner, **args)
        assert second["id"] != first["id"] and second["status"] == "pending"
    asyncio.run(run())


def test_unattributed_live_call_cannot_send_using_the_platform_email_account(mock_db):
    from app.tests.test_realtime_receptionist import FakeOpenAI, _receptionist
    async def run():
        agent = _receptionist(mock_db, "guest", FakeOpenAI())
        result = await agent.run_tool("send_email", {"recipient": "unknown@example.com", "message": "Test", "caller_confirmed": True})
        assert result["status"] == "PERMISSION_DENIED" and result["sent"] is False
        assert await mock_db.messages.count_documents({}) == 0
    asyncio.run(run())


def test_authorization_outage_fails_closed_without_losing_the_tool_response(client, mock_db, monkeypatch):
    from app.tests.test_realtime_receptionist import FakeOpenAI, _receptionist
    owner = _business(client, mock_db, monkeypatch, "auth-outage@example.com")
    async def unavailable(*args):
        raise RuntimeError("Database offline")
    async def run():
        agent = _receptionist(mock_db, owner, FakeOpenAI())
        monkeypatch.setattr(agent, "_capability", unavailable)
        result = await agent.run_tool("take_message", {"message": "Call me back"})
        assert result["status"] == "INTEGRATION_OFFLINE" and result["saved"] is False
        assert await mock_db.messages.count_documents({}) == 0
    asyncio.run(run())


def test_transfer_approval_works_on_another_worker_but_rejects_ended_calls(client, mock_db, monkeypatch):
    from app.services.call_service import CallService
    owner = _business(client, mock_db, monkeypatch, "transfer-other-worker@example.com",
                      transfer_number="+15559990000", ai_capabilities={"transfer_to_human": "human_approval_required"})
    transfers = []
    async def transfer(self, call_id, **kwargs):
        transfers.append(call_id)
        return True
    monkeypatch.setattr(CallService, "transfer_call", transfer)
    async def run():
        service = ReceptionistActionService(mock_db)
        for status in ("in_progress", "completed"):
            call_id = f"cross-worker-{status}"
            await mock_db.call_logs.insert_one({"twilio_call_sid": call_id, "user_id": owner, "status": status})
            pending = await service.request(owner, tool="transfer_to_human", arguments={}, capabilities=["transfer_to_human"], call_id=call_id)
            result = await service.decide(owner, pending["id"], approve=True)
            assert result["status"] == ("completed" if status == "in_progress" else "failed")
        assert transfers == ["cross-worker-in_progress"]
    asyncio.run(run())
