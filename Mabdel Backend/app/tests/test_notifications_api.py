from __future__ import annotations

import asyncio
from datetime import timedelta

from app.core.security import create_access_token
from app.utils.helpers import utc_now


async def _create_notification_user(mock_db) -> tuple[str, dict[str, str]]:
    result = await mock_db.users.insert_one(
        {
            "full_name": "Notification User",
            "email": "notifications@example.com",
            "password_hash": "hashed",
            "is_verified": True,
            "auth_provider": "email",
            "avatar_url": None,
            "language_preference": "EN",
            "notification_preferences": {
                "general_notification": True,
                "sound": True,
                "vibrate": True,
                "new_messages": True,
                "missed_calls": True,
                "scheduled_calls": True,
                "ai_tasks": True,
                "calendar_reminders": True,
            },
        }
    )
    user_id = str(result.inserted_id)
    token = create_access_token(user_id, "notifications@example.com")
    return user_id, {"Authorization": f"Bearer {token}"}


async def _seed_notifications(mock_db, user_id: str) -> list[str]:
    now = utc_now()
    documents = [
        {
            "user_id": user_id,
            "type": "ai_insight",
            "title": "AI Smart Insight",
            "body": "Based on your last 3 calls, Mabdel recommends adjusting the Q3 forecast.",
            "read": False,
            "created_at": now - timedelta(minutes=2),
            "metadata": {"source": "calls"},
        },
        {
            "user_id": user_id,
            "type": "message",
            "title": "Sarah Jenkins",
            "body": "I've reviewed the proposal. The client is asking for a follow-up meeting this Thursday.",
            "read": False,
            "created_at": now - timedelta(minutes=15),
            "action_url": "/smartflow/conversations/client-followup",
        },
        {
            "user_id": user_id,
            "type": "calendar",
            "title": "Stakeholder Meeting",
            "body": "Room 402 - Main Office. Don't forget to bring the updated metrics.",
            "read": False,
            "created_at": now - timedelta(hours=1),
        },
        {
            "user_id": user_id,
            "type": "daily_digest",
            "title": "Daily Digest",
            "body": "Your productivity was higher today compared to last Tuesday.",
            "read": True,
            "created_at": now - timedelta(hours=6),
        },
        {
            "user_id": user_id,
            "type": "system_update",
            "title": "System Update",
            "body": "Version 2.4.0 is now live.",
            "read": True,
            "created_at": now - timedelta(days=1),
        },
    ]
    result = await mock_db.notifications.insert_many(documents)
    return [str(item) for item in result.inserted_ids]


def test_notifications_screen_list_is_frontend_ready(client, mock_db) -> None:
    user_id, headers = asyncio.run(_create_notification_user(mock_db))
    asyncio.run(_seed_notifications(mock_db, user_id))

    response = client.get("/api/v1/smartflow/notifications", headers=headers)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["summary"]["total"] == 5
    assert data["summary"]["unread_count"] == 3
    assert data["summary"]["new_count"] == 3
    assert data["sections"][0]["title"] == "TODAY"
    assert data["sections"][0]["new_count"] == 3
    assert data["items"][0]["title"] == "AI Smart Insight"
    assert data["items"][0]["icon_key"] == "sparkles"
    assert data["items"][0]["accent_tone"] == "cyan"
    assert data["items"][0]["display_time_label"] == "2m ago"
    assert data["items"][0]["unread"] is True
    assert data["items"][-1]["display_time_label"] == "Yesterday"


def test_notifications_mark_all_read_and_delete(client, mock_db) -> None:
    user_id, headers = asyncio.run(_create_notification_user(mock_db))
    notification_ids = asyncio.run(_seed_notifications(mock_db, user_id))

    mark_response = client.post("/api/v1/smartflow/notifications/mark-all-read", headers=headers)

    assert mark_response.status_code == 200
    mark_data = mark_response.json()["data"]
    assert mark_data["updated_count"] == 3
    assert mark_data["summary"]["unread_count"] == 0

    delete_response = client.delete(f"/api/v1/smartflow/notifications/{notification_ids[0]}", headers=headers)

    assert delete_response.status_code == 200
    delete_data = delete_response.json()["data"]
    assert delete_data["deleted"] is True
    assert delete_data["summary"]["total"] == 4
