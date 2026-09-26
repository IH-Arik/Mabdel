from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

import httpx

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.services.smartflow.conversation_service import ConversationService
from app.tests.test_webhooks import _create_user


def _state(mock_db, user_id: str, state: str) -> None:
    asyncio.run(
        mock_db.oauth_states.insert_one(
            {"state": state, "user_id": user_id, "platform": "whatsapp", "provider": "meta", "expires_at": datetime.utcnow() + timedelta(minutes=5)}
        )
    )


def _patch_graph(monkeypatch, *, granular_scopes, phones):
    calls: list[tuple[str, str, dict]] = []

    async def fake_post(self, url, data=None, params=None, **kwargs):
        calls.append(("POST", str(url), params or data or {}))
        request = httpx.Request("POST", str(url))
        if "oauth/access_token" in str(url):
            return httpx.Response(200, json={"access_token": "USER_SHORT"}, request=request)
        return httpx.Response(200, json={"success": True}, request=request)

    async def fake_get(self, url, params=None, **kwargs):
        calls.append(("GET", str(url), params or {}))
        request = httpx.Request("GET", str(url))
        if "oauth/access_token" in str(url):
            return httpx.Response(200, json={"access_token": "USER_LONG"}, request=request)
        if str(url).endswith("/debug_token"):
            return httpx.Response(200, json={"data": {"granular_scopes": granular_scopes}}, request=request)
        if str(url).endswith("/phone_numbers"):
            return httpx.Response(200, json={"data": phones}, request=request)
        return httpx.Response(404, json={}, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    return calls


def test_official_whatsapp_connect_finds_the_waba_phone_and_subscribes(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_ID", "app-id")
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", "app-secret")
    user_id = asyncio.run(_create_user(mock_db, email="wa-cloud-connect@example.com"))
    _state(mock_db, user_id, "wa-st")
    calls = _patch_graph(
        monkeypatch,
        granular_scopes=[
            {"scope": "whatsapp_business_management", "target_ids": ["WABA1"]},
            {"scope": "whatsapp_business_messaging", "target_ids": ["WABA1"]},
        ],
        phones=[{"id": "PN1", "display_phone_number": "+1 555 000 0000", "verified_name": "Acme Shop"}],
    )

    response = client.get("/api/v1/smartflow/integrations/whatsapp/oauth/callback?code=abc&state=wa-st")

    assert response.status_code == 200, response.text
    stored = asyncio.run(mock_db.social_integrations.find_one({"platform": "whatsapp"}))
    assert decrypt_value(stored["access_token_encrypted"]) == "USER_LONG"
    assert stored["external_account_id"] == "PN1"  # webhooks identify the number by phone_number_id
    assert stored["external_account_name"] == "Acme Shop"
    assert stored["provider_metadata"]["waba_id"] == "WABA1"
    assert stored["provider_metadata"]["webhook_subscribed"] is True
    assert stored["status"] == "connected"
    subscribe = next(c for c in calls if c[0] == "POST" and c[1].endswith("/WABA1/subscribed_apps"))
    assert subscribe[2]["access_token"] == "USER_LONG"
    debug = next(c for c in calls if c[1].endswith("/debug_token"))
    assert debug[2]["access_token"] == "app-id|app-secret"


def test_official_whatsapp_connect_without_a_waba_fails_clearly(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_ID", "app-id")
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", "app-secret")
    user_id = asyncio.run(_create_user(mock_db, email="wa-cloud-nowaba@example.com"))
    _state(mock_db, user_id, "wa-st-2")
    _patch_graph(monkeypatch, granular_scopes=[], phones=[])

    response = client.get("/api/v1/smartflow/integrations/whatsapp/oauth/callback?code=abc&state=wa-st-2")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "META_NO_WABA"


def test_official_whatsapp_connect_without_a_phone_number_fails_clearly(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_ID", "app-id")
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", "app-secret")
    user_id = asyncio.run(_create_user(mock_db, email="wa-cloud-nophone@example.com"))
    _state(mock_db, user_id, "wa-st-3")
    _patch_graph(monkeypatch, granular_scopes=[{"scope": "whatsapp_business_management", "target_ids": ["WABA1"]}], phones=[])

    response = client.get("/api/v1/smartflow/integrations/whatsapp/oauth/callback?code=abc&state=wa-st-3")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "META_NO_PHONE_NUMBER"


def _seed_cloud_thread(mock_db, user_id: str) -> str:
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": user_id,
                "platform": "whatsapp",
                "status": "connected",
                "external_account_id": "PN1",
                "provider_metadata": {"phone_number_id": "PN1"},
                "access_token_encrypted": encrypt_value("WA_TOKEN"),
            }
        )
    )
    result = asyncio.run(
        mock_db.contacts.insert_one({"user_id": user_id, "name": "Bob", "identities": [{"platform": "whatsapp", "external_id": "8801711111111"}]})
    )
    return str(result.inserted_id)


def test_official_whatsapp_reply_outside_the_window_reports_why(mock_db, monkeypatch):
    user_id = asyncio.run(_create_user(mock_db, email="wa-cloud-window@example.com"))
    contact_id = _seed_cloud_thread(mock_db, user_id)

    async def fake_post(self, url, json=None, headers=None, **kwargs):
        body = {"error": {"message": "Re-engagement message", "type": "OAuthException", "code": 131047}}
        return httpx.Response(400, json=body, request=httpx.Request("POST", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    errors: list[str] = []

    delivered = asyncio.run(ConversationService(mock_db)._deliver_outbound(user_id, "whatsapp", contact_id, "hello", errors))

    assert delivered is False
    assert errors and "24-hour" in errors[0]
