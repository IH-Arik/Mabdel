from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.core.exceptions import AppException
from app.services.telnyx_provisioning_service import TelnyxProvisioningService


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
