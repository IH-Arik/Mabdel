from __future__ import annotations

import httpx
from urllib.parse import parse_qs, urlparse

from app.core.config import settings
from app.tests.test_auth import _register_user, _verify_signup_otp


def _login_and_get_token(client, email: str, password: str = "SecurePass2024!") -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["data"]["access_token"]


def test_calendar_connect_returns_oauth_url_when_not_connected(client, mock_db, monkeypatch) -> None:
    email = "oauth-calendar@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    token = _login_and_get_token(client, email)

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "google-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "google-secret")
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "http://127.0.0.1:8000/api/v1/smartflow/integrations/google_business/oauth/callback")

    response = client.post("/api/calendar/connect", json={}, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["connected"] is False
    assert "accounts.google.com" in payload["auth_url"]
    assert payload["state"]


def test_integrations_connect_returns_oauth_url_when_access_token_missing(client, mock_db, monkeypatch) -> None:
    email = "oauth-instagram@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    token = _login_and_get_token(client, email)

    monkeypatch.setattr(settings, "META_CLIENT_ID", "meta-client-id")
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", "meta-secret")
    monkeypatch.setattr(settings, "META_INSTAGRAM_REDIRECT_URI", "http://127.0.0.1:8000/api/v1/smartflow/integrations/instagram/oauth/callback")

    response = client.post(
        "/api/integrations/connect",
        json={"platform": "instagram"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["connected"] is False
    assert "facebook.com" in payload["auth_url"]
    assert payload["platform"] == "instagram"
    query = parse_qs(urlparse(payload["auth_url"]).query)
    assert query["redirect_uri"] == ["http://127.0.0.1:8000/api/v1/smartflow/integrations/instagram/oauth/callback"]


def test_twitter_oauth_url_uses_generated_pkce_challenge(client, mock_db, monkeypatch) -> None:
    email = "oauth-twitter@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    token = _login_and_get_token(client, email)

    monkeypatch.setattr(settings, "TWITTER_CLIENT_ID", "twitter-client-id")
    monkeypatch.setattr(settings, "TWITTER_CLIENT_SECRET", "twitter-secret")
    monkeypatch.setattr(settings, "TWITTER_REDIRECT_URI", "http://127.0.0.1:8000/api/v1/smartflow/integrations/twitter_x/oauth/callback")

    response = client.post(
        "/api/integrations/connect",
        json={"platform": "twitter_x"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()["data"]
    query = parse_qs(urlparse(payload["auth_url"]).query)
    assert payload["connected"] is False
    assert "twitter.com" in payload["auth_url"]
    assert query["redirect_uri"] == ["http://127.0.0.1:8000/api/v1/smartflow/integrations/twitter_x/oauth/callback"]
    assert query["code_challenge_method"] == ["S256"]
    assert query["code_challenge"][0]
    assert query["code_challenge"][0] != "challenge-not-configured"


def test_integration_catalog_returns_supported_platform_cards_with_status(client, mock_db, monkeypatch) -> None:
    email = "catalog@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    token = _login_and_get_token(client, email)

    monkeypatch.setattr(settings, "META_CLIENT_ID", "meta-client-id")
    monkeypatch.setattr(settings, "META_CLIENT_SECRET", "meta-secret")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "google-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "google-secret")
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_ID", "linkedin-client-id")
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_SECRET", "linkedin-secret")
    monkeypatch.setattr(settings, "TWITTER_CLIENT_ID", None)
    monkeypatch.setattr(settings, "TWITTER_CLIENT_SECRET", None)
    monkeypatch.setattr(settings, "SNAPCHAT_CLIENT_ID", None)
    monkeypatch.setattr(settings, "SNAPCHAT_CLIENT_SECRET", None)

    connect_response = client.post(
        "/api/v1/smartflow/integrations",
        json={"platform": "instagram", "access_token": "abc123", "external_account_id": "insta-account"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert connect_response.status_code == 201

    catalog_response = client.get(
        "/api/v1/smartflow/integrations/catalog",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert catalog_response.status_code == 200
    items = catalog_response.json()["data"]

    instagram = next(item for item in items if item["platform"] == "instagram")
    assert instagram["platform_label"] == "Instagram"
    assert instagram["connected"] is True
    assert instagram["cta_label"] == "Connected"
    assert instagram["health_status"] == "connected"
    assert instagram["sync_status"] == "idle"
    assert instagram["message_sync_enabled"] is True
    assert instagram["webhook_status"] == "configured"

    twitter = next(item for item in items if item["platform"] == "twitter_x")
    assert twitter["platform_label"] == "Twitter (X)"
    assert twitter["is_configured"] is False
    assert twitter["status"] == "misconfigured"
    assert twitter["cta_label"] == "Unavailable"

    snapchat = next(item for item in items if item["platform"] == "snapchat")
    assert snapchat["platform_label"] == "Snapchat"
    assert snapchat["is_configured"] is False
    assert snapchat["status"] == "misconfigured"
    assert snapchat["sync_status"] == "error"

    telegram = next(item for item in items if item["platform"] == "telegram")
    assert telegram["auth_mode"] == "manual"
    assert telegram["is_available"] is True
    assert telegram["cta_label"] == "Connect"


def test_integration_status_and_sync_report_provider_access_limits(client, mock_db, monkeypatch) -> None:
    email = "integration-status@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    token = _login_and_get_token(client, email)

    connect_response = client.post(
        "/api/v1/smartflow/integrations",
        json={"platform": "instagram", "access_token": "abc123", "external_account_id": "ig-page-1", "external_account_name": "Mabdel"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert connect_response.status_code == 201

    status_response = client.get("/api/v1/smartflow/integrations/status", headers={"Authorization": f"Bearer {token}"})
    assert status_response.status_code == 200
    status_payload = status_response.json()["data"]
    assert status_payload["summary"]["connected_count"] == 1
    instagram = next(item for item in status_payload["items"] if item["platform"] == "instagram")
    assert instagram["external_account_name"] == "Mabdel"

    sync_response = client.post("/api/v1/smartflow/integrations/instagram/sync", headers={"Authorization": f"Bearer {token}"})
    assert sync_response.status_code == 200
    sync_payload = sync_response.json()["data"]
    assert sync_payload["imported_count"] == 0
    assert sync_payload["sync_status"] == "needs_provider_access"


def test_snapchat_catalog_and_sync_require_allowlisted_provider_access(client, mock_db, monkeypatch) -> None:
    email = "snapchat-status@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    token = _login_and_get_token(client, email)

    monkeypatch.setattr(settings, "SNAPCHAT_CLIENT_ID", "snap-client-id")
    monkeypatch.setattr(settings, "SNAPCHAT_CLIENT_SECRET", "snap-secret")

    catalog_response = client.get("/api/v1/smartflow/integrations/catalog", headers={"Authorization": f"Bearer {token}"})
    assert catalog_response.status_code == 200
    snapchat = next(item for item in catalog_response.json()["data"] if item["platform"] == "snapchat")
    assert snapchat["platform_label"] == "Snapchat"
    assert snapchat["is_configured"] is True
    assert snapchat["cta_label"] == "Connect"

    connect_response = client.post(
        "/api/v1/smartflow/integrations",
        json={"platform": "snapchat", "access_token": "snap-token", "external_account_id": "profile-1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert connect_response.status_code == 201

    sync_response = client.post("/api/v1/smartflow/integrations/snapchat/sync", headers={"Authorization": f"Bearer {token}"})
    assert sync_response.status_code == 200
    payload = sync_response.json()["data"]
    assert payload["sync_status"] == "needs_provider_access"
    assert payload["imported_count"] == 0


def test_telegram_manual_connect_registers_webhook_and_stores_secret(client, mock_db, monkeypatch) -> None:
    email = "telegram-manual@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    token = _login_and_get_token(client, email)

    monkeypatch.setattr(settings, "PUBLIC_BACKEND_URL", "https://api.example.com")

    captured: dict[str, object] = {}

    async def fake_post(self, url, data=None, headers=None, **kwargs):
        captured["url"] = url
        captured["data"] = data
        captured["headers"] = headers
        request = httpx.Request("POST", str(url))
        return httpx.Response(200, json={"ok": True, "result": True}, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    response = client.post(
        "/api/v1/smartflow/integrations/telegram/manual-connect",
        json={
            "bot_token": "123456:ABCDEF_bot_token",
            "bot_username": "mabdel_bot",
            "secret_token": "telegram-secret",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    payload = response.json()["data"]

    assert payload["platform"] == "telegram"
    assert payload["connected"] is True
    assert payload["secret_token"] == "telegram-secret"
    assert payload["webhook_url"] == "https://api.example.com/api/v1/smartflow/integrations/telegram/webhook"
    assert payload["integration"]["platform"] == "telegram"
    assert payload["integration"]["connected"] is True
    assert captured["url"] == "https://api.telegram.org/bot123456:ABCDEF_bot_token/setWebhook"
    assert captured["data"]["secret_token"] == "telegram-secret"
