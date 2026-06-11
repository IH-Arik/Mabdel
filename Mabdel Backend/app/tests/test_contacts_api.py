from __future__ import annotations

import asyncio

from app.core.config import settings


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "contacts@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Contact Owner", "email": email, "password": "SecurePass2024!"},
    )
    assert register_response.status_code == 201

    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify_response = client.post("/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"})
    assert verify_response.status_code == 200

    login_response = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login_response.status_code == 200
    return {"Authorization": f"Bearer {login_response.json()['data']['access_token']}"}


def test_contact_list_create_detail_update_avatar_and_delete_flow(client, mock_db, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(settings, "MEDIA_ROOT", str(tmp_path))
    monkeypatch.setattr(settings, "PUBLIC_BACKEND_URL", "http://127.0.0.1:8000")
    headers = _auth_headers(client, mock_db)

    create_response = client.post(
        "/api/v1/smartflow/contacts",
        headers=headers,
        json={
            "first_name": "Alex",
            "last_name": "Thompson",
            "phone": "+1 (415) 555-0123",
            "email": "alex.t@mabdel.ai",
            "address": "25 Market Street, San Francisco, CA",
            "date_of_birth": "1999-04-12",
            "notes": "Key decision maker for the Q4 enterprise expansion.",
            "presence": "online",
        },
    )
    assert create_response.status_code == 201
    contact = create_response.json()["data"]
    contact_id = contact["id"]
    assert contact["name"] == "Alex Thompson"
    assert contact["first_name"] == "Alex"
    assert contact["last_name"] == "Thompson"
    assert contact["primary_detail"] == "alex.t@mabdel.ai"
    assert contact["initials"] == "AT"
    assert contact["is_online"] is True

    list_response = client.get("/api/v1/smartflow/contacts?search=Alex&page_size=10", headers=headers)
    assert list_response.status_code == 200
    list_payload = list_response.json()["data"]
    assert list_payload["items"][0]["id"] == contact_id
    assert list_payload["summary"]["total_contacts"] == 1
    assert list_payload["summary"]["online_contacts"] == 1

    detail_response = client.get(f"/api/v1/smartflow/contacts/{contact_id}", headers=headers)
    assert detail_response.status_code == 200
    detail = detail_response.json()["data"]
    assert detail["address"] == "25 Market Street, San Francisco, CA"
    assert detail["date_of_birth"] == "1999-04-12"
    assert "Q4 enterprise" in detail["notes"]

    update_response = client.patch(
        f"/api/v1/smartflow/contacts/{contact_id}",
        headers=headers,
        json={"last_name": "Graham", "notes": "Prefers communication via email before 10 AM."},
    )
    assert update_response.status_code == 200
    updated = update_response.json()["data"]
    assert updated["name"] == "Alex Graham"
    assert updated["initials"] == "AG"
    assert updated["notes"] == "Prefers communication via email before 10 AM."

    avatar_response = client.post(
        f"/api/v1/smartflow/contacts/{contact_id}/avatar",
        headers=headers,
        files={"avatar_file": ("avatar.png", b"not-a-real-png-but-stored", "image/png")},
    )
    assert avatar_response.status_code == 200
    avatar_payload = avatar_response.json()["data"]
    assert avatar_payload["avatar_url"].startswith("http://127.0.0.1:8000/media/contact_avatars/")

    delete_response = client.delete(f"/api/v1/smartflow/contacts/{contact_id}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted"] is True

    missing_response = client.get(f"/api/v1/smartflow/contacts/{contact_id}", headers=headers)
    assert missing_response.status_code == 404


def test_contact_create_still_accepts_legacy_name_payload(client, mock_db) -> None:
    headers = _auth_headers(client, mock_db, email="contacts-legacy@example.com")

    response = client.post(
        "/api/v1/smartflow/contacts",
        headers=headers,
        json={"name": "Sarah Jenkins", "email": "sarah@example.com"},
    )
    assert response.status_code == 201
    contact = response.json()["data"]
    assert contact["first_name"] == "Sarah"
    assert contact["last_name"] == "Jenkins"
    assert contact["primary_detail"] == "sarah@example.com"
