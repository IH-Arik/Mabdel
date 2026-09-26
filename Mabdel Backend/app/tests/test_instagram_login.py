from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

import httpx

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.security import create_access_token
from app.services.smartflow.conversation_service import ConversationService
from app.tests.conftest import grant_owner_role
from app.tests.test_webhooks import _create_user


def test_instagram_authorize_url_uses_instagram_login(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "INSTAGRAM_APP_ID", "ig-app-id")
    monkeypatch.setattr(settings, "INSTAGRAM_APP_SECRET", "ig-app-secret")
    user_id = asyncio.run(_create_user(mock_db, email="ig-start@example.com"))
    grant_owner_role(mock_db, "ig-start@example.com")

    response = client.get(
        "/api/v1/smartflow/integrations/instagram/oauth/start",
        headers={"Authorization": f"Bearer {create_access_token(user_id, 'ig-start@example.com')}"},
    )

    assert response.status_code == 200, response.text
    url = response.json()["data"]["auth_url"]
    assert url.startswith("https://www.instagram.com/oauth/authorize?")
    assert "client_id=ig-app-id" in url
    assert "instagram_business_manage_messages" in url


def test_instagram_connect_exchanges_for_a_long_lived_token_and_subscribes(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "INSTAGRAM_APP_ID", "ig-app-id")
    monkeypatch.setattr(settings, "INSTAGRAM_APP_SECRET", "ig-app-secret")
    user_id = asyncio.run(_create_user(mock_db, email="ig-connect@example.com"))
    asyncio.run(
        mock_db.oauth_states.insert_one(
            {
                "state": "ig-st",
                "user_id": user_id,
                "platform": "instagram",
                "provider": "instagram_login",
                "expires_at": datetime.utcnow() + timedelta(minutes=5),
            }
        )
    )
    calls: list[tuple[str, str, dict]] = []

    async def fake_post(self, url, data=None, params=None, **kwargs):
        calls.append(("POST", str(url), params or data or {}))
        request = httpx.Request("POST", str(url))
        if "api.instagram.com/oauth/access_token" in str(url):
            # the documented shape: the token wrapped in a data list
            body = {"data": [{"access_token": "IG_SHORT", "user_id": "APP_SCOPED", "permissions": "instagram_business_basic"}]}
            return httpx.Response(200, json=body, request=request)
        return httpx.Response(200, json={"success": True}, request=request)

    async def fake_get(self, url, params=None, **kwargs):
        calls.append(("GET", str(url), params or {}))
        request = httpx.Request("GET", str(url))
        if str(url) == "https://graph.instagram.com/access_token":
            return httpx.Response(200, json={"access_token": "IG_LONG", "token_type": "bearer", "expires_in": 5183944}, request=request)
        if str(url).endswith("/me"):
            return httpx.Response(200, json={"user_id": "17841400000", "username": "acme.shop", "name": "Acme"}, request=request)
        return httpx.Response(404, json={}, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    response = client.get("/api/v1/smartflow/integrations/instagram/oauth/callback?code=thecode%23_&state=ig-st")

    assert response.status_code == 200, response.text
    stored = asyncio.run(mock_db.social_integrations.find_one({"platform": "instagram"}))
    assert decrypt_value(stored["access_token_encrypted"]) == "IG_LONG"
    assert stored["external_account_id"] == "17841400000"  # the id webhook entries carry
    assert stored["external_account_name"] == "acme.shop"
    assert stored["provider_metadata"]["webhook_subscribed"] is True

    token_call = next(c for c in calls if "api.instagram.com/oauth/access_token" in c[1])
    assert token_call[2]["code"] == "thecode"  # the suffix Instagram appends to the code is stripped
    assert token_call[2]["client_secret"] == "ig-app-secret"
    exchange = next(c for c in calls if c[1] == "https://graph.instagram.com/access_token")
    assert exchange[2]["grant_type"] == "ig_exchange_token" and exchange[2]["access_token"] == "IG_SHORT"
    subscribe = next(c for c in calls if c[1].endswith("/me/subscribed_apps"))
    assert subscribe[2]["subscribed_fields"] == "messages" and subscribe[2]["access_token"] == "IG_LONG"


def test_instagram_dm_arrives_by_professional_account_id(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    user_id = asyncio.run(_create_user(mock_db, email="ig-inbound@example.com"))
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {"user_id": user_id, "platform": "instagram", "status": "connected", "external_account_id": "17841400000"}
        )
    )
    body = {
        "object": "instagram",
        "entry": [
            {
                "id": "17841400000",
                "time": 1758900000,
                "messaging": [
                    {"sender": {"id": "IGSID_1"}, "recipient": {"id": "17841400000"}, "timestamp": 1758900000000, "message": {"mid": "ig-m1", "text": "price?"}}
                ],
            }
        ],
    }

    response = client.post("/api/v1/smartflow/integrations/instagram/webhook", json=body)

    assert response.status_code == 200
    assert response.json()["data"]["processed"] == 1
    assert asyncio.run(mock_db.messages.find_one({"provider_event_id": "ig-m1"}))["content"] == "price?"


def _seed_instagram_thread(mock_db, user_id: str, *, expires_in_days: int) -> str:
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": user_id,
                "platform": "instagram",
                "status": "connected",
                "external_account_id": "17841400000",
                "access_token_encrypted": encrypt_value("IG_LONG"),
                "access_token_expires_at": datetime.utcnow() + timedelta(days=expires_in_days),
            }
        )
    )
    result = asyncio.run(
        mock_db.contacts.insert_one({"user_id": user_id, "name": "Fan", "identities": [{"platform": "instagram", "external_id": "IGSID_1"}]})
    )
    return str(result.inserted_id)


def test_instagram_reply_uses_the_instagram_host_and_account_id(mock_db, monkeypatch):
    user_id = asyncio.run(_create_user(mock_db, email="ig-send@example.com"))
    contact_id = _seed_instagram_thread(mock_db, user_id, expires_in_days=50)
    seen: dict = {}

    async def fake_post(self, url, json=None, params=None, **kwargs):
        seen.update(url=str(url), json=json, params=params)
        return httpx.Response(200, json={"recipient_id": "IGSID_1", "message_id": "m"}, request=httpx.Request("POST", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    errors: list[str] = []

    delivered = asyncio.run(ConversationService(mock_db)._deliver_outbound(user_id, "instagram", contact_id, "Yes, twenty", errors))

    assert delivered is True and errors == []
    assert seen["url"] == f"https://graph.instagram.com/{settings.META_GRAPH_VERSION}/17841400000/messages"
    assert seen["params"] == {"access_token": "IG_LONG"}
    assert seen["json"] == {"recipient": {"id": "IGSID_1"}, "message": {"text": "Yes, twenty"}}


def test_instagram_token_close_to_expiry_is_refreshed_before_sending(mock_db, monkeypatch):
    user_id = asyncio.run(_create_user(mock_db, email="ig-refresh@example.com"))
    contact_id = _seed_instagram_thread(mock_db, user_id, expires_in_days=3)
    used_tokens: list[str] = []

    async def fake_get(self, url, params=None, **kwargs):
        assert str(url) == "https://graph.instagram.com/refresh_access_token" and params["grant_type"] == "ig_refresh_token"
        return httpx.Response(200, json={"access_token": "IG_LONG_2", "expires_in": 5183944}, request=httpx.Request("GET", str(url)))

    async def fake_post(self, url, json=None, params=None, **kwargs):
        used_tokens.append(params["access_token"])
        return httpx.Response(200, json={}, request=httpx.Request("POST", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    asyncio.run(ConversationService(mock_db)._deliver_outbound(user_id, "instagram", contact_id, "hi", []))

    assert used_tokens == ["IG_LONG_2"]
    stored = asyncio.run(mock_db.social_integrations.find_one({"platform": "instagram"}))
    assert decrypt_value(stored["access_token_encrypted"]) == "IG_LONG_2"
    assert stored["access_token_expires_at"] > datetime.utcnow() + timedelta(days=50)
