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


def test_google_oauth_callback_imports_calendar_events(client, mock_db, monkeypatch) -> None:
    email = "google-calendar@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    grant_owner_role(mock_db, email)
    token = _login_token(client, email)

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "google-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "google-secret")
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "http://127.0.0.1:8000/api/v1/smartflow/integrations/google_business/oauth/callback")

    captured_post_urls: list[str] = []
    captured_get_urls: list[str] = []

    async def fake_post(self, url, data=None, headers=None, params=None, json=None, **kwargs):
        captured_post_urls.append(str(url))
        request = httpx.Request("POST", str(url))
        if "oauth2.googleapis.com/token" in str(url):
            return httpx.Response(
                200,
                json={"access_token": "google-access", "refresh_token": "google-refresh", "expires_in": 3600, "scope": "calendar"},
                request=request,
            )
        return httpx.Response(404, json={}, request=request)

    async def fake_get(self, url, headers=None, params=None, **kwargs):
        captured_get_urls.append(str(url))
        request = httpx.Request("GET", str(url))
        url_str = str(url)
        if "userinfo" in url_str:
            return httpx.Response(200, json={"id": "google-user-1", "email": "owner@gmail.com", "name": "Owner Gmail"}, request=request)
        if "calendarList" in url_str:
            return httpx.Response(
                200,
                json={"items": [{"id": "primary", "summary": "Primary", "primary": True, "accessRole": "owner", "timeZone": "Asia/Dhaka"}]},
                request=request,
            )
        if "/events" in url_str:
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "id": "google-event-1",
                            "summary": "Imported From Google",
                            "description": "Imported event body",
                            "start": {"dateTime": "2099-10-25T10:00:00+06:00", "timeZone": "Asia/Dhaka"},
                            "end": {"dateTime": "2099-10-25T11:00:00+06:00", "timeZone": "Asia/Dhaka"},
                            "location": "Google Room",
                            "hangoutLink": "https://meet.google.com/google-imported",
                            "status": "confirmed",
                            "updated": "2099-10-20T12:00:00Z",
                            "etag": "\"etag-1\"",
                        }
                    ]
                },
                request=request,
            )
        return httpx.Response(404, json={}, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    start_response = client.get(
        "/api/v1/smartflow/integrations/google_business/oauth/start",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert start_response.status_code == 200
    user = asyncio.run(mock_db.users.find_one({"email": email}))
    state_doc = _latest_oauth_state(mock_db, str(user["_id"]))

    callback_response = client.get(
        f"/api/v1/smartflow/integrations/google_business/oauth/callback?code=test-code&state={state_doc['state']}"
    )
    assert callback_response.status_code == 200
    assert "Google Calendar connected" in callback_response.text

    integration = asyncio.run(mock_db.social_integrations.find_one({"user_id": str(user["_id"]), "platform": "google_business"}))
    assert integration is not None
    assert integration["status"] == "connected"
    assert integration["provider_metadata"]["default_calendar_id"] == "primary"
    assert integration["provider_metadata"]["google_user_email"] == "owner@gmail.com"
    assert integration["access_token_encrypted"] != "google-access"
    assert integration["refresh_token_encrypted"] is not None

    imported_event = asyncio.run(mock_db.calendar_events.find_one({"user_id": str(user["_id"]), "google_event_id": "google-event-1"}))
    assert imported_event is not None
    assert imported_event["title"] == "Imported From Google"
    assert imported_event["meeting_link"] == "https://meet.google.com/google-imported"
    assert "oauth2.googleapis.com/token" in captured_post_urls[0]
    assert any("calendarList" in url for url in captured_get_urls)
    assert any("/events" in url for url in captured_get_urls)


def test_google_connected_calendar_event_crud_syncs_provider(client, mock_db, monkeypatch) -> None:
    email = "google-calendar-crud@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    grant_owner_role(mock_db, email)
    token = _login_token(client, email)

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "google-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "google-secret")

    request_log: list[tuple[str, str]] = []

    async def fake_post(self, url, data=None, headers=None, params=None, json=None, **kwargs):
        request_log.append(("POST", str(url)))
        request = httpx.Request("POST", str(url))
        if str(url).endswith("/events"):
            return httpx.Response(
                200,
                json={"id": "remote-created-1", "status": "confirmed", "htmlLink": "https://calendar.google.com/event?1", "updated": "2099-10-01T00:00:00Z", "etag": "\"etag-create\""},
                request=request,
            )
        return httpx.Response(404, json={}, request=request)

    async def fake_put(self, url, headers=None, params=None, json=None, **kwargs):
        request_log.append(("PUT", str(url)))
        request = httpx.Request("PUT", str(url))
        return httpx.Response(
            200,
            json={"id": "remote-created-1", "status": "confirmed", "htmlLink": "https://calendar.google.com/event?1", "updated": "2099-10-02T00:00:00Z", "etag": "\"etag-update\""},
            request=request,
        )

    async def fake_delete(self, url, headers=None, **kwargs):
        request_log.append(("DELETE", str(url)))
        request = httpx.Request("DELETE", str(url))
        return httpx.Response(204, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setattr(httpx.AsyncClient, "put", fake_put)
    monkeypatch.setattr(httpx.AsyncClient, "delete", fake_delete)

    user = asyncio.run(mock_db.users.find_one({"email": email}))
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": str(user["_id"]),
                "platform": "google_business",
                "status": "connected",
                "access_token_encrypted": "gAAAAABp.....",
                "refresh_token_encrypted": "gAAAAABp.....",
                "provider_metadata": {"default_calendar_id": "primary", "default_calendar_name": "Primary", "integration_platform": "google_business"},
                "access_token_expires_at": datetime(2099, 1, 1),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        )
    )

    # Use real encryption helper so decrypt succeeds.
    from app.core.crypto import encrypt_value

    asyncio.run(
        mock_db.social_integrations.update_one(
            {"user_id": str(user["_id"]), "platform": "google_business"},
            {"$set": {"access_token_encrypted": encrypt_value("google-access"), "refresh_token_encrypted": encrypt_value("google-refresh")}},
        )
    )

    create_response = client.post(
        "/api/v1/smartflow/calendar/events",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Local To Google",
            "starts_at": "2099-10-30T10:00:00",
            "ends_at": "2099-10-30T11:00:00",
            "contact_ids": [],
            "meeting_mode": "online",
            "reminder_minutes": 10,
        },
    )
    assert create_response.status_code == 201
    event_id = create_response.json()["data"]["id"]
    assert create_response.json()["data"]["google_event_id"] == "remote-created-1"

    update_response = client.patch(
        f"/api/v1/smartflow/calendar/events/{event_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Local To Google Updated"},
    )
    assert update_response.status_code == 200

    delete_response = client.delete(
        f"/api/v1/smartflow/calendar/events/{event_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_response.status_code == 200

    assert any(method == "POST" and url.endswith("/events") for method, url in request_log)
    assert any(method == "PUT" and "remote-created-1" in url for method, url in request_log)
    assert any(method == "DELETE" and "remote-created-1" in url for method, url in request_log)
