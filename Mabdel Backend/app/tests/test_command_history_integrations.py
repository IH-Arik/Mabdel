from __future__ import annotations

import asyncio


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(
        db.otp_codes.find_one(
            {"email": email, "purpose": purpose},
            sort=[("created_at", -1)],
        )
    )
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "history-integrations@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "History Integration User", "email": email, "password": "SecurePass2024!"},
    )
    assert register_response.status_code == 201

    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify_response = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "code": otp["code"], "purpose": "signup"},
    )
    assert verify_response.status_code == 200

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePass2024!"},
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


def _create_contact(client, headers: dict[str, str], *, name: str, email: str) -> str:
    response = client.post(
        "/api/v1/smartflow/contacts",
        headers=headers,
        json={"name": name, "email": email, "phone": "+8801700000000"},
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def test_invoice_bulk_and_document_actions_are_logged_to_command_history(client, mock_db):
    headers = _auth_headers(client, mock_db)
    contact_id = _create_contact(client, headers, name="Alex Johnson", email="alex@example.com")

    invoice_response = client.post(
        "/api/v1/invoices",
        headers=headers,
        json={
            "client_name": "Acme Corporation",
            "client_email": "billing@acme.example",
            "issue_date": "2099-04-30",
            "due_date": "2099-05-15",
            "currency": "USD",
            "items": [{"description": "Setup", "quantity": 1, "unit_price": 500}],
        },
    )
    assert invoice_response.status_code == 201
    invoice_id = invoice_response.json()["data"]["id"]

    bulk_response = client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={
            "channel": "email",
            "contact_ids": [contact_id],
            "subject": "Project update",
            "content": "Please review the latest project update.",
            "send_now": True,
        },
    )
    assert bulk_response.status_code == 201
    bulk_id = bulk_response.json()["data"]["id"]

    document_response = client.post(
        "/api/v1/smartflow/documents",
        headers=headers,
        json={
            "name": "Master Service Agreement",
            "type": "agreement",
            "file_url": "https://files.example.com/msa.pdf",
        },
    )
    assert document_response.status_code == 201
    document_id = document_response.json()["data"]["id"]

    history_response = client.get("/api/v1/smartflow/ai/history?group_by=day", headers=headers)
    assert history_response.status_code == 200
    items = history_response.json()["data"]["items"]
    command_types = {item["command_type"] for item in items}
    assert "invoice" in command_types
    assert "bulk_message" in command_types
    assert "agreement" in command_types

    invoice_item = next(item for item in items if item["related_resource"] and item["related_resource"]["type"] == "invoice")
    assert invoice_item["related_resource"]["id"] == invoice_id

    bulk_item = next(item for item in items if item["related_resource"] and item["related_resource"]["type"] == "bulk_message")
    assert bulk_item["related_resource"]["id"] == bulk_id

    document_item = next(item for item in items if item["related_resource"] and item["related_resource"]["type"] == "document")
    assert document_item["related_resource"]["id"] == document_id

    replay_invoice = client.post(f"/api/v1/smartflow/ai/history/{invoice_item['id']}/replay", headers=headers)
    assert replay_invoice.status_code == 200
    assert replay_invoice.json()["data"]["result_type"] == "invoice"

    replay_bulk = client.post(f"/api/v1/smartflow/ai/history/{bulk_item['id']}/replay", headers=headers)
    assert replay_bulk.status_code == 200
    assert replay_bulk.json()["data"]["result_type"] == "bulk_message"

    replay_document = client.post(f"/api/v1/smartflow/ai/history/{document_item['id']}/replay", headers=headers)
    assert replay_document.status_code == 200
    assert replay_document.json()["data"]["result_type"] == "document"
