from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.core.exceptions import AppException
from app.services.telnyx_provisioning_service import TelnyxProvisioningService
from app.tests.conftest import grant_role


class FakeTelnyxError(Exception):
    pass


class FakeNumber:
    def __init__(self, phone_number: str, number_id: str):
        self.phone_number = phone_number
        self.id = number_id
        self.status = "active"
        self.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _install_fake_telnyx(monkeypatch, numbers=None, error=None):
    import app.services.telnyx_provisioning_service as module

    class FakeClient:
        def __init__(self, *args, **kwargs):
            self.phone_numbers = self

        def list(self, **kwargs):
            if error is not None:
                raise error
            return iter(numbers or [])

    monkeypatch.setattr(
        module,
        "telnyx",
        type("T", (), {"Client": FakeClient, "NOT_GIVEN": None, "TelnyxError": FakeTelnyxError}),
    )
    monkeypatch.setattr(module.settings, "TELNYX_API_KEY", "test-key")


def test_list_all_numbers_flags_orphaned_vs_org_assigned(mock_db, monkeypatch):
    asyncio.run(mock_db.organizations.insert_one({"organization_id": "org_1", "telnyx_phone_number": "+15550001111"}))
    asyncio.run(
        mock_db.users.insert_one(
            {"organization_id": "org_1", "role": "owner", "full_name": "Owner One", "email": "owner@example.com"}
        )
    )
    # Stale/partial record: org points at this number but has no owner user.
    asyncio.run(mock_db.organizations.insert_one({"organization_id": "org_3", "telnyx_phone_number": "+15558888888"}))
    _install_fake_telnyx(
        monkeypatch,
        numbers=[
            FakeNumber("+15550001111", "num_a"),
            FakeNumber("+15559999999", "num_b"),
            FakeNumber("+15558888888", "num_c"),
        ],
    )

    result = asyncio.run(TelnyxProvisioningService(mock_db).list_all_numbers())

    by_number = {item["phone_number"]: item for item in result}
    assert set(by_number) == {"+15550001111", "+15559999999", "+15558888888"}

    matched = by_number["+15550001111"]
    assert matched["orphaned"] is False
    assert matched["owner_email"] == "owner@example.com"
    assert matched["organization_id"] == "org_1"
    assert matched["phone_number_id"] == "num_a"
    assert matched["status"] == "active"

    assert by_number["+15559999999"]["orphaned"] is True
    assert by_number["+15559999999"]["organization_id"] is None
    assert by_number["+15559999999"]["owner_email"] is None

    stale = by_number["+15558888888"]
    assert stale["orphaned"] is False
    assert stale["organization_id"] == "org_3"
    assert stale["owner_email"] is None


def test_list_all_numbers_finds_owner_by_primary_role_and_prefers_original_email(mock_db, monkeypatch):
    asyncio.run(mock_db.organizations.insert_one({"organization_id": "org_legacy", "telnyx_phone_number": "+15557770000"}))
    # Legacy owner doc: only primary_role is set, and the login email is a fake one.
    asyncio.run(
        mock_db.users.insert_one(
            {
                "organization_id": "org_legacy",
                "primary_role": "owner",
                "email": "fake-login@example.com",
                "original_email": "real-owner@example.com",
            }
        )
    )
    _install_fake_telnyx(monkeypatch, numbers=[FakeNumber("+15557770000", "num_legacy")])

    result = asyncio.run(TelnyxProvisioningService(mock_db).list_all_numbers())

    assert result[0]["owner_email"] == "real-owner@example.com"


def test_get_number_usage_sums_last_30_days_only(mock_db):
    now = datetime.now(timezone.utc)
    asyncio.run(
        mock_db.call_logs.insert_many(
            [
                {"from_number": "+15550001111", "duration": 60, "created_at": now - timedelta(days=1)},
                {"phone_number": "+15550001111", "duration": 120, "created_at": now - timedelta(days=5)},
                {"from_number": "+15550001111", "duration": 999, "created_at": now - timedelta(days=40)},
                {"from_number": "+15552223333", "duration": 500, "created_at": now - timedelta(days=1)},
            ]
        )
    )

    usage = asyncio.run(TelnyxProvisioningService(mock_db).get_number_usage("+15550001111"))

    assert usage == {"call_count": 2, "total_minutes": 3.0}


def test_get_number_usage_returns_zeros_when_no_calls(mock_db):
    usage = asyncio.run(TelnyxProvisioningService(mock_db).get_number_usage("+15550001111"))

    assert usage == {"call_count": 0, "total_minutes": 0.0}


def test_list_all_numbers_surfaces_a_telnyx_error_as_a_clean_exception(mock_db, monkeypatch):
    _install_fake_telnyx(monkeypatch, error=FakeTelnyxError("boom"))

    with pytest.raises(AppException) as exc_info:
        asyncio.run(TelnyxProvisioningService(mock_db).list_all_numbers())

    assert exc_info.value.status_code == 502
    assert exc_info.value.code == "TELNYX_API_ERROR"


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _admin_headers(client, mock_db, email: str = "telnyx-admin@example.com", role: str = "super_admin") -> dict[str, str]:
    register = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Telnyx Admin", "email": email, "password": "SecurePass2024!"},
    )
    assert register.status_code == 201
    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify = client.post("/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"})
    assert verify.status_code == 200
    grant_role(mock_db, email, role)

    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}


def test_list_endpoint_requires_admin_role(client, mock_db):
    headers = _admin_headers(client, mock_db, email="telnyx-not-admin@example.com", role="owner")
    response = client.get("/api/v1/dashboard/admin/telnyx-numbers", headers=headers)
    assert response.status_code == 403


def test_list_endpoint_returns_numbers_with_usage(client, mock_db, monkeypatch):
    headers = _admin_headers(client, mock_db, email="telnyx-list-admin@example.com")
    _install_fake_telnyx(monkeypatch, numbers=[FakeNumber("+15551230000", "num_list")])

    response = client.get("/api/v1/dashboard/admin/telnyx-numbers", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)
    assert body["data"][0]["phone_number"] == "+15551230000"
    assert "usage" in body["data"][0]
    assert body["data"][0]["usage"] == {"call_count": 0, "total_minutes": 0.0}


def test_release_endpoint_clears_org_assignment_and_writes_audit_log(client, mock_db, monkeypatch):
    headers = _admin_headers(client, mock_db, email="telnyx-release-admin@example.com")
    asyncio.run(
        mock_db.organizations.insert_one(
            {
                "organization_id": "org_release",
                "telnyx_phone_number": "+15559990000",
                "telnyx_phone_number_id": "num_release",
                "telnyx_setup_status": "active",
            }
        )
    )
    _install_fake_telnyx(monkeypatch, numbers=[])

    response = client.delete("/api/v1/dashboard/admin/telnyx-numbers/num_release", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["success"] is True

    org = asyncio.run(mock_db.organizations.find_one({"organization_id": "org_release"}))
    assert org.get("telnyx_phone_number") is None
    assert org.get("telnyx_phone_number_id") is None
    assert org.get("telnyx_setup_status") == "not_provisioned"

    audit_entry = asyncio.run(mock_db.rbac_audit_logs.find_one({"action": "telnyx_number_released"}))
    assert audit_entry is not None
    assert audit_entry["target"] == "num_release"
    assert audit_entry["organization_id"] == "org_release"


def test_assign_endpoint_rejects_an_already_assigned_number(client, mock_db):
    headers = _admin_headers(client, mock_db, email="telnyx-assign-admin@example.com")
    asyncio.run(
        mock_db.organizations.insert_one(
            {
                "organization_id": "org_first",
                "telnyx_phone_number": "+15552221111",
                "telnyx_phone_number_id": "num_assign",
                "telnyx_setup_status": "active",
            }
        )
    )
    asyncio.run(mock_db.organizations.insert_one({"organization_id": "org_second"}))

    response = client.patch(
        "/api/v1/dashboard/admin/telnyx-numbers/num_assign/assign",
        json={"organization_id": "org_second"},
        headers=headers,
    )
    assert response.status_code == 409
