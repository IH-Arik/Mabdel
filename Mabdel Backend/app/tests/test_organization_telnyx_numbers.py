from __future__ import annotations

import asyncio

from app.core.config import settings
from app.services.call_service import CallService
from app.services.telnyx_provisioning_service import TelnyxProvisioningService
from app.tests.conftest import grant_role


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _register_and_login(client, mock_db, email: str, role_slug: str) -> tuple[dict[str, str], str]:
    """Registers a fresh self-signup user (their own organization) and grants a role.
    Returns (auth_headers, user_id). The test-harness /auth/register endpoint doesn't
    self-reference organization_id the way the real owner-signup flow does, so that's
    set here to match production owner behavior (see auth_routes.py's other signup path)."""
    register = client.post(
        "/api/v1/auth/register",
        json={"full_name": f"{role_slug.title()} User", "email": email, "password": "SecurePass2024!"},
    )
    assert register.status_code == 201
    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify = client.post("/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"})
    assert verify.status_code == 200
    grant_role(mock_db, email, role_slug)

    async def _self_reference_org():
        user = await mock_db.users.find_one({"email": email})
        # grant_role only writes the RBAC assignment collection; the org-owner lookup
        # in calls.py checks the users.role/primary_role fields directly (same
        # convention as _resolve_global_chat_owner), so those need setting too here.
        await mock_db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"organization_id": str(user["_id"]), "role": role_slug, "primary_role": role_slug}},
        )
        return str(user["_id"])

    user_id = asyncio.run(_self_reference_org())

    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login.status_code == 200
    data = login.json()["data"]
    return {"Authorization": f"Bearer {data['access_token']}"}, user_id


def _add_team_member_to_org(mock_db, organization_id: str, email: str, role_slug: str) -> str:
    """Directly inserts a second user into the SAME organization as an existing owner,
    bypassing the full create-subordinate flow (not what's under test here)."""
    from datetime import datetime, timezone

    async def _create():
        result = await mock_db.users.insert_one(
            {
                "full_name": f"{role_slug.title()} Teammate",
                "email": email,
                "password_hash": "x",
                "is_verified": True,
                "organization_id": organization_id,
                "role": role_slug,
                "primary_role": role_slug,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        return str(result.inserted_id)

    user_id = asyncio.run(_create())
    grant_role(mock_db, email, role_slug)
    return user_id


class FakeTelephonyClient:
    """Stands in for telnyx.Client during provisioning tests — no real API calls."""

    class _AvailableNumbers:
        def list(self, filter):
            Num = type("N", (), {"phone_number": "+15550001234"})
            Data = type("D", (), {"data": [Num()]})
            return Data()

    class _NumberOrders:
        def create(self, **kwargs):
            OrderedNumber = type("ON", (), {"id": "num_ordered_1"})
            OrderData = type("OD", (), {"id": "order_1", "status": "success", "phone_numbers": [OrderedNumber()]})
            Order = type("O", (), {"data": OrderData()})
            return Order()

        def retrieve(self, order_id):
            raise AssertionError("should not poll when status is already 'success'")

    def __init__(self, *args, **kwargs):
        self.available_phone_numbers = self._AvailableNumbers()
        self.number_orders = self._NumberOrders()


def test_provisioning_requires_calls_manage_permission(client, mock_db, monkeypatch):
    """Staff (no calls:manage by default) cannot provision the org's number."""
    monkeypatch.setattr(settings, "TELNYX_API_KEY", "test-key")
    headers, _ = _register_and_login(client, mock_db, "staff-provision@example.com", "staff")

    response = client.post("/api/v1/telnyx/provision", headers=headers)
    assert response.status_code == 403


def test_owner_can_provision_organization_number(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "TELNYX_API_KEY", "test-key")
    monkeypatch.setattr(settings, "TELNYX_NUMBER_COUNTRY", "US")

    import app.services.telnyx_provisioning_service as module

    monkeypatch.setattr(module, "telnyx", type("T", (), {"Client": FakeTelephonyClient, "TelnyxError": Exception, "NOT_GIVEN": None}))

    headers, owner_id = _register_and_login(client, mock_db, "owner-provision@example.com", "owner")

    response = client.post("/api/v1/telnyx/provision", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["telnyx_phone_number"] == "+15550001234"
    assert data["telnyx_setup_status"] == "active"

    org = asyncio.run(mock_db.organizations.find_one({"organization_id": owner_id}))
    assert org is not None
    assert org["telnyx_phone_number"] == "+15550001234"

    # Status is readable by anyone with calls:view (everyone, including staff).
    status_response = client.get("/api/v1/telnyx/status", headers=headers)
    assert status_response.status_code == 200
    assert status_response.json()["data"]["telnyx_phone_number"] == "+15550001234"


def test_manager_without_explicit_grant_cannot_manage_number(client, mock_db, monkeypatch):
    """Only owner has calls:manage by default (confirmed against the RBAC seed data) —
    manager does NOT automatically get it. 'Owner + assigned member' means the owner
    grants it explicitly per person, not that every manager gets it for free."""
    monkeypatch.setattr(settings, "TELNYX_API_KEY", "test-key")
    owner_headers, owner_id = _register_and_login(client, mock_db, "owner-mgr-block@example.com", "owner")
    manager_headers = _login_team_member(client, mock_db, owner_id, "manager-mgr-block@example.com", "manager")

    response = client.post("/api/v1/telnyx/provision", headers=manager_headers)
    assert response.status_code == 403


def test_owner_can_assign_calls_manage_to_a_specific_staff_member(client, mock_db, monkeypatch):
    """The RBAC mechanism the owner uses to say 'this specific person can use the
    business number': create a custom role that includes calls:manage and assign it
    to just that one person, via the platform's existing custom-role system."""
    monkeypatch.setattr(settings, "TELNYX_API_KEY", "test-key")
    import app.services.telnyx_provisioning_service as module

    monkeypatch.setattr(module, "telnyx", type("T", (), {"Client": FakeTelephonyClient, "TelnyxError": Exception, "NOT_GIVEN": None}))

    owner_headers, owner_id = _register_and_login(client, mock_db, "owner-assign-test@example.com", "owner")
    staff_user_id = _add_team_member_to_org(mock_db, owner_id, "staff-assign-test@example.com", "staff")

    async def _grant_custom_calls_manage():
        calls_manage_perm = await mock_db.rbac_permissions.find_one({"module": "calls", "action": "manage"})
        assert calls_manage_perm is not None
        role_result = await mock_db.rbac_roles.insert_one(
            {
                "slug": "front-desk-caller",
                "name": "Front Desk Caller",
                "is_system": False,
                "is_active": True,
                "hierarchy_level": 15,
                "permission_ids": [str(calls_manage_perm["_id"])],
            }
        )
        await mock_db.rbac_user_roles.insert_one(
            {
                "user_id": staff_user_id,
                "role_id": str(role_result.inserted_id),
                "role_slug": "front-desk-caller",
                "organization_id": owner_id,
                "assigned_by": owner_id,
                "assigned_at": None,
                "expires_at": None,
            }
        )

    asyncio.run(_grant_custom_calls_manage())

    from app.core.security import create_access_token

    token = create_access_token(staff_user_id, "staff-assign-test@example.com")
    staff_headers = {"Authorization": f"Bearer {token}"}

    response = client.post("/api/v1/telnyx/provision", headers=staff_headers)
    assert response.status_code == 200, response.text

    # The owner sees the SAME org number the specifically-assigned staff member provisioned.
    owner_status = client.get("/api/v1/telnyx/status", headers=owner_headers)
    assert owner_status.json()["data"]["telnyx_phone_number"] == "+15550001234"


def _login_team_member(client, mock_db, organization_id: str, email: str, role_slug: str) -> dict[str, str]:
    from app.core.security import create_access_token

    user_id = _add_team_member_to_org(mock_db, organization_id, email, role_slug)
    token = create_access_token(user_id, email)
    return {"Authorization": f"Bearer {token}"}


def test_incoming_call_rings_whichever_team_member_is_active(client, mock_db, monkeypatch):
    """Not just the owner — any team member live in the browser gets bridged."""
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    owner_headers, owner_id = _register_and_login(client, mock_db, "owner-bridge@example.com", "owner")
    staff_id = _add_team_member_to_org(mock_db, owner_id, "staff-bridge@example.com", "staff")

    async def _seed():
        from datetime import datetime, timedelta, timezone

        await mock_db.organizations.insert_one(
            {"organization_id": owner_id, "telnyx_phone_number": "+15559990000", "telnyx_setup_status": "active"}
        )
        # Staff (not the owner) is the one live in the browser.
        await mock_db.voice_device_registrations.insert_one(
            {
                "user_id": staff_id,
                "identity": "sipstaffuser",
                "active": True,
                "expires_at": datetime.now(timezone.utc) + timedelta(seconds=120),
            }
        )

    asyncio.run(_seed())

    answer_calls: list[dict] = []
    transfer_calls: list[dict] = []

    async def fake_answer(self, call_control_id: str, *, websocket_url: str | None = None) -> None:
        answer_calls.append({"websocket_url": websocket_url})

    async def fake_transfer(self, call_control_id: str, *, to_number: str) -> bool:
        transfer_calls.append({"to_number": to_number})
        return True

    monkeypatch.setattr(CallService, "answer_call", fake_answer)
    monkeypatch.setattr(CallService, "transfer_call", fake_transfer)

    body = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:org-bridge", "direction": "incoming", "from": "+1555", "to": "+15559990000"},
    )
    response = client.post("/api/v1/calls/webhook", content=body)
    assert response.status_code == 200

    assert transfer_calls == [{"to_number": "sip:sipstaffuser@sip.telnyx.com"}]
    assert answer_calls[0]["websocket_url"] is None

    call_log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "v2:org-bridge"}))
    assert call_log is not None
    assert call_log["user_id"] == owner_id  # attributed to the org owner


def test_incoming_call_falls_back_to_ai_when_nobody_is_active(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)
    _headers, owner_id = _register_and_login(client, mock_db, "owner-noreg@example.com", "owner")

    asyncio.run(
        mock_db.organizations.insert_one(
            {"organization_id": owner_id, "telnyx_phone_number": "+15558880000", "telnyx_setup_status": "active"}
        )
    )

    answer_calls: list[dict] = []

    async def fake_answer(self, call_control_id: str, *, websocket_url: str | None = None) -> None:
        answer_calls.append({"websocket_url": websocket_url})

    monkeypatch.setattr(CallService, "answer_call", fake_answer)

    body = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:org-noreg", "direction": "incoming", "from": "+1555", "to": "+15558880000"},
    )
    client.post("/api/v1/calls/webhook", content=body)

    assert len(answer_calls) == 1
    assert answer_calls[0]["websocket_url"] is not None


def _webhook_envelope(event_type: str, payload: dict) -> bytes:
    import json

    return json.dumps(
        {"data": {"event_type": event_type, "id": "evt_test", "occurred_at": "2026-01-01T00:00:00Z", "payload": payload}}
    ).encode()


def test_backfill_migrates_legacy_user_number_to_organization(mock_db):
    from datetime import datetime, timezone

    async def _seed_and_run():
        user = await mock_db.users.insert_one(
            {
                "full_name": "Legacy Owner",
                "email": "legacy@example.com",
                "organization_id": "org-legacy-1",
                "telnyx_phone_number": "+15551112222",
                "telnyx_phone_number_id": "num_legacy",
                "telnyx_setup_status": "active",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        result = await TelnyxProvisioningService(mock_db).backfill_organization_numbers()

        org = await mock_db.organizations.find_one({"organization_id": "org-legacy-1"})
        migrated_user = await mock_db.users.find_one({"_id": user.inserted_id})
        return result, org, migrated_user

    result, org, migrated_user = asyncio.run(_seed_and_run())

    assert result["platform_numbers_migrated"] == 1
    assert org is not None
    assert org["telnyx_phone_number"] == "+15551112222"
    assert "telnyx_phone_number" not in migrated_user


def test_backfill_releases_duplicate_numbers_in_same_org(mock_db, monkeypatch):
    from datetime import datetime, timezone

    released_ids: list[str] = []
    monkeypatch.setattr(
        "app.services.telnyx_provisioning_service._release_sync",
        lambda phone_number_id: released_ids.append(phone_number_id),
    )

    async def _seed_and_run():
        await mock_db.users.insert_many(
            [
                {
                    "full_name": "First",
                    "email": "dup1@example.com",
                    "organization_id": "org-dup-1",
                    "telnyx_phone_number": "+15551110001",
                    "telnyx_phone_number_id": "num_first",
                    "telnyx_setup_status": "active",
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                },
                {
                    "full_name": "Second",
                    "email": "dup2@example.com",
                    "organization_id": "org-dup-1",
                    "telnyx_phone_number": "+15551110002",
                    "telnyx_phone_number_id": "num_second",
                    "telnyx_setup_status": "active",
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                },
            ]
        )
        return await TelnyxProvisioningService(mock_db).backfill_organization_numbers()

    result = asyncio.run(_seed_and_run())
    assert result["platform_numbers_migrated"] == 1
    assert result["platform_numbers_released_as_duplicate"] == 1
    assert released_ids == ["num_second"]


def test_backfill_is_idempotent(mock_db):
    from datetime import datetime, timezone

    async def _seed_and_run_twice():
        await mock_db.users.insert_one(
            {
                "full_name": "Idempotent Owner",
                "email": "idem@example.com",
                "organization_id": "org-idem-1",
                "telnyx_phone_number": "+15559990001",
                "telnyx_phone_number_id": "num_idem",
                "telnyx_setup_status": "active",
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        first = await TelnyxProvisioningService(mock_db).backfill_organization_numbers()
        second = await TelnyxProvisioningService(mock_db).backfill_organization_numbers()
        return first, second

    first, second = asyncio.run(_seed_and_run_twice())
    assert first["platform_numbers_migrated"] == 1
    assert second["platform_numbers_migrated"] == 0
    assert second["platform_numbers_released_as_duplicate"] == 0
