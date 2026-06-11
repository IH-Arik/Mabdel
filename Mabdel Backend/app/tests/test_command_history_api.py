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


def _auth_headers(client, mock_db, email: str = "history@example.com") -> tuple[dict[str, str], str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "History User", "email": email, "password": "SecurePass2024!"},
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
    payload = login_response.json()["data"]
    return {"Authorization": f"Bearer {payload['access_token']}"}, payload["user"]["id"]


def test_command_history_list_supports_grouping_and_filters(client, mock_db):
    headers, user_id = _auth_headers(client, mock_db)
    now = utc_now()
    yesterday = now - timedelta(days=1)

    asyncio.run(
        mock_db.ai_command_history.insert_many(
            [
                {
                    "user_id": user_id,
                    "command_text": "Create invoice for $500",
                    "command_type": "invoice",
                    "status": "completed",
                    "timestamp": now,
                    "is_replayable": True,
                    "related_resource": {"type": "invoice", "id": "inv_1"},
                    "preview_payload": {"amount": 500},
                },
                {
                    "user_id": user_id,
                    "command_text": "Summarize yesterday's sales",
                    "command_type": "voice",
                    "status": "archived",
                    "timestamp": yesterday,
                    "is_replayable": True,
                },
            ]
        )
    )

    response = client.get(
        "/api/v1/smartflow/ai/history?group_by=day&command_type=invoice&status=completed",
        headers=headers,
    )
    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["items"][0]["command_type_label"] == "Invoices"
    assert payload["items"][0]["status_label"] == "Completed"
    assert payload["items"][0]["date_bucket"] == "today"
    assert payload["items"][0]["related_resource"]["id"] == "inv_1"
    assert len(payload["groups"]["today"]) == 1
    assert payload["groups"]["yesterday"] == []


def test_command_history_replay_returns_metadata(client, mock_db):
    headers, user_id = _auth_headers(client, mock_db, email="history-replay@example.com")
    history_id = asyncio.run(
        mock_db.ai_command_history.insert_one(
            {
                "user_id": user_id,
                "command_text": "Draft email to Sarah",
                "command_type": "email",
                "status": "completed",
                "timestamp": utc_now(),
                "is_replayable": True,
            }
        )
    ).inserted_id

    response = client.post(f"/api/v1/smartflow/ai/history/{history_id}/replay", headers=headers)
    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["result_type"] == "ai_chat"
    assert payload["replayed_action_status"] == "completed"
    assert payload["history_item"]["command_type_label"] == "Email"
    assert payload["conversation_id"]
