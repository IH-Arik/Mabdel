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


def test_zoom_oauth_callback_uses_basic_auth_and_imports_meetings(client, mock_db, monkeypatch) -> None:
    email = "zoom-calendar@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    grant_owner_role(mock_db, email)
    token = _login_token(client, email)

    monkeypatch.setattr(settings, "ZOOM_CLIENT_ID", "zoom-client-id")
    monkeypatch.setattr(settings, "ZOOM_CLIENT_SECRET", "zoom-secret")
    monkeypatch.setattr(settings, "ZOOM_REDIRECT_URI", "http://127.0.0.1:8000/api/v1/smartflow/integrations/zoom/oauth/callback")

    captured_post_calls: list[tuple[str, object]] = []
    captured_get_urls: list[str] = []

    async def fake_post(self, url, data=None, headers=None, params=None, json=None, auth=None, **kwargs):
        captured_post_calls.append((str(url), auth))
        request = httpx.Request("POST", str(url))
        if "zoom.us/oauth/token" in str(url):
            # The token exchange must use HTTP Basic Auth, not body credentials.
            assert auth is not None
            assert "client_id" not in (data or {})
            assert "client_secret" not in (data or {})
            return httpx.Response(
                200,
                json={"access_token": "zoom-access", "refresh_token": "zoom-refresh", "expires_in": 3600, "scope": "meeting:write:meeting"},
                request=request,
            )
        return httpx.Response(404, json={}, request=request)

    async def fake_get(self, url, headers=None, params=None, **kwargs):
        captured_get_urls.append(str(url))
        request = httpx.Request("GET", str(url))
        url_str = str(url)
        if url_str.endswith("/users/me"):
            return httpx.Response(200, json={"id": "zoom-user-1", "email": "owner@zoom-example.com", "timezone": "Asia/Dhaka"}, request=request)
        if "/users/me/meetings" in url_str:
            return httpx.Response(
                200,
                json={
                    "meetings": [
                        {
                            "id": 999888777,
                            "topic": "Imported From Zoom",
                            "agenda": "Imported meeting body",
                            "start_time": "2099-10-25T10:00:00Z",
                            "duration": 60,
                            "timezone": "Asia/Dhaka",
                            "join_url": "https://zoom.us/j/999888777",
                            "start_url": "https://zoom.us/s/999888777?zak=abc",
                            "created_at": "2099-10-20T12:00:00Z",
                        }
                    ],
                    "next_page_token": "",
                },
                request=request,
            )
        return httpx.Response(404, json={}, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    start_response = client.get(
        "/api/v1/smartflow/integrations/zoom/oauth/start",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert start_response.status_code == 200
    user = asyncio.run(mock_db.users.find_one({"email": email}))
    state_doc = _latest_oauth_state(mock_db, str(user["_id"]))

    callback_response = client.get(
        f"/api/v1/smartflow/integrations/zoom/oauth/callback?code=test-code&state={state_doc['state']}"
    )
    assert callback_response.status_code == 200
    assert "Zoom Calendar connected" in callback_response.text

    integration = asyncio.run(mock_db.social_integrations.find_one({"user_id": str(user["_id"]), "platform": "zoom"}))
    assert integration is not None
    assert integration["status"] == "connected"
    assert integration["provider_metadata"]["zoom_user_email"] == "owner@zoom-example.com"
    assert integration["access_token_encrypted"] != "zoom-access"
    assert integration["refresh_token_encrypted"] is not None

    imported_event = asyncio.run(mock_db.calendar_events.find_one({"user_id": str(user["_id"]), "zoom_meeting_id": "999888777"}))
    assert imported_event is not None
    assert imported_event["title"] == "Imported From Zoom"
    assert imported_event["meeting_link"] == "https://zoom.us/j/999888777"
    assert any("zoom.us/oauth/token" in url for url, _auth in captured_post_calls)
    assert any("/users/me/meetings" in url for url in captured_get_urls)


def test_zoom_connected_calendar_event_crud_when_primary(client, mock_db, monkeypatch) -> None:
    email = "zoom-calendar-crud@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    grant_owner_role(mock_db, email)
    token = _login_token(client, email)

    monkeypatch.setattr(settings, "ZOOM_CLIENT_ID", "zoom-client-id")
    monkeypatch.setattr(settings, "ZOOM_CLIENT_SECRET", "zoom-secret")

    request_log: list[tuple[str, str]] = []

    async def fake_post(self, url, data=None, headers=None, params=None, json=None, auth=None, **kwargs):
        request_log.append(("POST", str(url)))
        request = httpx.Request("POST", str(url))
        if str(url).endswith("/meetings"):
            return httpx.Response(
                201,
                json={"id": 111222333, "join_url": "https://zoom.us/j/111222333", "start_url": "https://zoom.us/s/111222333"},
                request=request,
            )
        return httpx.Response(404, json={}, request=request)

    async def fake_patch(self, url, headers=None, params=None, json=None, **kwargs):
        request_log.append(("PATCH", str(url)))
        request = httpx.Request("PATCH", str(url))
        return httpx.Response(204, request=request)

    async def fake_get(self, url, headers=None, params=None, **kwargs):
        request_log.append(("GET", str(url)))
        request = httpx.Request("GET", str(url))
        return httpx.Response(
            200,
            json={"id": 111222333, "join_url": "https://zoom.us/j/111222333", "start_url": "https://zoom.us/s/111222333"},
            request=request,
        )

    async def fake_delete(self, url, headers=None, **kwargs):
        request_log.append(("DELETE", str(url)))
        request = httpx.Request("DELETE", str(url))
        return httpx.Response(204, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setattr(httpx.AsyncClient, "patch", fake_patch)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    monkeypatch.setattr(httpx.AsyncClient, "delete", fake_delete)

    user = asyncio.run(mock_db.users.find_one({"email": email}))
    from app.core.crypto import encrypt_value

    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": str(user["_id"]),
                "platform": "zoom",
                "status": "connected",
                "access_token_encrypted": encrypt_value("zoom-access"),
                "refresh_token_encrypted": encrypt_value("zoom-refresh"),
                "provider_metadata": {"integration_platform": "zoom"},
                "access_token_expires_at": datetime(2099, 1, 1),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        )
    )
    # Only Zoom connected -> it becomes primary via the legacy auto-priority fallback
    # (no explicit organizations.primary_calendar_provider set for this org yet).

    create_response = client.post(
        "/api/v1/smartflow/calendar/events",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Local To Zoom",
            "starts_at": "2099-10-30T10:00:00",
            "ends_at": "2099-10-30T11:00:00",
            "contact_ids": [],
            "meeting_mode": "online",
            "reminder_minutes": 10,
        },
    )
    assert create_response.status_code == 201
    event_id = create_response.json()["data"]["id"]
    assert create_response.json()["data"]["zoom_meeting_id"] == "111222333"
    assert create_response.json()["data"]["meeting_link"] == "https://zoom.us/j/111222333"

    update_response = client.patch(
        f"/api/v1/smartflow/calendar/events/{event_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Local To Zoom Updated"},
    )
    assert update_response.status_code == 200

    delete_response = client.delete(
        f"/api/v1/smartflow/calendar/events/{event_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_response.status_code == 200

    assert any(method == "POST" and url.endswith("/meetings") for method, url in request_log)
    assert any(method == "PATCH" and "111222333" in url for method, url in request_log)
    assert any(method == "DELETE" and "111222333" in url for method, url in request_log)
