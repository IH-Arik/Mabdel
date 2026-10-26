import asyncio

import pytest

from app.core.exceptions import AppException
from app.services.receptionist_execution_service import ReceptionistExecutionService
from app.services.receptionist_workflow_service import ReceptionistWorkflowService
from app.tests.test_ai_call_scheduling import _owner_with_org

BASE = "/api/v1/smartflow/receptionist"


def request(mock_db, owner, kind):
    return asyncio.run(
        ReceptionistWorkflowService(mock_db).create_request(
            owner,
            owner,
            kind=kind,
            summary="Customer requested annual maintenance",
            caller_phone="+15551234567",
            caller_name="Jane",
        )
    )["id"]


@pytest.mark.parametrize(
    "kind,collection",
    [
        ("task", "business_tasks"),
        ("callback", "business_tasks"),
        ("service_ticket", "business_service_tickets"),
        ("quote", "business_quotes"),
    ],
)
def test_review_creates_real_business_record_once(client, mock_db, kind, collection):
    headers, owner = _owner_with_org(client, mock_db, f"execute-{kind}@example.com")
    item_id = request(mock_db, owner, kind)
    payload = (
        {"approved": True, "quote_amount": "120.50", "currency": "USD"}
        if kind == "quote"
        else {"approved": True}
    )
    response = client.post(
        f"{BASE}/work-items/{item_id}/execute", headers=headers, json=payload
    )
    assert response.status_code == 200, response.text
    result = response.json()["data"]
    assert result["artifact_kind"] == kind
    retry = client.post(
        f"{BASE}/work-items/{item_id}/execute", headers=headers, json=payload
    )
    assert retry.status_code == 200 and retry.json()["data"] == result
    assert (
        asyncio.run(mock_db[collection].count_documents({"organization_id": owner}))
        == 1
    )
    records = client.get(f"{BASE}/business-records", headers=headers).json()["data"][
        "items"
    ]
    record = records[0]
    assert record["reviewed_by"] == owner and record["source_work_item_id"] == item_id
    if kind == "quote":
        assert record["amount"] == "120.50" and record["status"] == "draft"
    else:
        assert record["status"] == "open"
    assert asyncio.run(mock_db.call_logs.count_documents({})) == 0
    assert asyncio.run(mock_db.messages.count_documents({})) == 0
    status = "accepted" if kind == "quote" else "completed"
    update = client.patch(
        f"{BASE}/business-records/{kind}/{result['artifact_id']}",
        headers=headers,
        json={"status": status},
    )
    assert update.status_code == 200 and update.json()["data"]["status"] == status


def test_execution_requires_review_price_and_same_business(client, mock_db):
    headers, owner = _owner_with_org(client, mock_db, "execute-validation@example.com")
    other_headers, _ = _owner_with_org(client, mock_db, "execute-stranger@example.com")
    item_id = request(mock_db, owner, "quote")
    assert (
        client.post(
            f"{BASE}/work-items/{item_id}/execute",
            headers=other_headers,
            json={"approved": True},
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"{BASE}/work-items/{item_id}/execute",
            headers=headers,
            json={"approved": False},
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"{BASE}/work-items/{item_id}/execute",
            headers=headers,
            json={"approved": True},
        ).status_code
        == 422
    )
    for amount in ["NaN", "Infinity", "-1", "12.345"]:
        result = client.post(
            f"{BASE}/work-items/{item_id}/execute",
            headers=headers,
            json={"approved": True, "quote_amount": amount, "currency": "USD"},
        )
        assert result.status_code == 422, result.text
    result = client.post(
        f"{BASE}/work-items/{item_id}/execute",
        headers=headers,
        json={
            "approved": True,
            "quote_amount": "10",
            "currency": "USD",
            "url": "https://arbitrary.example",
        },
    )
    assert result.status_code == 422
    assert asyncio.run(mock_db.business_quotes.count_documents({})) == 0
    assert (
        client.get(f"{BASE}/business-records", headers=other_headers).json()["data"][
            "items"
        ]
        == []
    )


def test_owner_disabled_capability_blocks_review_execution(client, mock_db):
    headers, owner = _owner_with_org(client, mock_db, "execute-disabled@example.com")
    item_id = request(mock_db, owner, "task")
    asyncio.run(
        mock_db.organizations.insert_one(
            {
                "organization_id": owner,
                "ai_call_settings": {"ai_capabilities": {"create_task": "disabled"}},
            }
        )
    )
    result = client.post(
        f"{BASE}/work-items/{item_id}/execute", headers=headers, json={"approved": True}
    )
    assert result.status_code == 403
    assert asyncio.run(mock_db.business_tasks.count_documents({})) == 0


def test_workflow_uses_existing_contact_service_and_checks_subordinate_permission(
    client, mock_db
):
    headers, owner = _owner_with_org(client, mock_db, "execute-workflow@example.com")
    item_id = request(mock_db, owner, "workflow")
    asyncio.run(
        mock_db.organizations.insert_one(
            {
                "organization_id": owner,
                "ai_call_settings": {
                    "ai_capabilities": {
                        "trigger_workflow": "human_approval_required",
                        "create_crm_contact": "disabled",
                    }
                },
            }
        )
    )
    payload = {
        "approved": True,
        "workflow_action": "create_crm_contact",
        "contact_email": "jane@example.com",
    }
    response = client.post(
        f"{BASE}/work-items/{item_id}/execute", headers=headers, json=payload
    )
    assert response.status_code == 403
    assert asyncio.run(mock_db.contacts.count_documents({})) == 0
    asyncio.run(
        mock_db.organizations.update_one(
            {"organization_id": owner},
            {
                "$set": {
                    "ai_call_settings.ai_capabilities.create_crm_contact": "human_approval_required"
                }
            },
        )
    )
    response = client.post(
        f"{BASE}/work-items/{item_id}/execute", headers=headers, json=payload
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["artifact_kind"] == "contact"
    assert (
        asyncio.run(
            mock_db.contacts.count_documents(
                {"user_id": owner, "email": "jane@example.com"}
            )
        )
        == 1
    )
    retry = client.post(
        f"{BASE}/work-items/{item_id}/execute", headers=headers, json=payload
    )
    assert (
        retry.status_code == 200
        and asyncio.run(mock_db.contacts.count_documents({})) == 1
    )


def test_retry_recovers_after_record_saved_but_request_update_failed(
    client, mock_db, monkeypatch
):
    _, owner = _owner_with_org(client, mock_db, "execute-recovery@example.com")
    item_id = request(mock_db, owner, "task")
    collection = mock_db.receptionist_work_items
    original = collection.update_one
    calls = []

    async def fail_once(*args, **kwargs):
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("Transient database outage after artifact write")
        return await original(*args, **kwargs)

    monkeypatch.setattr(collection, "update_one", fail_once)

    class DatabaseProxy:
        def __getattr__(self, name):
            return (
                collection
                if name == "receptionist_work_items"
                else getattr(mock_db, name)
            )

        def __getitem__(self, name):
            return mock_db[name]

    async def run():
        service = ReceptionistExecutionService(mock_db)
        service.db = DatabaseProxy()
        with pytest.raises(RuntimeError):
            await service.execute(owner, item_id, {"approved": True})
        assert await mock_db.business_tasks.count_documents({}) == 1
        with pytest.raises(AppException) as changed:
            await service.execute(
                owner, item_id, {"approved": True, "title": "Changed reviewed details"}
            )
        assert changed.value.status_code == 409
        result = await service.execute(owner, item_id, {"approved": True})
        assert result["saved"] and await mock_db.business_tasks.count_documents({}) == 1

    asyncio.run(run())


@pytest.mark.parametrize(
    "action,collection",
    [
        ("create_task", "business_tasks"),
        ("create_service_ticket", "business_service_tickets"),
    ],
)
def test_supported_workflows_create_domain_records(client, mock_db, action, collection):
    headers, owner = _owner_with_org(
        client, mock_db, f"execute-workflow-{action}@example.com"
    )
    item_id = request(mock_db, owner, "workflow")
    result = client.post(
        f"{BASE}/work-items/{item_id}/execute",
        headers=headers,
        json={"approved": True, "workflow_action": action},
    )
    assert result.status_code == 200, result.text
    assert (
        asyncio.run(mock_db[collection].count_documents({"organization_id": owner}))
        == 1
    )
    records = client.get(f"{BASE}/business-records", headers=headers).json()["data"][
        "items"
    ]
    assert records[0]["source_work_item_id"] == item_id
