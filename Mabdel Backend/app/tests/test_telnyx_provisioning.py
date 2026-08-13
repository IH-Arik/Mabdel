from __future__ import annotations

import asyncio

import pytest

from app.core.exceptions import AppException
from app.services.telnyx_provisioning_service import TelnyxProvisioningService
from app.tests.conftest import grant_owner_role


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "telnyx-provision@example.com") -> tuple[dict[str, str], str]:
    """Registers, grants owner, and self-references organization_id — matching how the
    real owner-signup flow sets organization_id on itself (auth_routes.py). One Telnyx
    number belongs to the organization, not the individual user, since Phase 3."""
    register = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Telnyx User", "email": email, "password": "SecurePass2024!"},
    )
    assert register.status_code == 201
    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify = client.post("/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"})
    assert verify.status_code == 200
    grant_owner_role(mock_db, email)

    async def _self_reference_org():
        user = await mock_db.users.find_one({"email": email})
        await mock_db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"organization_id": str(user["_id"]), "role": "owner", "primary_role": "owner"}},
        )
        return str(user["_id"])

    organization_id = asyncio.run(_self_reference_org())

    login = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}, organization_id


def test_status_defaults_to_not_provisioned(client, mock_db):
    headers, _ = _auth_headers(client, mock_db)
    response = client.get("/api/v1/telnyx/status", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["telnyx_setup_status"] == "not_provisioned"
    assert data["telnyx_phone_number"] is None


def test_telnyx_endpoints_require_auth(client):
    assert client.get("/api/v1/telnyx/status").status_code in (401, 403)
    assert client.post("/api/v1/telnyx/provision").status_code in (401, 403)


def test_provision_uses_number_search_and_order(client, mock_db, monkeypatch):
    """End-to-end through the real service, with only the Telnyx SDK calls stubbed."""
    headers, organization_id = _auth_headers(client, mock_db, email="telnyx-provision-2@example.com")

    class FakeNumber:
        phone_number = "+15559876543"

    class FakeAvailableList:
        data = [FakeNumber()]

    class FakeOrderedNumber:
        id = "num_123"
        phone_number = "+15559876543"
        status = "success"

    class FakeOrderData:
        id = "order_123"
        status = "success"
        phone_numbers = [FakeOrderedNumber()]

    class FakeOrderResponse:
        data = FakeOrderData()

    class FakeClient:
        def __init__(self, *args, **kwargs):
            self.available_phone_numbers = self
            self.number_orders = self

        def list(self, filter=None):
            return FakeAvailableList()

        def create(self, **kwargs):
            return FakeOrderResponse()

        def retrieve(self, order_id):
            return FakeOrderResponse()

    import app.services.telnyx_provisioning_service as module

    monkeypatch.setattr(module, "telnyx", type("T", (), {"Client": FakeClient, "NOT_GIVEN": None, "TelnyxError": Exception}))
    monkeypatch.setattr(module.settings, "TELNYX_API_KEY", "test-key")

    response = client.post("/api/v1/telnyx/provision", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["telnyx_phone_number"] == "+15559876543"
    assert data["telnyx_setup_status"] == "active"

    status_response = client.get("/api/v1/telnyx/status", headers=headers)
    assert status_response.json()["data"]["telnyx_phone_number"] == "+15559876543"

    org = asyncio.run(mock_db.organizations.find_one({"organization_id": organization_id}))
    assert org is not None
    assert org["telnyx_phone_number"] == "+15559876543"


def test_provision_raises_when_no_number_available(mock_db, monkeypatch):
    class FakeEmptyList:
        data = []

    class FakeClient:
        def __init__(self, *args, **kwargs):
            self.available_phone_numbers = self

        def list(self, filter=None):
            return FakeEmptyList()

    import app.services.telnyx_provisioning_service as module

    monkeypatch.setattr(module, "telnyx", type("T", (), {"Client": FakeClient, "NOT_GIVEN": None, "TelnyxError": Exception}))
    monkeypatch.setattr(module.settings, "TELNYX_API_KEY", "test-key")

    async def _create_user():
        result = await mock_db.users.insert_one(
            {"email": "no-number@example.com", "full_name": "No Number", "organization_id": "org-no-number"}
        )
        return str(result.inserted_id)

    user_id = asyncio.run(_create_user())

    service = TelnyxProvisioningService(mock_db)
    with pytest.raises(AppException) as exc:
        asyncio.run(service.provision_organization("org-no-number", user_id))
    assert exc.value.code == "NO_NUMBER_AVAILABLE"

    org = asyncio.run(mock_db.organizations.find_one({"organization_id": "org-no-number"}))
    assert org["telnyx_setup_status"] == "failed"
