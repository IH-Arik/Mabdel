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


def test_reprovisioning_an_already_active_number_never_orders_a_second_one(client, mock_db, monkeypatch):
    """A business gets exactly one number, ever. Clicking "Re-run Provision Check"
    again once telnyx_setup_status is already "active" must be a pure no-op read of
    the existing number -- Telnyx's number_orders.create must never fire a second
    time for the same org."""
    monkeypatch.setattr(settings, "TELNYX_API_KEY", "test-key")
    monkeypatch.setattr(settings, "TELNYX_NUMBER_COUNTRY", "US")

    import app.services.telnyx_provisioning_service as module

    order_calls: list[dict] = []

    class TrackedTelephonyClient(FakeTelephonyClient):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            original_create = self.number_orders.create

            def _tracked_create(**kwargs):
                order_calls.append(kwargs)
                return original_create(**kwargs)

            self.number_orders.create = _tracked_create

    monkeypatch.setattr(module, "telnyx", type("T", (), {"Client": TrackedTelephonyClient, "TelnyxError": Exception, "NOT_GIVEN": None}))

    headers, owner_id = _register_and_login(client, mock_db, "owner-reprovision@example.com", "owner")

    first = client.post("/api/v1/telnyx/provision", headers=headers)
    assert first.status_code == 200, first.text
    first_number = first.json()["data"]["telnyx_phone_number"]
    assert first_number == "+15550001234"
    assert len(order_calls) == 1

    second = client.post("/api/v1/telnyx/provision", headers=headers)
    assert second.status_code == 200, second.text
    assert second.json()["data"]["telnyx_phone_number"] == first_number
    assert len(order_calls) == 1, "re-running provision on an already-active org must not order a second number"

    third = client.post("/api/v1/telnyx/provision", headers=headers)
    assert third.status_code == 200, third.text
    assert len(order_calls) == 1, "still just the one order after a third click"

    org = asyncio.run(mock_db.organizations.find_one({"organization_id": owner_id}))
    assert org["telnyx_phone_number"] == first_number


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


def _seed_active_staff_registration(mock_db, owner_id: str, staff_id: str, phone_number: str) -> None:
    from datetime import datetime, timedelta, timezone

    async def _seed():
        await mock_db.organizations.insert_one(
            {"organization_id": owner_id, "telnyx_phone_number": phone_number, "telnyx_setup_status": "active"}
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


def test_incoming_call_rings_the_active_team_members_browser_first(client, mock_db, monkeypatch):
    """Not just the owner — any team member live in the browser gets rung. Rung, not
    bridged immediately: a real, separate call leg is dialed to their SIP identity
    (so the browser gets an actual telnyx.notification it can show the incoming-call
    popup for) while the original inbound call is left unanswered/untouched."""
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    owner_headers, owner_id = _register_and_login(client, mock_db, "owner-ring@example.com", "owner")
    staff_id = _add_team_member_to_org(mock_db, owner_id, "staff-ring@example.com", "staff")
    _seed_active_staff_registration(mock_db, owner_id, staff_id, "+15559990000")

    ring_calls: list[dict] = []
    answer_calls: list[dict] = []

    async def fake_ring_browser(self, *, sip_target, from_number, timeout_secs, client_state) -> str:
        ring_calls.append(
            {"sip_target": sip_target, "from_number": from_number, "timeout_secs": timeout_secs, "client_state": client_state}
        )
        return "v3:ring-leg-1"

    async def fake_answer(self, call_control_id: str, *, websocket_url: str | None = None) -> None:
        answer_calls.append({"call_control_id": call_control_id, "websocket_url": websocket_url})

    monkeypatch.setattr(CallService, "ring_browser", fake_ring_browser)
    monkeypatch.setattr(CallService, "answer_call", fake_answer)

    body = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:org-bridge", "direction": "incoming", "from": "+1555", "to": "+15559990000"},
    )
    response = client.post("/api/v1/calls/webhook", content=body)
    assert response.status_code == 200

    assert len(ring_calls) == 1
    assert ring_calls[0]["sip_target"] == "sip:sipstaffuser@sip.telnyx.com"
    assert ring_calls[0]["timeout_secs"] > 0

    # The AI must NOT be answered into the call at this point -- it's still ringing
    # the browser, not falling back yet.
    assert answer_calls == []

    call_log = asyncio.run(mock_db.call_logs.find_one({"twilio_call_sid": "v2:org-bridge"}))
    assert call_log is not None
    assert call_log["user_id"] == owner_id  # attributed to the org owner


def test_browser_answering_the_ring_bridges_it_to_the_caller(client, mock_db, monkeypatch):
    """The team member picks up in their browser -> the ring leg's call.answered
    webhook must bridge it into the original (still-unanswered) inbound call."""
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    owner_id = _register_and_login(client, mock_db, "owner-answer@example.com", "owner")[1]
    staff_id = _add_team_member_to_org(mock_db, owner_id, "staff-answer@example.com", "staff")
    _seed_active_staff_registration(mock_db, owner_id, staff_id, "+15559991111")

    async def fake_ring_browser(self, *, sip_target, from_number, timeout_secs, client_state) -> str:
        return "v3:ring-leg-2"

    bridge_calls: list[dict] = []

    async def fake_bridge(self, call_control_id: str, *, with_call_control_id: str) -> bool:
        bridge_calls.append({"call_control_id": call_control_id, "with_call_control_id": with_call_control_id})
        return True

    answer_calls: list[dict] = []

    async def fake_answer(self, call_control_id: str, *, websocket_url: str | None = None) -> None:
        answer_calls.append({"call_control_id": call_control_id})

    monkeypatch.setattr(CallService, "ring_browser", fake_ring_browser)
    monkeypatch.setattr(CallService, "bridge_calls", fake_bridge)
    monkeypatch.setattr(CallService, "answer_call", fake_answer)

    initiated = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:org-answer", "direction": "incoming", "from": "+1555", "to": "+15559991111"},
    )
    assert client.post("/api/v1/calls/webhook", content=initiated).status_code == 200

    answered = _webhook_envelope("call.answered", {"call_control_id": "v3:ring-leg-2"})
    assert client.post("/api/v1/calls/webhook", content=answered).status_code == 200

    assert bridge_calls == [{"call_control_id": "v3:ring-leg-2", "with_call_control_id": "v2:org-answer"}]
    # The AI fallback path must never fire once the browser answered.
    assert answer_calls == []


def test_browser_ring_timeout_falls_back_to_ai_without_touching_the_original_call(client, mock_db, monkeypatch):
    """Nobody picks up within BROWSER_RING_TIMEOUT_SECONDS -> Telnyx sends call.hangup
    for the RING LEG (hangup_cause="timeout") -- the original inbound call, left
    untouched this whole time, must then be answered into the AI."""
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    owner_id = _register_and_login(client, mock_db, "owner-timeout@example.com", "owner")[1]
    staff_id = _add_team_member_to_org(mock_db, owner_id, "staff-timeout@example.com", "staff")
    _seed_active_staff_registration(mock_db, owner_id, staff_id, "+15559992222")

    async def fake_ring_browser(self, *, sip_target, from_number, timeout_secs, client_state) -> str:
        return "v3:ring-leg-3"

    answer_calls: list[dict] = []

    async def fake_answer(self, call_control_id: str, *, websocket_url: str | None = None) -> None:
        answer_calls.append({"call_control_id": call_control_id, "websocket_url": websocket_url})

    monkeypatch.setattr(CallService, "ring_browser", fake_ring_browser)
    monkeypatch.setattr(CallService, "answer_call", fake_answer)

    initiated = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:org-timeout", "direction": "incoming", "from": "+1555", "to": "+15559992222"},
    )
    assert client.post("/api/v1/calls/webhook", content=initiated).status_code == 200

    ring_timed_out = _webhook_envelope(
        "call.hangup", {"call_control_id": "v3:ring-leg-3", "hangup_cause": "timeout"}
    )
    assert client.post("/api/v1/calls/webhook", content=ring_timed_out).status_code == 200

    from app.api.v1.endpoints.calls import call_service as endpoint_call_service

    assert answer_calls == [
        {"call_control_id": "v2:org-timeout", "websocket_url": endpoint_call_service.build_media_stream_url("v2:org-timeout")}
    ]


def test_explicit_reject_ends_the_call_without_ai_taking_over(client, mock_db, monkeypatch):
    """User-confirmed rule: Reject means neither the human nor the AI picks up --
    only a genuine ring TIMEOUT should hand the caller to AI. A team member
    explicitly declining (hangup_cause anything other than "timeout") must just end
    the original call."""
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    owner_id = _register_and_login(client, mock_db, "owner-reject@example.com", "owner")[1]
    staff_id = _add_team_member_to_org(mock_db, owner_id, "staff-reject@example.com", "staff")
    _seed_active_staff_registration(mock_db, owner_id, staff_id, "+15559994444")

    async def fake_ring_browser(self, *, sip_target, from_number, timeout_secs, client_state) -> str:
        return "v3:ring-leg-5"

    answer_calls: list[dict] = []
    hangup_calls: list[str] = []

    async def fake_answer(self, call_control_id: str, *, websocket_url: str | None = None) -> None:
        answer_calls.append({"call_control_id": call_control_id, "websocket_url": websocket_url})

    async def fake_hangup(self, call_control_id: str) -> bool:
        hangup_calls.append(call_control_id)
        return True

    monkeypatch.setattr(CallService, "ring_browser", fake_ring_browser)
    monkeypatch.setattr(CallService, "answer_call", fake_answer)
    monkeypatch.setattr(CallService, "hangup_call", fake_hangup)

    initiated = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:org-reject", "direction": "incoming", "from": "+1555", "to": "+15559994444"},
    )
    assert client.post("/api/v1/calls/webhook", content=initiated).status_code == 200

    # A rejected WebRTC call reports some hangup_cause other than "timeout" (the
    # exact string Telnyx uses for a callee decline isn't asserted on here on
    # purpose -- the point is that this branch treats anything-but-timeout as a
    # decline, not that it matches one specific string).
    rejected = _webhook_envelope("call.hangup", {"call_control_id": "v3:ring-leg-5", "hangup_cause": "call_rejected"})
    assert client.post("/api/v1/calls/webhook", content=rejected).status_code == 200

    assert hangup_calls == ["v2:org-reject"]
    assert answer_calls == [], "a decline must never hand the caller to AI"


def test_transfer_to_ai_button_immediately_hands_a_ringing_call_to_ai(client, mock_db, monkeypatch):
    """The explicit "Transfer to AI" action on a still-ringing (unanswered) browser
    call: stop ringing the browser and answer the original call into AI right away,
    without waiting for BROWSER_RING_TIMEOUT_SECONDS."""
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    headers, owner_id = _register_and_login(client, mock_db, "owner-explicit-ai@example.com", "owner")
    staff_id = _add_team_member_to_org(mock_db, owner_id, "staff-explicit-ai@example.com", "staff")
    _seed_active_staff_registration(mock_db, owner_id, staff_id, "+15559995555")

    async def fake_ring_browser(self, *, sip_target, from_number, timeout_secs, client_state) -> str:
        return "v3:ring-leg-6"

    answer_calls: list[dict] = []
    hangup_calls: list[str] = []

    async def fake_answer(self, call_control_id: str, *, websocket_url: str | None = None) -> None:
        answer_calls.append({"call_control_id": call_control_id, "websocket_url": websocket_url})

    async def fake_hangup(self, call_control_id: str) -> bool:
        hangup_calls.append(call_control_id)
        return True

    monkeypatch.setattr(CallService, "ring_browser", fake_ring_browser)
    monkeypatch.setattr(CallService, "answer_call", fake_answer)
    monkeypatch.setattr(CallService, "hangup_call", fake_hangup)

    initiated = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:org-explicit-ai", "direction": "incoming", "from": "+1555", "to": "+15559995555"},
    )
    assert client.post("/api/v1/calls/webhook", content=initiated).status_code == 200

    # The frontend's "Transfer to AI" button posts this against the RING LEG's
    # call_sid (what the browser's WebRTC object actually knows), not the original
    # inbound call's -- call_action must resolve the mapping itself.
    response = client.post(
        "/api/v1/calls/v3:ring-leg-6/action", headers=headers, json={"action": "transfer_to_ai"}
    )
    assert response.status_code == 200, response.text

    from app.api.v1.endpoints.calls import call_service as endpoint_call_service

    assert hangup_calls == ["v3:ring-leg-6"], "the ring leg itself must stop ringing the browser"
    assert answer_calls == [
        {"call_control_id": "v2:org-explicit-ai", "websocket_url": endpoint_call_service.build_media_stream_url("v2:org-explicit-ai")}
    ]


def test_caller_hangup_while_browser_is_ringing_stops_the_ring(client, mock_db, monkeypatch):
    """The caller abandons the call while the team member's browser is still
    ringing -- the ring leg must be hung up rather than left ringing pointlessly for
    a call that's already gone, and the AI fallback must not fire either."""
    monkeypatch.setattr(settings, "TELNYX_VALIDATE_SIGNATURE", False)

    owner_id = _register_and_login(client, mock_db, "owner-abandon@example.com", "owner")[1]
    staff_id = _add_team_member_to_org(mock_db, owner_id, "staff-abandon@example.com", "staff")
    _seed_active_staff_registration(mock_db, owner_id, staff_id, "+15559993333")

    async def fake_ring_browser(self, *, sip_target, from_number, timeout_secs, client_state) -> str:
        return "v3:ring-leg-4"

    hangup_calls: list[str] = []
    answer_calls: list[dict] = []

    async def fake_hangup(self, call_control_id: str) -> bool:
        hangup_calls.append(call_control_id)
        return True

    async def fake_answer(self, call_control_id: str, *, websocket_url: str | None = None) -> None:
        answer_calls.append({"call_control_id": call_control_id})

    monkeypatch.setattr(CallService, "ring_browser", fake_ring_browser)
    monkeypatch.setattr(CallService, "hangup_call", fake_hangup)
    monkeypatch.setattr(CallService, "answer_call", fake_answer)

    initiated = _webhook_envelope(
        "call.initiated",
        {"call_control_id": "v2:org-abandon", "direction": "incoming", "from": "+1555", "to": "+15559993333"},
    )
    assert client.post("/api/v1/calls/webhook", content=initiated).status_code == 200

    caller_hung_up = _webhook_envelope("call.hangup", {"call_control_id": "v2:org-abandon", "hangup_cause": "originator_cancel"})
    assert client.post("/api/v1/calls/webhook", content=caller_hung_up).status_code == 200

    assert hangup_calls == ["v3:ring-leg-4"]
    assert answer_calls == []


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
