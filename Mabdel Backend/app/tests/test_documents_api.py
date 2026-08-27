from __future__ import annotations

import asyncio

from app.tests.conftest import grant_owner_role


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "documents@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Document Owner", "email": email, "password": "SecurePass2024!"},
    )
    assert register_response.status_code == 201

    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify_response = client.post("/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"})
    assert verify_response.status_code == 200

    grant_owner_role(mock_db, email)

    login_response = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login_response.status_code == 200
    return {"Authorization": f"Bearer {login_response.json()['data']['access_token']}"}


def test_document_create_rename_and_delete_flow(client, mock_db) -> None:
    headers = _auth_headers(client, mock_db)

    create_response = client.post(
        "/api/v1/smartflow/documents",
        headers=headers,
        json={"name": "Signed W-9 Form", "type": "others", "file_url": "https://files.example.com/w9.pdf"},
    )
    assert create_response.status_code == 201
    document = create_response.json()["data"]
    document_id = document["id"]
    assert document["name"] == "Signed W-9 Form"

    list_response = client.get("/api/v1/smartflow/documents", headers=headers)
    assert list_response.status_code == 200
    items = list_response.json()["data"]["items"] if isinstance(list_response.json()["data"], dict) else list_response.json()["data"]
    assert any(item["id"] == document_id for item in items)

    rename_response = client.patch(
        f"/api/v1/smartflow/documents/{document_id}",
        headers=headers,
        json={"name": "Signed W-9 Form (2024)"},
    )
    assert rename_response.status_code == 200
    assert rename_response.json()["data"]["name"] == "Signed W-9 Form (2024)"

    delete_response = client.delete(f"/api/v1/smartflow/documents/{document_id}", headers=headers)
    assert delete_response.status_code == 200

    list_after_delete = client.get("/api/v1/smartflow/documents", headers=headers)
    remaining = list_after_delete.json()["data"]["items"] if isinstance(list_after_delete.json()["data"], dict) else list_after_delete.json()["data"]
    assert all(item["id"] != document_id for item in remaining)
