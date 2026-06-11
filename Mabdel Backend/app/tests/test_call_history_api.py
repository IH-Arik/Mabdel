from __future__ import annotations

import asyncio


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "call-history@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Call History Owner", "email": email, "password": "SecurePass2024!"},
    )
    assert register_response.status_code == 201

    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify_response = client.post("/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"})
    assert verify_response.status_code == 200

    login_response = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login_response.status_code == 200
    return {"Authorization": f"Bearer {login_response.json()['data']['access_token']}"}


def _create_contact(client, headers: dict[str, str], **overrides) -> dict:
    payload = {
        "first_name": "Alex",
        "last_name": "Thompson",
        "phone": "+1 (555) 012-3456",
        "email": "alex.t@acme.com",
        "company": "Acme Corp",
        "job_title": "Senior Manager",
        "address": "San Francisco, CA",
    }
    payload.update(overrides)
    response = client.post("/api/v1/smartflow/contacts", headers=headers, json=payload)
    assert response.status_code == 201
    return response.json()["data"]


def test_call_history_list_detail_transcript_summary_and_callback(client, mock_db) -> None:
    headers = _auth_headers(client, mock_db)
    alex = _create_contact(client, headers)
    david = _create_contact(
        client,
        headers,
        first_name="David",
        last_name="Thompson",
        phone="+1 (347) 890-2211",
        email="david@example.com",
    )

    incoming_response = client.post(
        "/api/v1/smartflow/calls",
        headers=headers,
        json={
            "contact_id": alex["id"],
            "call_type": "incoming_automated",
            "duration": 754,
            "ai_ready": True,
            "recording_url": "https://cdn.example.com/calls/call-1.mp3",
            "transcript": "Customer discussed invoice correction and future ordering.",
            "ai_summary": {
                "purpose": "Discussed invoice correction & future ordering.",
                "key_points": ["Mismatch in the July 15th invoice totaling $420."],
                "action_items": ["Send corrected PDF by Friday EOD."],
                "highlights": [{"text": "Friday EOD", "type": "deadline"}],
            },
        },
    )
    assert incoming_response.status_code == 201
    incoming = incoming_response.json()["data"]
    call_id = incoming["id"]
    assert incoming["contact"]["company"] == "Acme Corp"
    assert incoming["duration_label"] == "12m 34s"
    assert incoming["transcript_available"] is True
    assert incoming["ai_summary_available"] is True
    assert "recording" in incoming["actions"]

    missed_response = client.post(
        "/api/v1/smartflow/calls",
        headers=headers,
        json={"contact_id": david["id"], "call_type": "missed", "duration": 0},
    )
    assert missed_response.status_code == 201
    assert missed_response.json()["data"]["status_tone"] == "danger"

    list_response = client.get("/api/v1/smartflow/calls?search=Alex", headers=headers)
    assert list_response.status_code == 200
    list_payload = list_response.json()["data"]
    assert list_payload["items"][0]["id"] == call_id
    assert list_payload["items"][0]["call_type_label"] == "Incoming Automated"
    assert list_payload["summary"]["total_calls"] == 2
    assert list_payload["summary"]["missed_calls"] == 1

    detail_response = client.get(f"/api/v1/smartflow/calls/{call_id}", headers=headers)
    assert detail_response.status_code == 200
    detail = detail_response.json()["data"]
    assert detail["contact"]["job_title"] == "Senior Manager"
    assert detail["recording_url"].endswith("call-1.mp3")

    transcript_response = client.get(f"/api/v1/smartflow/calls/{call_id}/transcript", headers=headers)
    assert transcript_response.status_code == 200
    assert "invoice correction" in transcript_response.json()["data"]["transcript"]

    update_transcript_response = client.put(
        f"/api/v1/smartflow/calls/{call_id}/transcript",
        headers=headers,
        json={
            "transcript": "Updated transcript with speaker labels.",
            "speaker_segments": [{"speaker": "customer", "text": "Please fix the invoice."}],
        },
    )
    assert update_transcript_response.status_code == 200
    assert update_transcript_response.json()["data"]["speaker_segments"][0]["speaker"] == "customer"

    summary_response = client.get(f"/api/v1/smartflow/calls/{call_id}/ai-summary", headers=headers)
    assert summary_response.status_code == 200
    assert "invoice" in summary_response.json()["data"]["ai_summary"]["purpose"].lower()

    update_summary_response = client.put(
        f"/api/v1/smartflow/calls/{call_id}/ai-summary",
        headers=headers,
        json={
            "purpose": "Updated AI summary",
            "key_points": ["Customer needs corrected invoice."],
            "action_items": ["Send PDF."],
        },
    )
    assert update_summary_response.status_code == 200
    assert update_summary_response.json()["data"]["ai_summary"]["purpose"] == "Updated AI summary"

    callback_response = client.post(f"/api/v1/smartflow/calls/{call_id}/callback", headers=headers)
    assert callback_response.status_code == 200
    assert callback_response.json()["data"]["callback_requested"] is True

    recording_response = client.get(f"/api/v1/smartflow/calls/{call_id}/recording", headers=headers)
    assert recording_response.status_code == 200
    assert recording_response.json()["data"]["recording_available"] is True

    update_recording_response = client.put(
        f"/api/v1/smartflow/calls/{call_id}/recording",
        headers=headers,
        json={"recording_url": "https://cdn.example.com/calls/call-1-updated.mp3", "recording_duration": 755},
    )
    assert update_recording_response.status_code == 200
    assert update_recording_response.json()["data"]["recording_url"].endswith("call-1-updated.mp3")


def test_call_history_summary_route_is_not_shadowed_by_call_id_route(client, mock_db) -> None:
    headers = _auth_headers(client, mock_db, email="call-summary-route@example.com")
    response = client.get("/api/v1/smartflow/calls/summary", headers=headers)
    assert response.status_code == 200
    assert response.json()["data"]["total_calls"] == 0
