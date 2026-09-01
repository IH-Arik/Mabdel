from __future__ import annotations

import asyncio
from datetime import datetime

import httpx

from app.core.config import settings
from app.tests.conftest import grant_owner_role
from app.tests.test_auth import _register_user, _verify_signup_otp


def _login_token(client, email: str, password: str = "SecurePass2024!") -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["data"]["access_token"]


def _latest_oauth_state(mock_db, user_id: str) -> dict:
    state = asyncio.run(mock_db.oauth_states.find_one({"user_id": user_id}, sort=[("created_at", -1)]))
    assert state is not None
    return state


def test_microsoft_oauth_callback_uses_body_auth_and_imports_events(client, mock_db, monkeypatch) -> None:
    email = "microsoft-calendar@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    grant_owner_role(mock_db, email)
    token = _login_token(client, email)

    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_ID", "microsoft-client-id")
    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_SECRET", "microsoft-secret")
    monkeypatch.setattr(settings, "MICROSOFT_TENANT_ID", "test-tenant-id")
    monkeypatch.setattr(
        settings, "MICROSOFT_REDIRECT_URI", "http://127.0.0.1:8000/api/v1/smartflow/integrations/microsoft/oauth/callback"
    )

    captured_post_calls: list[tuple[str, object]] = []
    captured_get_urls: list[str] = []

    async def fake_post(self, url, data=None, headers=None, params=None, json=None, auth=None, **kwargs):
        captured_post_calls.append((str(url), auth))
        request = httpx.Request("POST", str(url))
        if "/oauth2/v2.0/token" in str(url):
            assert auth is None
            assert "client_id" in (data or {})
            return httpx.Response(
                200,
                json={"access_token": "microsoft-access", "refresh_token": "microsoft-refresh", "expires_in": 3600, "scope": "Calendars.ReadWrite"},
                request=request,
            )
        return httpx.Response(404, json={}, request=request)

    async def fake_get(self, url, headers=None, params=None, **kwargs):
        captured_get_urls.append(str(url))
        request = httpx.Request("GET", str(url))
        url_str = str(url)
        if url_str == "https://graph.microsoft.com/v1.0/me":
            return httpx.Response(200, json={"mail": "owner@microsoft-example.com", "displayName": "Owner"}, request=request)
        if url_str.startswith("https://graph.microsoft.com/v1.0/me/events"):
            return httpx.Response(
                200,
                json={
                    "value": [
                        {
                            "id": "AAMk-event-1",
                            "subject": "Imported From Outlook",
                            "body": {"content": "Imported meeting body"},
                            "start": {"dateTime": "2099-10-25T10:00:00.0000000", "timeZone": "UTC"},
                            "end": {"dateTime": "2099-10-25T11:00:00.0000000", "timeZone": "UTC"},
                            "isOnlineMeeting": True,
                            "onlineMeeting": {"joinUrl": "https://teams.microsoft.com/l/meetup-join/abc"},
                            "webLink": "https://outlook.office365.com/owa/?itemid=abc",
                        }
                    ]
                },
                request=request,
            )
        return httpx.Response(404, json={}, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    start_response = client.get(
        "/api/v1/smartflow/integrations/microsoft/oauth/start",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert start_response.status_code == 200
    user = asyncio.run(mock_db.users.find_one({"email": email}))
    state_doc = _latest_oauth_state(mock_db, str(user["_id"]))

    callback_response = client.get(
        f"/api/v1/smartflow/integrations/microsoft/oauth/callback?code=test-code&state={state_doc['state']}"
    )
    assert callback_response.status_code == 200
    assert "Microsoft 365 connected" in callback_response.text

    integration = asyncio.run(mock_db.social_integrations.find_one({"user_id": str(user["_id"]), "platform": "microsoft"}))
    assert integration is not None
    assert integration["status"] == "connected"
    assert integration["provider_metadata"]["email"] == "owner@microsoft-example.com"
    assert integration["access_token_encrypted"] != "microsoft-access"
    assert integration["refresh_token_encrypted"] is not None

    imported_event = asyncio.run(mock_db.calendar_events.find_one({"user_id": str(user["_id"]), "microsoft_event_id": "AAMk-event-1"}))
    assert imported_event is not None
    assert imported_event["title"] == "Imported From Outlook"
    assert imported_event["meeting_link"] == "https://teams.microsoft.com/l/meetup-join/abc"
    assert any("/oauth2/v2.0/token" in url for url, _auth in captured_post_calls)
    assert any("/me/events" in url for url in captured_get_urls)


def test_microsoft_connected_calendar_event_crud_when_primary(client, mock_db, monkeypatch) -> None:
    email = "microsoft-calendar-crud@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    grant_owner_role(mock_db, email)
    token = _login_token(client, email)

    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_ID", "microsoft-client-id")
    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_SECRET", "microsoft-secret")
    monkeypatch.setattr(settings, "MICROSOFT_TENANT_ID", "test-tenant-id")

    request_log: list[tuple[str, str]] = []

    async def fake_post(self, url, data=None, headers=None, params=None, json=None, auth=None, **kwargs):
        request_log.append(("POST", str(url)))
        request = httpx.Request("POST", str(url))
        if str(url).endswith("/me/events"):
            return httpx.Response(
                201,
                json={
                    "id": "AAMk-event-2",
                    "onlineMeeting": {"joinUrl": "https://teams.microsoft.com/l/meetup-join/xyz"},
                    "webLink": "https://outlook.office365.com/owa/?itemid=xyz",
                },
                request=request,
            )
        return httpx.Response(404, json={}, request=request)

    async def fake_patch(self, url, headers=None, params=None, json=None, **kwargs):
        request_log.append(("PATCH", str(url)))
        request = httpx.Request("PATCH", str(url))
        return httpx.Response(
            200,
            json={
                "id": "AAMk-event-2",
                "onlineMeeting": {"joinUrl": "https://teams.microsoft.com/l/meetup-join/xyz"},
                "webLink": "https://outlook.office365.com/owa/?itemid=xyz",
            },
            request=request,
        )

    async def fake_delete(self, url, headers=None, **kwargs):
        request_log.append(("DELETE", str(url)))
        request = httpx.Request("DELETE", str(url))
        return httpx.Response(204, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setattr(httpx.AsyncClient, "patch", fake_patch)
    monkeypatch.setattr(httpx.AsyncClient, "delete", fake_delete)

    user = asyncio.run(mock_db.users.find_one({"email": email}))
    from app.core.crypto import encrypt_value

    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": str(user["_id"]),
                "platform": "microsoft",
                "status": "connected",
                "access_token_encrypted": encrypt_value("microsoft-access"),
                "refresh_token_encrypted": encrypt_value("microsoft-refresh"),
                "provider_metadata": {"integration_platform": "microsoft"},
                "access_token_expires_at": datetime(2099, 1, 1),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        )
    )
    # Only Microsoft connected -> it becomes primary via the legacy auto-priority
    # fallback (no explicit organizations.primary_calendar_provider set yet).

    create_response = client.post(
        "/api/v1/smartflow/calendar/events",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Local To Outlook",
            "starts_at": "2099-10-30T10:00:00",
            "ends_at": "2099-10-30T11:00:00",
            "contact_ids": [],
            "meeting_mode": "online",
            "reminder_minutes": 10,
        },
    )
    assert create_response.status_code == 201
    event_id = create_response.json()["data"]["id"]
    assert create_response.json()["data"]["microsoft_event_id"] == "AAMk-event-2"
    assert create_response.json()["data"]["meeting_link"] == "https://teams.microsoft.com/l/meetup-join/xyz"

    update_response = client.patch(
        f"/api/v1/smartflow/calendar/events/{event_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Local To Outlook Updated"},
    )
    assert update_response.status_code == 200

    delete_response = client.delete(
        f"/api/v1/smartflow/calendar/events/{event_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_response.status_code == 200

    assert any(method == "POST" and url.endswith("/me/events") for method, url in request_log)
    assert any(method == "PATCH" and "AAMk-event-2" in url for method, url in request_log)
    assert any(method == "DELETE" and "AAMk-event-2" in url for method, url in request_log)


def test_microsoft_selectable_as_primary_calendar_provider(client, mock_db, monkeypatch) -> None:
    email = "microsoft-calendar-primary@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    grant_owner_role(mock_db, email)
    token = _login_token(client, email)

    async def _set_org() -> None:
        await mock_db.users.update_one({"email": email}, {"$set": {"organization_id": "org-microsoft-primary"}})

    asyncio.run(_set_org())

    response = client.put(
        "/api/v1/smartflow/calendar/provider-settings",
        headers={"Authorization": f"Bearer {token}"},
        json={"provider": "microsoft"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["primary_calendar_provider"] is None  # not connected yet, so it can't become primary
