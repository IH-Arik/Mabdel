from __future__ import annotations

import asyncio
from datetime import datetime

import httpx

from app.core.config import settings
from app.core.crypto import encrypt_value
from app.services.email_domain.email_domain_service import EmailDomainService
from app.services.email_domain.microsoft_mail_service import MicrosoftMailService
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


async def _connect_microsoft(mock_db, user_id: str, *, email: str = "hello@clientdomain.com") -> None:
    await mock_db.social_integrations.insert_one(
        {
            "user_id": user_id,
            "platform": "microsoft",
            "status": "connected",
            "access_token_encrypted": encrypt_value("microsoft-access"),
            "refresh_token_encrypted": encrypt_value("microsoft-refresh"),
            "provider_metadata": {"email": email, "display_name": "Client Business"},
            "access_token_expires_at": datetime(2099, 1, 1),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
    )


def test_microsoft_oauth_callback_uses_body_auth_and_stores_account(client, mock_db, monkeypatch) -> None:
    email = "microsoft-mail@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    grant_owner_role(mock_db, email)
    token = _login_token(client, email)

    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_ID", "microsoft-client-id")
    monkeypatch.setattr(settings, "MICROSOFT_CLIENT_SECRET", "microsoft-secret")
    monkeypatch.setattr(
        settings, "MICROSOFT_REDIRECT_URI", "http://127.0.0.1:8000/api/v1/smartflow/integrations/microsoft/oauth/callback"
    )

    captured_post_calls: list[tuple[str, dict, object]] = []
    captured_get_urls: list[str] = []

    async def fake_post(self, url, data=None, headers=None, params=None, json=None, auth=None, **kwargs):
        captured_post_calls.append((str(url), data or {}, auth))
        request = httpx.Request("POST", str(url))
        if "login.microsoftonline.com" in str(url) and "/oauth2/v2.0/token" in str(url):
            # Unlike Zoom, Microsoft's token exchange takes credentials in the
            # body, not an HTTP Basic Auth header.
            assert auth is None
            assert data.get("client_id") == "microsoft-client-id"
            assert data.get("client_secret") == "microsoft-secret"
            # "organizations", not a specific tenant — multi-tenant SaaS, any
            # customer's own Microsoft 365 org can connect.
            assert "/organizations/" in str(url)
            return httpx.Response(
                200,
                json={
                    "access_token": "microsoft-access",
                    "refresh_token": "microsoft-refresh",
                    "expires_in": 3600,
                    "scope": "Mail.Send Calendars.ReadWrite",
                },
                request=request,
            )
        return httpx.Response(404, json={}, request=request)

    async def fake_get(self, url, headers=None, params=None, **kwargs):
        captured_get_urls.append(str(url))
        request = httpx.Request("GET", str(url))
        if str(url) == "https://graph.microsoft.com/v1.0/me":
            return httpx.Response(
                200,
                json={"mail": "owner@clientdomain.com", "userPrincipalName": "owner@clientdomain.onmicrosoft.com", "displayName": "Client Business"},
                request=request,
            )
        if str(url).startswith("https://graph.microsoft.com/v1.0/me/events"):
            # Connecting Microsoft also connects Outlook Calendar sync (one shared
            # integration record) — the OAuth completion triggers an initial sync.
            return httpx.Response(200, json={"value": []}, request=request)
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

    integration = asyncio.run(mock_db.social_integrations.find_one({"user_id": str(user["_id"]), "platform": "microsoft"}))
    assert integration is not None
    assert integration["status"] == "connected"
    assert integration["provider_metadata"]["email"] == "owner@clientdomain.com"
    assert integration["access_token_encrypted"] != "microsoft-access"
    assert integration["refresh_token_encrypted"] is not None
    assert any("/oauth2/v2.0/token" in url for url, _data, _auth in captured_post_calls)
    assert any(url == "https://graph.microsoft.com/v1.0/me" for url in captured_get_urls)


def test_resolve_sender_prefers_connected_microsoft_over_resend_domain(mock_db) -> None:
    async def _run():
        user = await mock_db.users.insert_one({"organization_id": "org-microsoft-1"})
        user_id = str(user.inserted_id)
        await mock_db.email_domains.insert_one(
            {
                "user_id": user_id,
                "organization_id": "org-microsoft-1",
                "domain": "acme.gocustify.com",
                "status": "verified",
                "default_prefix": "hello",
                "from_name": "Resend Sender",
            }
        )
        await _connect_microsoft(mock_db, user_id, email="hello@clientdomain.com")
        return await EmailDomainService(mock_db).resolve_sender(user_id)

    sender = asyncio.run(_run())
    assert sender["provider"] == "microsoft"
    assert sender["email"] == "hello@clientdomain.com"


def test_resolve_sender_falls_back_to_resend_domain_without_microsoft(mock_db) -> None:
    async def _run():
        user = await mock_db.users.insert_one({"organization_id": "org-microsoft-2"})
        user_id = str(user.inserted_id)
        await mock_db.email_domains.insert_one(
            {
                "user_id": user_id,
                "organization_id": "org-microsoft-2",
                "domain": "acme.gocustify.com",
                "status": "verified",
                "default_prefix": "hello",
                "from_name": "Resend Sender",
            }
        )
        return await EmailDomainService(mock_db).resolve_sender(user_id)

    sender = asyncio.run(_run())
    assert "provider" not in sender
    assert sender["email"] == "hello@acme.gocustify.com"


def test_resolve_sender_prefers_most_recently_connected_between_zoho_and_microsoft(mock_db) -> None:
    async def _run():
        user = await mock_db.users.insert_one({"organization_id": "org-microsoft-3"})
        user_id = str(user.inserted_id)
        await mock_db.social_integrations.insert_one(
            {
                "user_id": user_id,
                "platform": "zoho",
                "status": "connected",
                "access_token_encrypted": encrypt_value("zoho-access"),
                "refresh_token_encrypted": encrypt_value("zoho-refresh"),
                "provider_metadata": {"account_id": "acc-1", "email": "zoho@clientdomain.com", "display_name": "Zoho Business"},
                "access_token_expires_at": datetime(2099, 1, 1),
                "connected_at": datetime(2024, 1, 1),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        )
        await mock_db.social_integrations.insert_one(
            {
                "user_id": user_id,
                "platform": "microsoft",
                "status": "connected",
                "access_token_encrypted": encrypt_value("microsoft-access"),
                "refresh_token_encrypted": encrypt_value("microsoft-refresh"),
                "provider_metadata": {"email": "microsoft@clientdomain.com", "display_name": "Microsoft Business"},
                "access_token_expires_at": datetime(2099, 1, 1),
                "connected_at": datetime(2024, 6, 1),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        )
        return await EmailDomainService(mock_db).resolve_sender(user_id)

    sender = asyncio.run(_run())
    assert sender["provider"] == "microsoft"
    assert sender["email"] == "microsoft@clientdomain.com"


def test_microsoft_send_email_posts_to_send_mail_endpoint(mock_db, monkeypatch) -> None:
    captured = {}

    async def fake_post(self, url, data=None, headers=None, params=None, json=None, **kwargs):
        captured["url"] = str(url)
        captured["json"] = json
        captured["headers"] = headers
        request = httpx.Request("POST", str(url))
        return httpx.Response(202, request=request)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    async def _run():
        user = await mock_db.users.insert_one({"organization_id": "org-microsoft-4"})
        user_id = str(user.inserted_id)
        await _connect_microsoft(mock_db, user_id, email="hello@clientdomain.com")
        sent = await MicrosoftMailService(mock_db).send_email(
            user_id, to="lead@example.com", subject="Hi there", html="<p>Hello</p>", text="Hello"
        )
        return sent

    sent = asyncio.run(_run())
    assert sent is True
    assert captured["url"] == "https://graph.microsoft.com/v1.0/me/sendMail"
    assert captured["json"]["message"]["toRecipients"][0]["emailAddress"]["address"] == "lead@example.com"
    assert captured["json"]["saveToSentItems"] is True
    assert captured["headers"]["Authorization"] == "Bearer microsoft-access"


def test_microsoft_send_email_returns_false_when_not_connected(mock_db) -> None:
    async def _run():
        user = await mock_db.users.insert_one({"organization_id": "org-microsoft-5"})
        return await MicrosoftMailService(mock_db).send_email(
            str(user.inserted_id), to="lead@example.com", subject="Hi", html="<p>Hi</p>"
        )

    assert asyncio.run(_run()) is False


def test_email_service_routes_through_microsoft_when_sender_provider_is_microsoft(mock_db, monkeypatch) -> None:
    """The actual wiring point bulk messaging calls — sender_provider='microsoft' must
    skip Resend/SMTP entirely and go through MicrosoftMailService instead."""
    from app.services.email_service import EmailService

    captured = {}

    async def fake_send_email(self, user_id, *, to, subject, html, text=None, reply_to=None):
        captured["user_id"] = user_id
        captured["to"] = to
        captured["subject"] = subject
        return True

    monkeypatch.setattr(MicrosoftMailService, "send_email", fake_send_email)

    def fail_if_called(*args, **kwargs):
        raise AssertionError("Resend/SMTP path must not run when sender_provider='microsoft'")

    monkeypatch.setattr(EmailService, "_send_email", fail_if_called)

    asyncio.run(
        EmailService().send_business_email(
            email="lead@example.com",
            subject="Following up",
            text="Hello",
            html="<p>Hello</p>",
            from_email="hello@clientdomain.com",
            sender_provider="microsoft",
            sender_user_id="000000000000000000000099",
            db=mock_db,
        )
    )
    assert captured["user_id"] == "000000000000000000000099"
    assert captured["to"] == "lead@example.com"
    assert captured["subject"] == "Following up"
