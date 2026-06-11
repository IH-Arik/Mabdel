from __future__ import annotations

import asyncio
from datetime import timedelta

from app.utils.helpers import utc_now


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(
        db.otp_codes.find_one(
            {"email": email, "purpose": purpose},
            sort=[("created_at", -1)],
        )
    )
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "bulk@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Bulk User", "email": email, "password": "SecurePass2024!"},
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


def _create_contact(client, headers: dict[str, str], *, name: str, email: str, phone: str = "+8801700000000") -> str:
    response = client.post(
        "/api/v1/smartflow/contacts",
        headers=headers,
        json={"name": name, "email": email, "phone": phone},
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def test_bulk_recipient_validation_flow(client, mock_db):
    headers = _auth_headers(client, mock_db)
    alex_id = _create_contact(client, headers, name="Alex Johnson", email="alex@example.com")
    sarah_id = _create_contact(client, headers, name="Sarah Miller", email="sarah@example.com")

    group_response = client.post(
        "/api/v1/smartflow/groups",
        headers=headers,
        json={"name": "Leadership", "member_ids": [alex_id, sarah_id]},
    )
    assert group_response.status_code == 201
    group_id = group_response.json()["data"]["id"]

    response = client.post(
        "/api/v1/smartflow/bulk-messages/recipients/validate",
        headers=headers,
        json={
            "channel": "email",
            "recipient_emails": ["team@company.com", "wrong-email@", "team@company.com"],
            "contact_ids": [alex_id],
            "group_ids": [group_id],
        },
    )
    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["valid_count"] == 3
    assert payload["invalid_count"] == 1
    assert payload["duplicate_count"] >= 1
    assert "wrong-email@" in payload["invalid_entries"]


def test_bulk_message_create_schedule_send_and_list_flow(client, mock_db):
    headers = _auth_headers(client, mock_db, email="bulk-send@example.com")
    alex_id = _create_contact(client, headers, name="Alex Johnson", email="alex@example.com")
    sarah_id = _create_contact(client, headers, name="Sarah Miller", email="sarah@example.com")

    create_response = client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={
            "channel": "email",
            "recipient_emails": ["team@company.com"],
            "contact_ids": [alex_id, sarah_id],
            "subject": "Quarterly update",
            "content": "Hello team, here is the quarterly update.",
            "attachments": [{"label": "Deck", "url": "https://files.example.com/deck.pdf"}],
            "send_now": True,
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()["data"]
    assert created["status"] == "sent"
    assert created["sent_count"] == 3
    assert created["failed_count"] == 0
    assert created["deliveries"][0]["status"] == "sent"

    detail_response = client.get(f"/api/v1/smartflow/bulk-messages/{created['id']}", headers=headers)
    assert detail_response.status_code == 200
    assert detail_response.json()["data"]["attachments"][0]["label"] == "Deck"

    list_response = client.get("/api/v1/smartflow/bulk-messages?status=sent", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json()["data"]["items"][0]["id"] == created["id"]


def test_bulk_message_draft_update_schedule_and_cancel_flow(client, mock_db):
    headers = _auth_headers(client, mock_db, email="bulk-draft@example.com")
    alex_id = _create_contact(client, headers, name="Alex Johnson", email="alex@example.com")
    schedule_time = (utc_now() + timedelta(days=1)).isoformat()

    create_response = client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={
            "channel": "email",
            "contact_ids": [alex_id],
            "subject": "Draft update",
            "content": "Initial draft content",
            "send_now": False,
        },
    )
    assert create_response.status_code == 201
    bulk_id = create_response.json()["data"]["id"]
    assert create_response.json()["data"]["status"] == "draft"

    update_response = client.patch(
        f"/api/v1/smartflow/bulk-messages/{bulk_id}",
        headers=headers,
        json={
            "content": "Updated content for later delivery",
            "scheduled_at": schedule_time,
            "timezone": "Asia/Dhaka",
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()["data"]
    assert updated["status"] == "scheduled"
    assert updated["timezone"] == "Asia/Dhaka"

    cancel_response = client.post(f"/api/v1/smartflow/bulk-messages/{bulk_id}/cancel", headers=headers)
    assert cancel_response.status_code == 200
    assert cancel_response.json()["data"]["status"] == "cancelled"


def test_bulk_sms_send_uses_phone_recipients(client, mock_db):
    headers = _auth_headers(client, mock_db, email="bulk-sms@example.com")
    alex_id = _create_contact(client, headers, name="Alex Johnson", email="alex@example.com", phone="+8801711111111")

    response = client.post(
        "/api/v1/smartflow/bulk-messages",
        headers=headers,
        json={
            "channel": "sms",
            "contact_ids": [alex_id],
            "content": "SMS update for client sync.",
            "send_now": True,
        },
    )
    assert response.status_code == 201
    payload = response.json()["data"]
    assert payload["status"] == "sent"
    assert payload["segment_count"] == 1
    assert payload["deliveries"][0]["target"] == "+8801711111111"
