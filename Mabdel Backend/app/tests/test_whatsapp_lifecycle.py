from __future__ import annotations

import asyncio
from types import SimpleNamespace

import httpx
from bson import ObjectId

from app.core.database import MongoConnectionManager
from app.core.security import create_access_token, hash_password
from app.services.smartflow.integration_service import IntegrationService
from app.tests.conftest import grant_owner_role

ORG_ID = "617a2b64-4045-4e10-921b-a305a922b579"


async def _create_member(mock_db, email: str, org_id: str = ORG_ID) -> str:
    result = await mock_db.users.insert_one(
        {
            "full_name": email.split("@")[0],
            "email": email,
            "password_hash": hash_password("SecurePass2024!"),
            "is_verified": True,
            "auth_provider": "email",
            "organization_id": org_id,
        }
    )
    return str(result.inserted_id)


def _headers(user_id: str, email: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id, email)}"}


def _fake_gateway(monkeypatch, *, status="pending_qr", down=False):
    calls = {"get": 0, "post": []}

    async def fake_post(self, url, json=None, headers=None, **kwargs):
        if down:
            raise httpx.ConnectError("gateway unreachable at http://whatsapp-gateway:3001")
        calls["post"].append(str(url))
        return httpx.Response(200, json={"status": status, "qr_data_url": "data:image/png;base64,AAA", "linked_number": None}, request=httpx.Request("POST", str(url)))

    async def fake_get(self, url, headers=None, **kwargs):
        if down:
            raise httpx.ConnectError("gateway unreachable at http://whatsapp-gateway:3001")
        calls["get"] += 1
        return httpx.Response(200, json={"status": status, "qr_data_url": None, "linked_number": "8801700000000"}, request=httpx.Request("GET", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    return calls


def _whatsapp_docs(mock_db):
    return asyncio.run(mock_db.social_integrations.find({"platform": "whatsapp"}).to_list(None))


def test_switching_from_official_api_to_qr_reuses_the_single_row(client, mock_db, monkeypatch):
    """The official-API row has no organization_id, so a naive QR upsert inserted a second
    row for the same (user_id, platform) and blew up on the unique index (500)."""
    asyncio.run(MongoConnectionManager.ensure_indexes(SimpleNamespace(database=mock_db)))
    owner_id = asyncio.run(_create_member(mock_db, "wa-switch-owner@example.com"))
    grant_owner_role(mock_db, "wa-switch-owner@example.com")
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {"user_id": owner_id, "platform": "whatsapp", "status": "connected", "access_token_encrypted": "enc", "external_account_id": "phone-id"}
        )
    )
    _fake_gateway(monkeypatch)

    response = client.post("/api/v1/smartflow/integrations/whatsapp/connect", headers=_headers(owner_id, "wa-switch-owner@example.com"))

    assert response.status_code == 201, response.text
    docs = _whatsapp_docs(mock_db)
    assert len(docs) == 1
    assert docs[0]["user_id"] == owner_id
    assert docs[0]["organization_id"] == ORG_ID
    assert docs[0]["whatsapp_secret_token"]
    assert docs[0]["access_token_encrypted"] is None
    assert docs[0]["status"] == "pending_qr"


def test_switching_from_qr_to_official_api_keeps_the_new_connection_connected(mock_db, monkeypatch):
    """After the official API connects, retiring the QR session used to look the row up by
    organization_id, find the row that was JUST connected, and disconnect it."""
    owner_id = asyncio.run(_create_member(mock_db, "wa-switch-back@example.com"))
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": owner_id,
                "organization_id": ORG_ID,
                "platform": "whatsapp",
                "status": "connected",
                "whatsapp_secret_token": "qr-secret",
                "external_account_id": "8801700000000",
            }
        )
    )
    calls = _fake_gateway(monkeypatch)
    service = IntegrationService(mock_db)

    integration = asyncio.run(
        service.upsert_integration(owner_id, {"platform": "whatsapp", "access_token": "meta-token", "external_account_id": "phone-id"})
    )
    asyncio.run(service._retire_whatsapp_qr_for_official_api(ObjectId(integration["id"]), owner_id))

    docs = _whatsapp_docs(mock_db)
    assert len(docs) == 1
    assert docs[0]["status"] == "connected"
    assert "whatsapp_secret_token" not in docs[0]
    assert "organization_id" not in docs[0]
    assert docs[0]["access_token_encrypted"]
    assert any(url.endswith(f"/sessions/{ORG_ID}/disconnect") for url in calls["post"])


def test_teammate_can_disconnect_a_connection_someone_else_made(client, mock_db):
    owner_id = asyncio.run(_create_member(mock_db, "wa-team-owner@example.com"))
    teammate_id = asyncio.run(_create_member(mock_db, "wa-team-mate@example.com"))
    grant_owner_role(mock_db, "wa-team-mate@example.com")
    asyncio.run(
        mock_db.social_integrations.insert_one({"user_id": owner_id, "platform": "telegram", "status": "connected", "access_token_encrypted": "enc"})
    )

    response = client.delete("/api/v1/smartflow/integrations/telegram", headers=_headers(teammate_id, "wa-team-mate@example.com"))

    assert response.status_code == 200, response.text
    stored = asyncio.run(mock_db.social_integrations.find_one({"platform": "telegram"}))
    assert stored["status"] == "disconnected"
    assert stored["access_token_encrypted"] is None


def test_disconnect_is_still_scoped_to_the_organization(client, mock_db):
    owner_id = asyncio.run(_create_member(mock_db, "wa-scope-owner@example.com"))
    outsider_id = asyncio.run(_create_member(mock_db, "wa-scope-outsider@example.com", org_id="another-org"))
    grant_owner_role(mock_db, "wa-scope-outsider@example.com")
    asyncio.run(mock_db.social_integrations.insert_one({"user_id": owner_id, "platform": "telegram", "status": "connected"}))

    response = client.delete("/api/v1/smartflow/integrations/telegram", headers=_headers(outsider_id, "wa-scope-outsider@example.com"))

    assert response.status_code == 404
    assert asyncio.run(mock_db.social_integrations.find_one({"platform": "telegram"}))["status"] == "connected"


def test_gateway_down_returns_503_without_leaking_the_internal_url(client, mock_db, monkeypatch):
    owner_id = asyncio.run(_create_member(mock_db, "wa-down-owner@example.com"))
    grant_owner_role(mock_db, "wa-down-owner@example.com")
    _fake_gateway(monkeypatch, down=True)
    headers = _headers(owner_id, "wa-down-owner@example.com")

    for response in (
        client.post("/api/v1/smartflow/integrations/whatsapp/connect", headers=headers),
        client.get("/api/v1/smartflow/integrations/whatsapp/qr", headers=headers),
    ):
        assert response.status_code == 503, response.text
        assert response.json()["error"]["code"] == "WHATSAPP_GATEWAY_UNREACHABLE"
        assert "whatsapp-gateway" not in response.text


def test_catalog_does_not_hit_the_gateway_on_every_load(client, mock_db, monkeypatch):
    owner_id = asyncio.run(_create_member(mock_db, "wa-throttle-owner@example.com"))
    grant_owner_role(mock_db, "wa-throttle-owner@example.com")
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {"user_id": owner_id, "organization_id": ORG_ID, "platform": "whatsapp", "status": "connected", "whatsapp_secret_token": "s"}
        )
    )
    calls = _fake_gateway(monkeypatch, status="connected")
    headers = _headers(owner_id, "wa-throttle-owner@example.com")

    for _ in range(4):
        assert client.get("/api/v1/smartflow/integrations/catalog", headers=headers).status_code == 200

    assert calls["get"] == 1


# ── OAuth start/callback hardening ─────────────────────────────────────────


def _linkedin_configured(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_ID", "cid")
    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_SECRET", "csecret")


def test_oauth_start_rejects_unknown_and_unconfigured_platforms(client, mock_db, monkeypatch):
    from app.core.config import settings

    user_id = asyncio.run(_create_member(mock_db, "oauth-start@example.com"))
    grant_owner_role(mock_db, "oauth-start@example.com")
    headers = _headers(user_id, "oauth-start@example.com")

    unknown = client.get("/api/v1/smartflow/integrations/not-a-platform/oauth/start", headers=headers)
    assert unknown.status_code == 400
    assert unknown.json()["error"]["code"] == "INTEGRATION_UNSUPPORTED"

    monkeypatch.setattr(settings, "LINKEDIN_CLIENT_ID", None)
    unconfigured = client.get("/api/v1/smartflow/integrations/linkedin/oauth/start", headers=headers)
    assert unconfigured.status_code == 503
    assert unconfigured.json()["error"]["code"] == "INTEGRATION_NOT_CONFIGURED"


def test_oauth_start_requires_the_manage_permission(client, mock_db, monkeypatch):
    _linkedin_configured(monkeypatch)
    user_id = asyncio.run(_create_member(mock_db, "oauth-noperm@example.com"))  # no role granted

    response = client.get("/api/v1/smartflow/integrations/linkedin/oauth/start", headers=_headers(user_id, "oauth-noperm@example.com"))

    assert response.status_code == 403


def test_catalog_requires_the_view_permission(client, mock_db):
    user_id = asyncio.run(_create_member(mock_db, "catalog-noperm@example.com"))

    response = client.get("/api/v1/smartflow/integrations/catalog", headers=_headers(user_id, "catalog-noperm@example.com"))

    assert response.status_code == 403


def test_oauth_state_is_single_use_even_when_the_token_exchange_fails(client, mock_db, monkeypatch):
    from datetime import datetime, timedelta

    _linkedin_configured(monkeypatch)
    user_id = asyncio.run(_create_member(mock_db, "oauth-replay@example.com"))
    asyncio.run(
        mock_db.oauth_states.insert_one(
            {"state": "state-1", "user_id": user_id, "platform": "linkedin", "provider": "linkedin", "expires_at": datetime.utcnow() + timedelta(minutes=5)}
        )
    )

    async def failing_post(self, url, data=None, **kwargs):
        return httpx.Response(400, text="invalid_grant secret-provider-detail", request=httpx.Request("POST", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "post", failing_post)
    url = "/api/v1/smartflow/integrations/linkedin/oauth/callback?code=abc&state=state-1"

    first = client.get(url)
    assert first.status_code == 502
    assert first.json()["error"]["code"] == "OAUTH_TOKEN_EXCHANGE_FAILED"
    assert "secret-provider-detail" not in first.text

    replay = client.get(url)
    assert replay.status_code == 400
    assert replay.json()["error"]["code"] == "OAUTH_STATE_INVALID"


def test_oauth_callback_rejects_an_expired_state(client, mock_db, monkeypatch):
    from datetime import datetime, timedelta

    _linkedin_configured(monkeypatch)
    user_id = asyncio.run(_create_member(mock_db, "oauth-expired@example.com"))
    asyncio.run(
        mock_db.oauth_states.insert_one(
            {"state": "old-state", "user_id": user_id, "platform": "linkedin", "provider": "linkedin", "expires_at": datetime.utcnow() - timedelta(minutes=1)}
        )
    )

    response = client.get("/api/v1/smartflow/integrations/linkedin/oauth/callback?code=abc&state=old-state")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "OAUTH_STATE_INVALID"
