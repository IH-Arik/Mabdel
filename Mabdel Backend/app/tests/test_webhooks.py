from __future__ import annotations

import asyncio

from app.core.config import settings
from app.core.security import create_access_token, hash_password


async def _create_user(mock_db, email: str = "webhook@example.com") -> str:
    user = {
        "full_name": "Webhook User",
        "email": email,
        "password_hash": hash_password("SecurePass2024!"),
        "is_verified": True,
        "auth_provider": "email",
        "avatar_url": None,
        "language_preference": "EN",
        "notification_preferences": {
            "new_messages": True,
            "missed_calls": True,
            "scheduled_calls": True,
            "ai_tasks": True,
            "calendar_reminders": True,
        },
        "device_tokens": [],
    }
    result = await mock_db.users.insert_one(user)
    return str(result.inserted_id)


def test_meta_webhook_verification(client, monkeypatch):
    monkeypatch.setattr(settings, "META_WEBHOOK_VERIFY_TOKEN", "verify-me")
    response = client.get(
        "/api/v1/smartflow/integrations/instagram/webhook",
        params={"hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "12345"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["challenge"] == "12345"


def test_webhook_processing_is_idempotent(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "WEBHOOK_SHARED_SECRET", "super-secret")
    user_id = asyncio.run(_create_user(mock_db))
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": user_id,
                "platform": "telegram",
                "status": "connected",
            }
        )
    )

    payload = {
        "message": {
            "message_id": 77,
            "text": "Hello from Telegram",
            "from": {"id": 999},
        }
    }
    first = client.post(
        f"/api/v1/smartflow/integrations/telegram/webhook?user_id={user_id}",
        json=payload,
        headers={"X-Webhook-Secret": "super-secret"},
    )
    second = client.post(
        f"/api/v1/smartflow/integrations/telegram/webhook?user_id={user_id}",
        json=payload,
        headers={"X-Webhook-Secret": "super-secret"},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["data"]["status"] == "processed"
    assert second.json()["data"]["status"] == "ignored"


def test_webhook_rejects_invalid_secret(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "WEBHOOK_SHARED_SECRET", "super-secret")
    user_id = asyncio.run(_create_user(mock_db, email="webhook2@example.com"))
    payload = {"event_id": "evt-1", "contact_external_id": "abc", "content": "Hello"}

    response = client.post(
        f"/api/v1/smartflow/integrations/telegram/webhook?user_id={user_id}",
        json=payload,
        headers={"X-Webhook-Secret": "wrong-secret"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "WEBHOOK_UNAUTHORIZED"


def test_telegram_webhook_accepts_native_secret_header(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "WEBHOOK_SHARED_SECRET", "fallback-secret")
    user_id = asyncio.run(_create_user(mock_db, email="webhook3@example.com"))
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": user_id,
                "platform": "telegram",
                "status": "connected",
                "telegram_secret_token": "telegram-secret",
            }
        )
    )

    payload = {
        "message": {
            "message_id": 88,
            "text": "Telegram native secret works",
            "from": {"id": 321},
        }
    }
    response = client.post(
        f"/api/v1/smartflow/integrations/telegram/webhook?user_id={user_id}",
        json=payload,
        headers={"X-Telegram-Bot-Api-Secret-Token": "telegram-secret"},
    )

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "processed"


def test_telegram_webhook_resolves_user_from_secret_without_query_user_id(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "WEBHOOK_SHARED_SECRET", "fallback-secret")
    user_id = asyncio.run(_create_user(mock_db, email="webhook4@example.com"))
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": user_id,
                "platform": "telegram",
                "status": "connected",
                "telegram_secret_token": "telegram-secret",
                "webhook_status": "configured",
            }
        )
    )

    response = client.post(
        "/api/v1/smartflow/integrations/telegram/webhook",
        json={
            "message": {
                "message_id": 89,
                "text": "Resolved without query params",
                "from": {"id": 654, "first_name": "Alex"},
            }
        },
        headers={"X-Telegram-Bot-Api-Secret-Token": "telegram-secret"},
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["status"] == "processed"
    assert payload["message"]["content"] == "Resolved without query params"


def test_meta_webhook_resolves_user_from_external_account_id(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "WEBHOOK_SHARED_SECRET", "super-secret")
    user_id = asyncio.run(_create_user(mock_db, email="webhook5@example.com"))
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": user_id,
                "platform": "instagram",
                "status": "connected",
                "external_account_id": "ig-page-1",
                "webhook_status": "configured",
            }
        )
    )

    response = client.post(
        "/api/v1/smartflow/integrations/instagram/webhook",
        json={
            "entry": [
                {
                    "id": "ig-page-1",
                    "messaging": [
                        {"id": "mid-1", "sender": {"id": "person-1"}, "message": {"text": "Instagram DM"}}
                    ],
                }
            ]
        },
        headers={"X-Webhook-Secret": "super-secret"},
    )

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "processed"


def test_whatsapp_webhook_integration(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "WEBHOOK_SHARED_SECRET", "super-secret")
    user_id = asyncio.run(_create_user(mock_db, email="whatsapp-user@example.com"))

    # 1. Connect WhatsApp manual integration
    connect_payload = {
        "phone_number": "8801700000000",
        "whatsapp_gateway_url": "http://localhost:3001"
    }

    # Authenticate by generating token for user_id
    access_token = create_access_token(user_id, "whatsapp-user@example.com")
    headers = {"Authorization": f"Bearer {access_token}"}

    connect_response = client.post(
        "/api/v1/smartflow/integrations/whatsapp/manual-connect",
        json=connect_payload,
        headers=headers
    )
    assert connect_response.status_code == 201
    assert connect_response.json()["data"]["connected"] is True

    # 2. Simulate incoming message via webhook
    webhook_payload = {
        "event_id": "wa-msg-123",
        "contact_external_id": "8801711111111",
        "content": "Hello via OpenWA",
        "contact_name": "Alice Developer",
        "external_account_id": "8801700000000"
    }

    webhook_response = client.post(
        "/api/v1/smartflow/integrations/whatsapp/webhook?user_id=" + user_id,
        json=webhook_payload,
        headers={"X-Webhook-Secret": "super-secret"}
    )
    assert webhook_response.status_code == 200
    res_data = webhook_response.json()["data"]
    assert res_data["status"] == "processed"
    assert res_data["message"]["content"] == "Hello via OpenWA"
    assert res_data["message"]["platform"] == "whatsapp"

