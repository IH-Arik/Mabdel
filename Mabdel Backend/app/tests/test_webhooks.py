from __future__ import annotations

import asyncio
from datetime import datetime

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.tests.conftest import grant_owner_role


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
    # Meta compares the response body to the challenge, so it must be the bare value.
    assert response.text == "12345"


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
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
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
            "object": "instagram",
            "entry": [
                {
                    "id": "ig-page-1",
                    "time": 1758900000,
                    "messaging": [
                        {
                            "sender": {"id": "person-1"},
                            "recipient": {"id": "ig-page-1"},
                            "timestamp": 1758900000000,
                            "message": {"mid": "mid-1", "text": "Instagram DM"},
                        }
                    ],
                }
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["data"] == {"status": "processed", "processed": 1, "ignored": 0}
    stored = asyncio.run(mock_db.messages.find_one({"provider_event_id": "mid-1"}))
    assert stored["content"] == "Instagram DM"
    assert stored["direction"] == "inbound"


def _fake_gateway(monkeypatch, *, start_status="pending_qr", start_qr="data:image/png;base64,AAA", poll_status="connected", linked_number="8801700000000"):
    """Mocks the Node/Baileys gateway's HTTP surface (POST .../start, GET .../qr)
    the same way test_oauth_integrations.py mocks Telegram's setWebhook call."""
    import httpx

    calls: dict[str, object] = {}

    async def fake_post(self, url, json=None, headers=None, **kwargs):
        calls["post_url"] = url
        calls["post_json"] = json
        calls["post_headers"] = headers
        request = httpx.Request("POST", str(url))
        if url.endswith("/start"):
            return httpx.Response(200, json={"status": start_status, "qr_data_url": start_qr, "linked_number": None}, request=request)
        return httpx.Response(200, json={"status": "disconnected"}, request=request)

    async def fake_get(self, url, headers=None, **kwargs):
        calls["get_url"] = url
        request = httpx.Request("GET", str(url))
        return httpx.Response(200, json={"status": poll_status, "qr_data_url": None, "linked_number": linked_number}, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    return calls


def test_whatsapp_webhook_integration(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "WEBHOOK_SHARED_SECRET", "super-secret")
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    from bson import ObjectId

    # Real organizations use UUIDs, not a user id - the integration must still be
    # owned by a real user or the catalog/inbox can never see it.
    org_id = "617a2b64-4045-4e10-921b-a305a922b579"
    user_id = asyncio.run(_create_user(mock_db, email="whatsapp-user@example.com"))
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"organization_id": org_id}}))
    grant_owner_role(mock_db, "whatsapp-user@example.com")

    access_token = create_access_token(user_id, "whatsapp-user@example.com")
    headers = {"Authorization": f"Bearer {access_token}"}

    _fake_gateway(monkeypatch)

    # 1. Start the WhatsApp session (real flow: this returns a QR to scan, no phone
    # number or gateway URL is asked of the user anymore).
    connect_response = client.post("/api/v1/smartflow/integrations/whatsapp/connect", headers=headers)
    assert connect_response.status_code == 201, connect_response.text
    assert connect_response.json()["data"]["status"] == "pending_qr"
    assert connect_response.json()["data"]["qr_data_url"] == "data:image/png;base64,AAA"

    integration = asyncio.run(mock_db.social_integrations.find_one({"organization_id": org_id, "platform": "whatsapp"}))
    webhook_secret = integration["whatsapp_secret_token"]
    assert webhook_secret

    # 2. Frontend polls the QR endpoint; the gateway now reports "connected" (phone
    # scanned) - this flips the stored integration to connected.
    qr_response = client.get("/api/v1/smartflow/integrations/whatsapp/qr", headers=headers)
    assert qr_response.status_code == 200
    assert qr_response.json()["data"]["status"] == "connected"
    integration = asyncio.run(mock_db.social_integrations.find_one({"organization_id": org_id, "platform": "whatsapp"}))
    assert integration["status"] == "connected"
    assert integration["external_account_id"] == "8801700000000"
    assert integration["user_id"] == user_id

    catalog = client.get("/api/v1/smartflow/integrations/catalog", headers=headers).json()["data"]
    whatsapp_card = next(item for item in catalog if item["platform"] == "whatsapp")
    assert whatsapp_card["connected"] is True

    # 3. Simulate a real inbound message from the gateway, authenticated with the
    # per-organization secret issued at connect time (not the global shared secret,
    # and not a bare guessable user_id query param).
    webhook_payload = {
        "event_id": "wa-msg-123",
        "contact_external_id": "8801711111111@s.whatsapp.net",
        "content": "Hello via Baileys",
        "contact_name": "Alice Developer",
        "external_account_id": "8801700000000",
    }
    webhook_response = client.post(
        "/api/v1/smartflow/integrations/whatsapp/webhook",
        json=webhook_payload,
        headers={"X-Webhook-Secret": webhook_secret},
    )
    assert webhook_response.status_code == 200, webhook_response.text
    res_data = webhook_response.json()["data"]
    assert res_data["status"] == "processed"
    assert res_data["message"]["content"] == "Hello via Baileys"
    assert res_data["message"]["platform"] == "whatsapp"
    conversation = asyncio.run(mock_db.conversations.find_one({"platform": "whatsapp"}))
    assert conversation["user_id"] == user_id

    # 4. A message sent directly from the linked phone (not through Unified) must
    # still land in the same conversation, tagged outbound, without notifying the
    # owner about their own message.
    notifications_before = asyncio.run(mock_db.notifications.count_documents({"user_id": user_id}))
    self_sent_payload = {
        "event_id": "wa-msg-124",
        "contact_external_id": "8801711111111@s.whatsapp.net",
        "content": "Sure, I'll call you back",
        "external_account_id": "8801700000000",
        "direction": "outbound",
        "timestamp": "2026-01-01T10:00:00+00:00",
    }
    self_sent_response = client.post(
        "/api/v1/smartflow/integrations/whatsapp/webhook",
        json=self_sent_payload,
        headers={"X-Webhook-Secret": webhook_secret},
    )
    assert self_sent_response.status_code == 200, self_sent_response.text
    self_sent_data = self_sent_response.json()["data"]
    assert self_sent_data["message"]["direction"] == "outbound"
    assert asyncio.run(mock_db.notifications.count_documents({"user_id": user_id})) == notifications_before

    stored_message = asyncio.run(mock_db.messages.find_one({"provider_event_id": "wa-msg-124"}))
    assert stored_message["timestamp"].isoformat().startswith("2026-01-01")
    assert stored_message["unread_count"] == 0


def test_whatsapp_history_import_backfills_without_spamming_notifications(client, mock_db, monkeypatch):
    from bson import ObjectId

    org_id = "617a2b64-4045-4e10-921b-a305a922b579"
    user_id = asyncio.run(_create_user(mock_db, email="whatsapp-history@example.com"))
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"organization_id": org_id}}))
    grant_owner_role(mock_db, "whatsapp-history@example.com")
    headers = {"Authorization": f"Bearer {create_access_token(user_id, 'whatsapp-history@example.com')}"}

    _fake_gateway(monkeypatch)
    client.post("/api/v1/smartflow/integrations/whatsapp/connect", headers=headers)
    client.get("/api/v1/smartflow/integrations/whatsapp/qr", headers=headers)  # flips it to "connected"
    integration = asyncio.run(mock_db.social_integrations.find_one({"organization_id": org_id, "platform": "whatsapp"}))
    webhook_secret = integration["whatsapp_secret_token"]

    # Newest-first, mixed direction, exactly what a real history sync looks like.
    batch = {
        "messages": [
            {
                "event_id": "hist-3",
                "contact_external_id": "8801711111111@s.whatsapp.net",
                "content": "Yes, tomorrow works",
                "external_account_id": "8801700000000",
                "direction": "outbound",
                "timestamp": "2025-06-03T09:00:00+00:00",
            },
            {
                "event_id": "hist-2",
                "contact_external_id": "8801711111111@s.whatsapp.net",
                "content": "Can we reschedule?",
                "external_account_id": "8801700000000",
                "direction": "inbound",
                "timestamp": "2025-06-02T09:00:00+00:00",
            },
            {
                "event_id": "hist-1",
                "contact_external_id": "8801711111111@s.whatsapp.net",
                "content": "Hi, following up on the quote",
                "external_account_id": "8801700000000",
                "direction": "inbound",
                "timestamp": "2025-06-01T09:00:00+00:00",
            },
        ]
    }
    response = client.post(
        "/api/v1/smartflow/integrations/whatsapp/webhook/history",
        json=batch,
        headers={"X-Webhook-Secret": webhook_secret},
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"] == {"status": "processed", "imported": 3, "skipped": 0}

    messages = asyncio.run(mock_db.messages.find({"platform": "whatsapp"}).sort("timestamp", 1).to_list(None))
    assert [m["provider_event_id"] for m in messages] == ["hist-1", "hist-2", "hist-3"]
    assert all(m["unread_count"] == 0 for m in messages)
    assert asyncio.run(mock_db.notifications.count_documents({"user_id": user_id})) == 0

    def _naive(value):
        return value.replace(tzinfo=None) if value.tzinfo else value

    # The conversation was created just now (utc_now(), by the first history write) -
    # $max must not drag it back to an older history timestamp.
    conversation = asyncio.run(mock_db.conversations.find_one({"platform": "whatsapp"}))
    assert _naive(conversation["updated_at"]) > _naive(datetime(2025, 6, 3))

    # A live message arriving after the import must correctly become the newest
    # activity - $max must not get stuck at whatever was written first.
    live_response = client.post(
        "/api/v1/smartflow/integrations/whatsapp/webhook",
        json={
            "event_id": "live-after-history",
            "contact_external_id": "8801711111111@s.whatsapp.net",
            "content": "Are you there?",
            "external_account_id": "8801700000000",
        },
        headers={"X-Webhook-Secret": webhook_secret},
    )
    assert live_response.status_code == 200
    conversation = asyncio.run(mock_db.conversations.find_one({"platform": "whatsapp"}))
    live_message = asyncio.run(mock_db.messages.find_one({"provider_event_id": "live-after-history"}))
    assert _naive(conversation["updated_at"]) == _naive(live_message["timestamp"])

    # Redelivering the same batch (Baileys can emit history in more than one pass)
    # must import nothing new - the per-tenant processed_webhooks index dedupes it.
    replay = client.post(
        "/api/v1/smartflow/integrations/whatsapp/webhook/history",
        json=batch,
        headers={"X-Webhook-Secret": webhook_secret},
    )
    assert replay.status_code == 200
    assert replay.json()["data"] == {"status": "processed", "imported": 0, "skipped": 3}
    assert asyncio.run(mock_db.messages.count_documents({"platform": "whatsapp"})) == 4  # 3 history + 1 live


def test_whatsapp_history_import_stops_when_disconnected_mid_batch(mock_db, monkeypatch):
    from app.services.smartflow.integration_service import IntegrationService

    user_id = "69efae8b5af39608a990e09e"
    asyncio.run(mock_db.social_integrations.insert_one({"user_id": user_id, "platform": "whatsapp", "status": "connected"}))
    service = IntegrationService(mock_db)
    monkeypatch.setattr(IntegrationService, "_HISTORY_CONNECTED_CHECK_EVERY", 2)
    recorded = []

    async def fake_record(uid, platform, payload, is_history_import=False):
        recorded.append(payload)
        if len(recorded) == 3:  # the user clicks Disconnect while the import is running
            await mock_db.social_integrations.update_one({"user_id": uid}, {"$set": {"status": "disconnected"}})
        return {"id": str(len(recorded))}

    monkeypatch.setattr(service, "_record_inbound_message", fake_record)
    batch = [
        {"event_id": f"h-{i}", "contact_external_id": "8801711111111@s.whatsapp.net", "content": "x", "external_account_id": "8801700000000"}
        for i in range(10)
    ]

    result = asyncio.run(service.handle_inbound_webhook_batch(user_id, "whatsapp", batch))

    assert len(recorded) == 4  # checked before #3 (still connected) and before #5 (stopped)
    assert result == {"status": "processed", "imported": 4, "skipped": 6}


def test_whatsapp_history_import_rejects_wrong_secret(client, mock_db, monkeypatch):
    from bson import ObjectId

    org_id = "617a2b64-4045-4e10-921b-a305a922b579"
    user_id = asyncio.run(_create_user(mock_db, email="whatsapp-history-bad@example.com"))
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"organization_id": org_id}}))
    grant_owner_role(mock_db, "whatsapp-history-bad@example.com")
    headers = {"Authorization": f"Bearer {create_access_token(user_id, 'whatsapp-history-bad@example.com')}"}

    _fake_gateway(monkeypatch)
    client.post("/api/v1/smartflow/integrations/whatsapp/connect", headers=headers)

    response = client.post(
        "/api/v1/smartflow/integrations/whatsapp/webhook/history",
        json={"messages": [{"event_id": "x", "contact_external_id": "1", "content": "spoof", "external_account_id": "8801700000000"}]},
        headers={"X-Webhook-Secret": "totally-wrong"},
    )
    assert response.status_code in (400, 401)
    assert asyncio.run(mock_db.messages.count_documents({})) == 0


def _meta_signed_whatsapp_request(client, body: dict, secret: str):
    import hashlib
    import hmac
    import json

    raw = json.dumps(body).encode()
    signature = "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return client.post(
        "/api/v1/smartflow/integrations/whatsapp/webhook",
        content=raw,
        headers={"content-type": "application/json", "X-Hub-Signature-256": signature},
    )


def test_whatsapp_official_api_webhook_accepts_valid_meta_signature(client, mock_db, monkeypatch):
    """The official Business API path coexists with the QR gateway: Meta-signed
    requests authenticate by signature, not by the per-organization gateway secret."""
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", "meta-app-secret")
    user_id = asyncio.run(_create_user(mock_db, email="whatsapp-official@example.com"))
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {"user_id": user_id, "platform": "whatsapp", "status": "connected", "external_account_id": "phone-id-1"}
        )
    )

    response = _meta_signed_whatsapp_request(
        client,
        {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "id": "WABA-1",
                    "changes": [
                        {
                            "field": "messages",
                            "value": {
                                "messaging_product": "whatsapp",
                                "metadata": {"display_phone_number": "15550000000", "phone_number_id": "phone-id-1"},
                                "contacts": [{"profile": {"name": "Bob"}, "wa_id": "8801711111111"}],
                                "messages": [
                                    {
                                        "from": "8801711111111",
                                        "id": "wamid-official-1",
                                        "timestamp": "1758900000",
                                        "type": "text",
                                        "text": {"body": "Hello via Meta Cloud API"},
                                    }
                                ],
                            },
                        }
                    ],
                }
            ],
        },
        "meta-app-secret",
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["processed"] == 1
    stored = asyncio.run(mock_db.messages.find_one({"provider_event_id": "wamid-official-1"}))
    assert stored["content"] == "Hello via Meta Cloud API"
    contact = asyncio.run(mock_db.contacts.find_one({"user_id": user_id}))
    assert contact["name"] == "Bob"


def test_whatsapp_webhook_rejects_forged_meta_signature(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", "meta-app-secret")
    user_id = asyncio.run(_create_user(mock_db, email="whatsapp-forged@example.com"))
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {"user_id": user_id, "platform": "whatsapp", "status": "connected", "external_account_id": "phone-id-2"}
        )
    )
    response = _meta_signed_whatsapp_request(
        client,
        {"event_id": "x", "contact_external_id": "1", "content": "spoof", "external_account_id": "phone-id-2"},
        "not-the-real-secret",
    )
    assert response.status_code == 401


def test_whatsapp_webhook_rejects_signature_header_when_meta_secret_unconfigured(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    user_id = asyncio.run(_create_user(mock_db, email="whatsapp-nometa@example.com"))
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {"user_id": user_id, "platform": "whatsapp", "status": "connected", "external_account_id": "phone-id-3"}
        )
    )
    response = _meta_signed_whatsapp_request(
        client,
        {"event_id": "y", "contact_external_id": "1", "content": "spoof", "external_account_id": "phone-id-3"},
        "anything",
    )
    assert response.status_code == 401


def test_whatsapp_webhook_repairs_legacy_record_owned_by_organization_uuid(client, mock_db):
    """Regression for the production 500: an earlier version stored the organization
    id (a UUID) as the integration's user_id, so the first inbound message crashed in
    push-notification code with InvalidId. The webhook must repair the record to a
    real owner instead of failing."""
    from bson import ObjectId

    org_id = "617a2b64-4045-4e10-921b-a305a922b579"
    owner_id = asyncio.run(_create_user(mock_db, email="legacy-wa-owner@example.com"))
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(owner_id)}, {"$set": {"organization_id": org_id, "role": "owner"}}))
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": org_id,
                "organization_id": org_id,
                "platform": "whatsapp",
                "status": "connected",
                "external_account_id": "8801909620260",
                "whatsapp_secret_token": "legacy-secret",
            }
        )
    )

    response = client.post(
        "/api/v1/smartflow/integrations/whatsapp/webhook",
        json={
            "event_id": "wa-legacy-1",
            "contact_external_id": "8801711111111@s.whatsapp.net",
            "content": "hi after upgrade",
            "contact_name": "Customer",
            "external_account_id": "8801909620260",
        },
        headers={"X-Webhook-Secret": "legacy-secret"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["status"] == "processed"

    repaired = asyncio.run(mock_db.social_integrations.find_one({"platform": "whatsapp"}))
    assert repaired["user_id"] == owner_id
    conversation = asyncio.run(mock_db.conversations.find_one({"platform": "whatsapp"}))
    assert conversation["user_id"] == owner_id


def test_catalog_restarts_a_connected_whatsapp_session_the_gateway_lost(client, mock_db, monkeypatch):
    """After a gateway restart, a session paired before boot-restore existed has no
    live session. Loading the catalog must start it again using the stored secret."""
    import httpx
    from bson import ObjectId

    org_id = "617a2b64-4045-4e10-921b-a305a922b579"
    user_id = asyncio.run(_create_user(mock_db, email="wa-restore@example.com"))
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"organization_id": org_id}}))
    grant_owner_role(mock_db, "wa-restore@example.com")
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": user_id,
                "organization_id": org_id,
                "platform": "whatsapp",
                "status": "connected",
                "whatsapp_secret_token": "kept-secret",
            }
        )
    )
    started: dict = {}

    async def fake_get(self, url, headers=None, **kwargs):
        return httpx.Response(200, json={"status": "disconnected"}, request=httpx.Request("GET", str(url)))

    async def fake_post(self, url, json=None, headers=None, **kwargs):
        started["url"] = url
        started["json"] = json
        return httpx.Response(200, json={"status": "connected"}, request=httpx.Request("POST", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    token = create_access_token(user_id, "wa-restore@example.com")
    response = client.get("/api/v1/smartflow/integrations/catalog", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert started["url"].endswith(f"/sessions/{org_id}/start")
    assert started["json"] == {"webhook_secret": "kept-secret"}


def test_whatsapp_webhook_rejects_wrong_secret(client, mock_db, monkeypatch):
    """The exact gap found during the WhatsApp gateway rebuild: whatsapp used to be
    bundled into META_PLATFORMS, which skipped webhook secret validation entirely
    and trusted a bare ?user_id= query param. Now whatsapp must always be rejected
    without the correct per-organization secret, mirroring telegram."""
    from bson import ObjectId

    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    user_id = asyncio.run(_create_user(mock_db, email="whatsapp-secure@example.com"))
    asyncio.run(mock_db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"organization_id": user_id}}))
    grant_owner_role(mock_db, "whatsapp-secure@example.com")

    access_token = create_access_token(user_id, "whatsapp-secure@example.com")
    headers = {"Authorization": f"Bearer {access_token}"}

    _fake_gateway(monkeypatch)
    client.post("/api/v1/smartflow/integrations/whatsapp/connect", headers=headers)
    client.get("/api/v1/smartflow/integrations/whatsapp/qr", headers=headers)

    response = client.post(
        "/api/v1/smartflow/integrations/whatsapp/webhook",
        json={
            "event_id": "wa-msg-fake",
            "contact_external_id": "8801711111111@s.whatsapp.net",
            "content": "Spoofed message",
            "contact_name": "Attacker",
            "external_account_id": "8801700000000",
        },
        headers={"X-Webhook-Secret": "totally-wrong-secret"},
    )
    assert response.status_code in (400, 401)



def test_processed_webhooks_index_allows_same_event_id_for_different_tenants(mock_db):
    """Two organizations can legitimately receive the same provider event id (a Telegram
    message_id is a small per-chat integer). The dedupe index must be per-tenant or the
    second tenant's message is silently dropped as a 'duplicate'."""
    from types import SimpleNamespace

    import pymongo.errors

    from app.core.database import MongoConnectionManager

    asyncio.run(MongoConnectionManager.ensure_indexes(SimpleNamespace(database=mock_db)))

    asyncio.run(mock_db.processed_webhooks.insert_one({"platform": "telegram", "event_id": "77", "user_id": "tenant-a"}))
    asyncio.run(mock_db.processed_webhooks.insert_one({"platform": "telegram", "event_id": "77", "user_id": "tenant-b"}))

    try:
        asyncio.run(mock_db.processed_webhooks.insert_one({"platform": "telegram", "event_id": "77", "user_id": "tenant-a"}))
    except pymongo.errors.DuplicateKeyError:
        pass
    else:
        raise AssertionError("the same tenant must still be deduplicated")


def test_webhooks_fail_closed_in_production_when_no_secret_is_configured(client, mock_db, monkeypatch):
    """An empty WEBHOOK_SHARED_SECRET / META_CLIENT_SECRET used to mean 'accept anything',
    so a bare ?user_id=<victim> injected messages into any tenant."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "WEBHOOK_SHARED_SECRET", None)
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    user_id = asyncio.run(_create_user(mock_db, email="failclosed@example.com"))
    payload = {"event_id": "evt-x", "contact_external_id": "abc", "content": "spoof"}

    for platform in ("snapchat", "telegram", "instagram"):
        response = client.post(f"/api/v1/smartflow/integrations/{platform}/webhook?user_id={user_id}", json=payload)
        assert response.status_code == 401, (platform, response.text)

    assert asyncio.run(mock_db.processed_webhooks.count_documents({})) == 0
