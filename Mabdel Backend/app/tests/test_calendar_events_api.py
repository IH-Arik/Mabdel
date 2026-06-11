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


def _auth_headers(client, mock_db, email: str = "calendar@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Calendar User", "email": email, "password": "SecurePass2024!"},
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


def test_calendar_event_create_detail_and_share_flow(client, mock_db):
    headers = _auth_headers(client, mock_db)
    attendee_one = _create_contact(client, headers, name="Alex Johnson", email="alex@example.com")
    attendee_two = _create_contact(client, headers, name="Sarah Miller", email="sarah@example.com")

    create_response = client.post(
        "/api/v1/smartflow/calendar/events",
        headers=headers,
        json={
            "title": "Product Strategy Meeting",
            "description": "Discussion on Q4 roadmap and AI integration.",
            "starts_at": "2099-10-24T10:00:00",
            "ends_at": "2099-10-24T11:30:00",
            "contact_ids": [attendee_one, attendee_two],
            "meeting_mode": "online",
            "location": "Meeting Room A - Level 4",
            "notify_via_push": True,
            "notify_via_email": True,
            "timezone": "Asia/Dhaka",
            "reminder_minutes": 10,
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()["data"]
    assert created["attendee_count"] == 2
    assert created["meeting_link"].startswith("http://127.0.0.1:8000/meet/")
    assert created["attendees"][0]["initials"] in {"AJ", "SM"}

    detail_response = client.get(f"/api/v1/smartflow/calendar/events/{created['id']}", headers=headers)
    assert detail_response.status_code == 200
    detail = detail_response.json()["data"]
    assert detail["title"] == "Product Strategy Meeting"
    assert detail["meeting_mode"] == "online"
    assert detail["location"] == "Meeting Room A - Level 4"
    assert detail["notify_via_email"] is True

    share_response = client.post(
        f"/api/v1/smartflow/calendar/events/{created['id']}/share",
        headers=headers,
        json={"channel": "link"},
    )
    assert share_response.status_code == 200
    share_payload = share_response.json()["data"]
    assert "/calendar/share/" in share_payload["share_url"]


def test_calendar_event_conflict_and_range_filters(client, mock_db):
    headers = _auth_headers(client, mock_db, email="calendar-filters@example.com")

    first_response = client.post(
        "/api/v1/smartflow/calendar/events",
        headers=headers,
        json={
            "title": "Morning Sync",
            "starts_at": "2099-10-22T10:00:00",
            "ends_at": "2099-10-22T11:00:00",
            "contact_ids": [],
            "meeting_mode": "offline",
            "reminder_minutes": 5,
        },
    )
    assert first_response.status_code == 201

    conflict_response = client.post(
        "/api/v1/smartflow/calendar/events",
        headers=headers,
        json={
            "title": "Overlapping Sync",
            "starts_at": "2099-10-22T10:30:00",
            "ends_at": "2099-10-22T11:15:00",
            "contact_ids": [],
            "meeting_mode": "offline",
            "reminder_minutes": 15,
        },
    )
    assert conflict_response.status_code == 409
    assert conflict_response.json()["error"]["code"] == "CALENDAR_CONFLICT"

    second_response = client.post(
        "/api/v1/smartflow/calendar/events",
        headers=headers,
        json={
            "title": "Client Sync: Mabdel",
            "starts_at": "2099-10-22T13:00:00",
            "ends_at": "2099-10-22T14:00:00",
            "contact_ids": [],
            "meeting_mode": "online",
            "reminder_minutes": 15,
        },
    )
    assert second_response.status_code == 201

    range_response = client.get(
        "/api/v1/smartflow/calendar/events?date_from=2099-10-22&date_to=2099-10-22",
        headers=headers,
    )
    assert range_response.status_code == 200
    titles = [item["title"] for item in range_response.json()["data"]["items"]]
    assert titles == ["Morning Sync", "Client Sync: Mabdel"]


def test_calendar_event_update_and_delete_flow(client, mock_db):
    headers = _auth_headers(client, mock_db, email="calendar-update@example.com")
    create_response = client.post(
        "/api/v1/smartflow/calendar/events",
        headers=headers,
        json={
            "title": "Initial Meeting",
            "starts_at": "2099-11-01T09:00:00",
            "ends_at": "2099-11-01T10:00:00",
            "contact_ids": [],
            "meeting_mode": "offline",
            "location": "HQ Room 4",
            "reminder_minutes": 30,
        },
    )
    assert create_response.status_code == 201
    event_id = create_response.json()["data"]["id"]

    update_response = client.patch(
        f"/api/v1/smartflow/calendar/events/{event_id}",
        headers=headers,
        json={
            "title": "Updated Meeting",
            "meeting_mode": "online",
            "meeting_link": "https://meet.example.com/updated-room",
            "notify_via_email": True,
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()["data"]
    assert updated["title"] == "Updated Meeting"
    assert updated["meeting_mode"] == "online"
    assert updated["meeting_link"] == "https://meet.example.com/updated-room"

    delete_response = client.delete(f"/api/v1/smartflow/calendar/events/{event_id}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted"] is True
