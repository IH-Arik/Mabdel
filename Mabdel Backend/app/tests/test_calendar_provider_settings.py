from __future__ import annotations

import asyncio
from datetime import datetime

import httpx

from app.core.config import settings
from app.core.crypto import encrypt_value
from app.tests.conftest import grant_owner_role
from app.tests.test_auth import _register_user, _verify_signup_otp


def _login_token(client, email: str, password: str = "SecurePass2024!") -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["data"]["access_token"]


def _self_reference_organization(mock_db, email: str) -> None:
    """Registration alone doesn't self-reference organization_id in tests (see
    test_ai_call_scheduling.py's _owner_with_org) — set_primary_calendar_provider
    requires one, same precedent as update_business_hours."""

    async def _run() -> None:
        user = await mock_db.users.find_one({"email": email})
        await mock_db.users.update_one({"_id": user["_id"]}, {"$set": {"organization_id": str(user["_id"])}})

    asyncio.run(_run())


def _connect_zoom(mock_db, user_id: str) -> None:
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": user_id,
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


def _connect_google(mock_db, user_id: str) -> None:
    asyncio.run(
        mock_db.social_integrations.insert_one(
            {
                "user_id": user_id,
                "platform": "google_business",
                "status": "connected",
                "access_token_encrypted": encrypt_value("google-access"),
                "refresh_token_encrypted": encrypt_value("google-refresh"),
                "provider_metadata": {"default_calendar_id": "primary", "integration_platform": "google_business"},
                "access_token_expires_at": datetime(2099, 1, 1),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        )
    )


def test_provider_settings_default_to_legacy_auto_priority(client, mock_db, monkeypatch) -> None:
    email = "provider-default@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    grant_owner_role(mock_db, email)
    _self_reference_organization(mock_db, email)
    token = _login_token(client, email)
    user = asyncio.run(mock_db.users.find_one({"email": email}))

    _connect_google(mock_db, str(user["_id"]))
    _connect_zoom(mock_db, str(user["_id"]))

    # Nobody has explicitly chosen a primary yet -> legacy auto-priority applies:
    # CalDAV > Google > Zoom. Only Google+Zoom connected here, so Google wins.
    response = client.get("/api/v1/smartflow/calendar/provider-settings", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["primary_calendar_provider"] == "google_business"
    assert data["connected"] == {"caldav": False, "google_business": True, "zoom": True}


def test_user_can_manually_override_primary_provider(client, mock_db, monkeypatch) -> None:
    email = "provider-manual@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    grant_owner_role(mock_db, email)
    _self_reference_organization(mock_db, email)
    token = _login_token(client, email)
    user = asyncio.run(mock_db.users.find_one({"email": email}))

    _connect_google(mock_db, str(user["_id"]))
    _connect_zoom(mock_db, str(user["_id"]))

    set_response = client.put(
        "/api/v1/smartflow/calendar/provider-settings",
        headers={"Authorization": f"Bearer {token}"},
        json={"provider": "zoom"},
    )
    assert set_response.status_code == 200
    assert set_response.json()["data"]["primary_calendar_provider"] == "zoom"

    get_response = client.get("/api/v1/smartflow/calendar/provider-settings", headers={"Authorization": f"Bearer {token}"})
    assert get_response.json()["data"]["primary_calendar_provider"] == "zoom"


def test_explicit_choice_falls_back_when_that_provider_disconnects(client, mock_db, monkeypatch) -> None:
    email = "provider-fallback@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    grant_owner_role(mock_db, email)
    _self_reference_organization(mock_db, email)
    token = _login_token(client, email)
    user = asyncio.run(mock_db.users.find_one({"email": email}))

    _connect_google(mock_db, str(user["_id"]))
    _connect_zoom(mock_db, str(user["_id"]))

    client.put(
        "/api/v1/smartflow/calendar/provider-settings",
        headers={"Authorization": f"Bearer {token}"},
        json={"provider": "zoom"},
    )
    # Zoom disconnects (status no longer "connected") -> the explicit choice is no
    # longer honorable, so it must fall back to the legacy auto-priority instead of
    # reporting a primary provider that isn't actually usable.
    asyncio.run(
        mock_db.social_integrations.update_one(
            {"user_id": str(user["_id"]), "platform": "zoom"},
            {"$set": {"status": "disconnected"}},
        )
    )
    response = client.get("/api/v1/smartflow/calendar/provider-settings", headers={"Authorization": f"Bearer {token}"})
    data = response.json()["data"]
    assert data["primary_calendar_provider"] == "google_business"
    assert data["connected"]["zoom"] is False


def test_invalid_provider_rejected(client, mock_db, monkeypatch) -> None:
    email = "provider-invalid@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    grant_owner_role(mock_db, email)
    _self_reference_organization(mock_db, email)
    token = _login_token(client, email)

    response = client.put(
        "/api/v1/smartflow/calendar/provider-settings",
        headers={"Authorization": f"Bearer {token}"},
        json={"provider": "microsoft_outlook"},
    )
    assert response.status_code == 422


def test_non_primary_zoom_still_mints_real_meeting_link(client, mock_db, monkeypatch) -> None:
    """Google is explicitly chosen as primary; Zoom is also connected but not primary
    — it should still be usable purely to generate a real meeting link (same
    precedent as Google previously acting as meet-link-only when CalDAV was
    primary), rather than falling back to a local placeholder link."""
    email = "provider-link-only@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)
    grant_owner_role(mock_db, email)
    _self_reference_organization(mock_db, email)
    token = _login_token(client, email)
    user = asyncio.run(mock_db.users.find_one({"email": email}))

    _connect_google(mock_db, str(user["_id"]))
    _connect_zoom(mock_db, str(user["_id"]))
    # CalDAV connected directly at the data layer (its real connect() flow does live
    # CalDAV server discovery over HTTP, out of scope here) so it wins the legacy
    # CalDAV > Google > Zoom auto-priority, leaving both Google and Zoom
    # connected-but-not-primary — exactly the tie-break this test targets.
    asyncio.run(
        mock_db.caldav_connections.insert_one(
            {"user_id": str(user["_id"]), "status": "connected", "provider": "icloud", "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()}
        )
    )
    # push_event itself does live CalDAV server HTTP calls (PUT to the connection's
    # discovered calendar_url) — out of scope for this test, which only cares about
    # the meet-link tie-break, so stub it out to a no-network no-op success.
    from app.services.smartflow.caldav_service import CalDAVService

    async def fake_push_event(self, user_id, event):
        return "fake-caldav-uid-1"

    monkeypatch.setattr(CalDAVService, "push_event", fake_push_event)

    async def fake_post(self, url, data=None, headers=None, params=None, json=None, auth=None, **kwargs):
        request = httpx.Request("POST", str(url))
        if str(url).endswith("/meetings"):
            return httpx.Response(
                201,
                json={"id": 555666777, "join_url": "https://zoom.us/j/555666777", "start_url": "https://zoom.us/s/555666777"},
                request=request,
            )
        # Google create_remote_event must NOT be called — Zoom should win the
        # link-mint tie-break when both are connected-but-not-primary.
        raise AssertionError(f"unexpected POST to {url}")

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    create_response = client.post(
        "/api/v1/smartflow/calendar/events",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Needs A Real Link",
            "starts_at": "2099-10-30T10:00:00",
            "ends_at": "2099-10-30T11:00:00",
            "contact_ids": [],
            "meeting_mode": "online",
            "reminder_minutes": 10,
        },
    )
    assert create_response.status_code == 201
    data = create_response.json()["data"]
    assert data["meeting_link"] == "https://zoom.us/j/555666777"
    # Not the primary provider, so no zoom_meeting_id/google_event_id gets stored —
    # only the minted link is kept, matching the pre-existing Google meet-link-only precedent.
    assert data["zoom_meeting_id"] is None
    assert data["google_event_id"] is None
