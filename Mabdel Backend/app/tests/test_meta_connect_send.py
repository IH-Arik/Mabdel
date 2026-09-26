from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

import httpx
from bson import ObjectId

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.services.smartflow.conversation_service import ConversationService
from app.tests.test_webhooks import _create_user


def _configure_meta(monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_ID", "app-id")
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", "app-secret")


def test_messenger_connect_stores_a_page_token_and_subscribes_the_page(client, mock_db, monkeypatch):
    """The Send API needs a Page access token and the Page must be subscribed to the app,
    otherwise Meta never delivers its messages. OAuth only yields a *user* token."""
    _configure_meta(monkeypatch)
    user_id = asyncio.run(_create_user(mock_db, email="meta-connect@example.com"))
    asyncio.run(
        mock_db.oauth_states.insert_one(
            {
                "state": "st-1",
                "user_id": user_id,
                "platform": "facebook_messenger",
                "provider": "meta",
                "expires_at": datetime.utcnow() + timedelta(minutes=5),
            }
        )
    )
    calls: list[tuple[str, str, dict]] = []

    async def fake_post(self, url, data=None, params=None, json=None, **kwargs):
        calls.append(("POST", str(url), params or data or {}))
        request = httpx.Request("POST", str(url))
        if "oauth/access_token" in str(url):
            return httpx.Response(200, json={"access_token": "USER_SHORT", "token_type": "bearer"}, request=request)
        return httpx.Response(200, json={"success": True}, request=request)  # subscribed_apps

    async def fake_get(self, url, params=None, **kwargs):
        calls.append(("GET", str(url), params or {}))
        request = httpx.Request("GET", str(url))
        if "oauth/access_token" in str(url):
            return httpx.Response(200, json={"access_token": "USER_LONG"}, request=request)
        if str(url).endswith("/me/accounts"):
            return httpx.Response(
                200,
                json={"data": [{"id": "PAGE1", "name": "Acme Shop", "access_token": "PAGE_TOKEN_1"}, {"id": "PAGE2", "name": "Other", "access_token": "PAGE_TOKEN_2"}]},
                request=request,
            )
        return httpx.Response(404, json={}, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    response = client.get("/api/v1/smartflow/integrations/facebook_messenger/oauth/callback?code=abc&state=st-1")

    assert response.status_code == 200, response.text
    stored = asyncio.run(mock_db.social_integrations.find_one({"platform": "facebook_messenger"}))
    assert decrypt_value(stored["access_token_encrypted"]) == "PAGE_TOKEN_1"  # the Page token, not a user token
    assert stored["external_account_id"] == "PAGE1"
    assert stored["provider_metadata"]["webhook_subscribed"] is True
    assert stored["provider_metadata"]["pages"] == [{"id": "PAGE1", "name": "Acme Shop"}, {"id": "PAGE2", "name": "Other"}]
    assert "PAGE_TOKEN_2" not in str(stored["provider_metadata"])  # other pages' tokens are never persisted

    exchange = next(c for c in calls if c[0] == "GET" and "oauth/access_token" in c[1])
    assert exchange[2]["grant_type"] == "fb_exchange_token" and exchange[2]["fb_exchange_token"] == "USER_SHORT"
    subscribe = next(c for c in calls if c[0] == "POST" and c[1].endswith("/PAGE1/subscribed_apps"))
    assert subscribe[2]["subscribed_fields"] == "messages,message_echoes"
    assert subscribe[2]["access_token"] == "PAGE_TOKEN_1"
    assert f"/{settings.META_GRAPH_VERSION}/" in subscribe[1]


def test_messenger_connect_with_no_page_fails_clearly(client, mock_db, monkeypatch):
    _configure_meta(monkeypatch)
    user_id = asyncio.run(_create_user(mock_db, email="meta-nopage@example.com"))
    asyncio.run(
        mock_db.oauth_states.insert_one(
            {"state": "st-2", "user_id": user_id, "platform": "facebook_messenger", "provider": "meta", "expires_at": datetime.utcnow() + timedelta(minutes=5)}
        )
    )

    async def fake_post(self, url, data=None, **kwargs):
        return httpx.Response(200, json={"access_token": "U"}, request=httpx.Request("POST", str(url)))

    async def fake_get(self, url, params=None, **kwargs):
        body = {"access_token": "U"} if "oauth/access_token" in str(url) else {"data": []}
        return httpx.Response(200, json=body, request=httpx.Request("GET", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    response = client.get("/api/v1/smartflow/integrations/facebook_messenger/oauth/callback?code=abc&state=st-2")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "META_NO_PAGES"


def _seed_messenger_thread(mock_db, user_id: str) -> str:
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": user_id,
                "platform": "facebook_messenger",
                "status": "connected",
                "external_account_id": "PAGE1",
                "access_token_encrypted": encrypt_value("PAGE_TOKEN_1"),
            }
        )
    )
    result = asyncio.run(
        mock_db.contacts.insert_one(
            {"user_id": user_id, "name": "Customer", "identities": [{"platform": "facebook_messenger", "external_id": "PSID_A"}]}
        )
    )
    return str(result.inserted_id)


def test_messenger_reply_uses_the_page_endpoint_token_and_messaging_type(mock_db, monkeypatch):
    user_id = asyncio.run(_create_user(mock_db, email="meta-send@example.com"))
    contact_id = _seed_messenger_thread(mock_db, user_id)
    seen: dict = {}

    async def fake_post(self, url, json=None, params=None, **kwargs):
        seen.update(url=str(url), json=json, params=params)
        return httpx.Response(200, json={"recipient_id": "PSID_A", "message_id": "m.1"}, request=httpx.Request("POST", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    errors: list[str] = []

    delivered = asyncio.run(ConversationService(mock_db)._deliver_outbound(user_id, "facebook_messenger", contact_id, "Thanks!", errors))

    assert delivered is True and errors == []
    assert seen["url"] == f"https://graph.facebook.com/{settings.META_GRAPH_VERSION}/PAGE1/messages"
    assert seen["params"] == {"access_token": "PAGE_TOKEN_1"}
    assert seen["json"] == {"recipient": {"id": "PSID_A"}, "messaging_type": "RESPONSE", "message": {"text": "Thanks!"}}


def test_reply_outside_the_24_hour_window_reports_a_readable_reason(mock_db, monkeypatch):
    user_id = asyncio.run(_create_user(mock_db, email="meta-window@example.com"))
    contact_id = _seed_messenger_thread(mock_db, user_id)

    async def fake_post(self, url, json=None, params=None, **kwargs):
        body = {"error": {"message": "This message is sent outside of allowed window.", "type": "OAuthException", "code": 10, "error_subcode": 2018278}}
        return httpx.Response(400, json=body, request=httpx.Request("POST", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    errors: list[str] = []

    delivered = asyncio.run(ConversationService(mock_db)._deliver_outbound(user_id, "facebook_messenger", contact_id, "Hello?", errors))

    assert delivered is False
    assert errors and "24-hour" in errors[0]


def test_reply_with_an_expired_token_tells_the_user_to_reconnect(mock_db, monkeypatch):
    user_id = asyncio.run(_create_user(mock_db, email="meta-expired@example.com"))
    contact_id = _seed_messenger_thread(mock_db, user_id)

    async def fake_post(self, url, json=None, params=None, **kwargs):
        body = {"error": {"message": "Error validating access token: Session has expired", "type": "OAuthException", "code": 190}}
        return httpx.Response(401, json=body, request=httpx.Request("POST", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    errors: list[str] = []

    asyncio.run(ConversationService(mock_db)._deliver_outbound(user_id, "facebook_messenger", contact_id, "Hi", errors))

    assert errors and "reconnect" in errors[0].lower()


def test_failed_reply_is_recorded_on_the_message_with_its_reason(mock_db, monkeypatch):
    user_id = asyncio.run(_create_user(mock_db, email="meta-failed@example.com"))
    contact_id = _seed_messenger_thread(mock_db, user_id)
    conversation = asyncio.run(
        mock_db.conversations.insert_one(
            {"user_id": user_id, "contact_id": contact_id, "platform": "facebook_messenger", "type": "direct", "member_ids": [user_id]}
        )
    )
    message = asyncio.run(
        mock_db.messages.insert_one(
            {"user_id": user_id, "conversation_id": str(conversation.inserted_id), "platform": "facebook_messenger", "direction": "outbound", "content": "x", "status": "sent"}
        )
    )

    async def fake_post(self, url, json=None, params=None, **kwargs):
        body = {"error": {"message": "outside of allowed window", "code": 10, "error_subcode": 2018278}}
        return httpx.Response(400, json=body, request=httpx.Request("POST", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    asyncio.run(
        ConversationService(mock_db)._finalize_outbound_delivery(
            user_id=user_id,
            conversation_id=str(conversation.inserted_id),
            message_id=str(message.inserted_id),
            platform="facebook_messenger",
            contact_id=contact_id,
            content="x",
        )
    )

    stored = asyncio.run(mock_db.messages.find_one({"_id": ObjectId(message.inserted_id)}))
    assert stored["status"] == "failed"
    assert "24-hour" in stored["delivery_error"]


def test_new_messenger_contact_gets_its_real_name_from_the_graph_api(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    user_id = asyncio.run(_create_user(mock_db, email="meta-name@example.com"))
    _seed_messenger_thread(mock_db, user_id)
    asyncio.run(mock_db.contacts.delete_many({"user_id": user_id}))  # let the webhook create the contact
    seen: dict = {}

    async def fake_get(self, url, params=None, **kwargs):
        seen.update(url=str(url), params=params)
        return httpx.Response(200, json={"name": "Aisha Rahman", "id": "PSID_A"}, request=httpx.Request("GET", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    body = {
        "object": "page",
        "entry": [{"id": "PAGE1", "messaging": [{"sender": {"id": "PSID_A"}, "recipient": {"id": "PAGE1"}, "timestamp": 1758900000000, "message": {"mid": "m1", "text": "hi"}}]}],
    }

    response = client.post("/api/v1/smartflow/integrations/facebook_messenger/webhook", json=body)

    assert response.status_code == 200
    assert seen["url"].endswith("/PSID_A") and seen["params"]["access_token"] == "PAGE_TOKEN_1"
    assert asyncio.run(mock_db.contacts.find_one({"user_id": user_id}))["name"] == "Aisha Rahman"
    assert asyncio.run(mock_db.conversations.find_one({"user_id": user_id}))["title"] == "Aisha Rahman"


def test_a_graph_failure_never_blocks_message_delivery(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", None)
    user_id = asyncio.run(_create_user(mock_db, email="meta-name-fail@example.com"))
    _seed_messenger_thread(mock_db, user_id)
    asyncio.run(mock_db.contacts.delete_many({"user_id": user_id}))

    async def fake_get(self, url, params=None, **kwargs):
        raise httpx.ConnectError("graph down")

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    body = {
        "object": "page",
        "entry": [{"id": "PAGE1", "messaging": [{"sender": {"id": "PSID_B"}, "recipient": {"id": "PAGE1"}, "timestamp": 1758900000000, "message": {"mid": "m9", "text": "hello"}}]}],
    }

    response = client.post("/api/v1/smartflow/integrations/facebook_messenger/webhook", json=body)

    assert response.status_code == 200
    assert response.json()["data"]["processed"] == 1
    assert asyncio.run(mock_db.contacts.find_one({"user_id": user_id}))["name"] == "Facebook Contact"
