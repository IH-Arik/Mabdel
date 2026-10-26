import asyncio

from bson import ObjectId
import pytest

from app.core.exceptions import AppException
from app.services.receptionist_workflow_service import ReceptionistWorkflowService
from app.tests.test_ai_call_scheduling import _owner_with_org


def test_work_item_endpoints_are_tenant_scoped(client, mock_db):
    headers, owner_id = _owner_with_org(client, mock_db, "workqueue-owner@example.com")
    other_headers, other_id = _owner_with_org(client, mock_db, "workqueue-other@example.com")
    result = asyncio.run(ReceptionistWorkflowService(mock_db).create_request(
        owner_id, owner_id, kind="callback", summary="Call back about invoice"))
    response = client.get("/api/v1/smartflow/receptionist/work-items", headers=headers)
    assert response.status_code == 200
    assert response.json()["data"]["items"][0]["id"] == result["id"]
    response = client.get("/api/v1/smartflow/receptionist/work-items", headers=other_headers)
    assert response.status_code == 200 and response.json()["data"]["items"] == []
    response = client.patch(f"/api/v1/smartflow/receptionist/work-items/{result['id']}",
                            headers=other_headers, json={"status": "completed"})
    assert response.status_code == 404
    response = client.patch(f"/api/v1/smartflow/receptionist/work-items/{result['id']}",
                            headers=headers, json={"status": "completed"})
    assert response.status_code == 200
    response = client.patch(f"/api/v1/smartflow/receptionist/work-items/{result['id']}",
                            headers=headers, json={"status": "executed"})
    assert response.status_code == 422


def test_routing_filters_other_business_members_and_inactive_rules(mock_db):
    async def run():
        member, stranger = ObjectId(), ObjectId()
        await mock_db.users.insert_many([
            {"_id": member, "organization_id": "a", "name": "Billing person", "email": "billing@example.com"},
            {"_id": stranger, "organization_id": "b", "name": "Other person", "email": "other@example.com"},
        ])
        service = ReceptionistWorkflowService(mock_db)
        settings = {"call_routing_rules": [
            {"id": "billing", "name": "Billing", "notify_role": "billing",
             "target_user_ids": [str(member), str(stranger)], "transfer_number": "+15551234567"},
            {"id": "sales", "name": "Sales", "active": False, "target_user_ids": [str(member)]},
        ]}
        result = await service.resolve_route("a", settings, department="Billing")
        assert result["recipient_ids"] == [str(member)]
        assert result["transfer_number"] == "+15551234567"
        assert not (await service.resolve_route("a", settings, department="Sales"))["matched"]
        assert not (await service.resolve_route("a", settings, employee_id=str(stranger)))["recipient_ids"]
    asyncio.run(run())


def test_ambiguous_names_do_not_broadcast_or_assign_wrong_person(mock_db):
    async def run():
        await mock_db.users.insert_many([
            {"organization_id": "a", "name": "Sam", "email": "sam1@example.com"},
            {"organization_id": "a", "name": "Sam", "email": "sam2@example.com"},
        ])
        route = await ReceptionistWorkflowService(mock_db).resolve_route("a", {
            "call_routing_rules": [{"id": "billing", "name": "Billing", "notify_target": "Sam"}],
        }, playbook="billing")
        assert route["recipient_ids"] == []
    asyncio.run(run())


def test_requests_are_durable_assignable_and_tenant_scoped(mock_db):
    async def run():
        member = ObjectId()
        await mock_db.users.insert_one({"_id": member, "organization_id": "a"})
        service = ReceptionistWorkflowService(mock_db)
        result = await service.create_request("owner", "a", kind="quote", summary="Replace roof", caller_phone="+15551234567")
        assert result["saved"] and result["status"] == "open"
        assert "not yet been performed" in result["note"]
        assert len(await service.list_requests("a")) == 1
        assert await service.list_requests("b") == []
        with pytest.raises(AppException) as exc:
            await service.update_request("b", result["id"], status="completed")
        assert exc.value.status_code == 404
        await service.update_request("a", result["id"], status="in_progress", assignee_id=str(member))
        row = (await service.list_requests("a", "in_progress"))[0]
        assert row["assignee_ids"] == [str(member)]
        with pytest.raises(AppException):
            await service.create_request("owner", "a", kind="callback", summary="Call back", employee_id=str(ObjectId()))
    asyncio.run(run())


def test_request_notifications_go_to_selected_employee_without_broadcast(mock_db):
    async def run():
        owner, selected, other = ObjectId(), ObjectId(), ObjectId()
        await mock_db.users.insert_many([
            {"_id": owner, "organization_id": "a", "role": "owner", "email": "owner@example.com"},
            {"_id": selected, "organization_id": "a", "email": "selected@example.com"},
            {"_id": other, "organization_id": "a", "email": "other@example.com"},
        ])
        service = ReceptionistWorkflowService(mock_db)
        result = await service.create_request(str(owner), "a", kind="service_ticket", summary="Broken AC",
            department="Dispatch", settings={"call_routing_rules": [
                {"id": "dispatch", "name": "Dispatch", "target_user_ids": [str(selected)]},
            ]})
        assert result["notified_user_ids"] == [str(selected)]
        assert await mock_db.notifications.count_documents({"user_id": str(owner)}) == 0
        assert await mock_db.notifications.count_documents({"user_id": str(other)}) == 0
        await service.create_request(str(owner), "a", kind="task", summary="Unknown route", department="Unknown")
        assert await mock_db.notifications.count_documents({"user_id": str(owner)}) == 0
        await service.create_request(str(owner), "a", kind="task", summary="General task")
        assert await mock_db.notifications.count_documents({"user_id": str(owner)}) == 1
    asyncio.run(run())
