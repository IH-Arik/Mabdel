from __future__ import annotations

import asyncio
from datetime import date, timedelta


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "leases@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Lease Owner", "email": email, "password": "SecurePass2024!"},
    )
    assert register_response.status_code == 201

    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify_response = client.post("/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"})
    assert verify_response.status_code == 200

    login_response = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login_response.status_code == 200
    return {"Authorization": f"Bearer {login_response.json()['data']['access_token']}"}


def _lease_payload(**overrides) -> dict:
    payload = {
        "prompt": "Create a 12 month apartment lease for $1200/month with a $1200 security deposit.",
        "property_address": "221B Baker Street, London, NW1 6XE",
        "property_type": "apartment",
        "landlord_name": "SmartFlow Properties",
        "tenant_name": "John Doe",
        "tenant_email": "tenant@example.com",
        "monthly_rent_cents": 120000,
        "security_deposit_cents": 120000,
        "rent_due_day": 1,
        "start_date": str(date.today()),
        "end_date": str(date.today() + timedelta(days=365)),
        "signature_fields": {"tenant_signature": True, "landlord_signature": True},
    }
    payload.update(overrides)
    return payload


def test_lease_generator_preview_signature_and_pdf_flow(client, mock_db) -> None:
    headers = _auth_headers(client, mock_db)

    metadata_response = client.get("/api/v1/smartflow/leases/metadata", headers=headers)
    assert metadata_response.status_code == 200
    assert any(item["key"] == "office_space" for item in metadata_response.json()["data"]["property_types"])

    generate_response = client.post("/api/v1/smartflow/leases/generate", headers=headers, json=_lease_payload())
    assert generate_response.status_code == 200
    draft = generate_response.json()["data"]
    assert draft["monthly_rent_label"] == "$1,200/mo"
    assert "PROPERTY ADDRESS" in draft["content"]
    assert any(item["key"] == "duration" for item in draft["ai_review"])

    create_payload = _lease_payload(content=draft["content"], status="draft")
    create_response = client.post("/api/v1/smartflow/leases", headers=headers, json=create_payload)
    assert create_response.status_code == 201
    lease = create_response.json()["data"]
    lease_id = lease["id"]
    assert lease["lease_number"].startswith("LD-")
    assert lease["tenant_name"] == "John Doe"
    assert lease["status"] == "draft"
    assert lease["pdf_url"].endswith(f"/leases/{lease_id}/pdf")

    list_response = client.get("/api/v1/smartflow/leases?search=Baker", headers=headers)
    assert list_response.status_code == 200
    list_payload = list_response.json()["data"]
    assert list_payload["items"][0]["property_address"] == "221B Baker Street, London, NW1 6XE"
    assert list_payload["summary"]["total_leases"] == 1

    review_response = client.post(f"/api/v1/smartflow/leases/{lease_id}/review", headers=headers)
    assert review_response.status_code == 200
    assert any(item["key"] == "payment_terms" and item["passed"] for item in review_response.json()["data"]["ai_review"])

    enhance_response = client.post(
        f"/api/v1/smartflow/leases/{lease_id}/enhance-terms",
        headers=headers,
        json={"custom_terms": "Pets require written approval.", "focus": "landlord"},
    )
    assert enhance_response.status_code == 200
    assert "Late Fee" in enhance_response.json()["data"]["content"]

    send_response = client.post(
        f"/api/v1/smartflow/leases/{lease_id}/send-signature",
        headers=headers,
        json={"channel": "link", "recipient_name": "John Doe"},
    )
    assert send_response.status_code == 200
    signature_url = send_response.json()["data"]["signature_request_url"]
    assert "/leases/signing/" in signature_url
    signature_path = signature_url.replace("http://127.0.0.1:8000", "")

    pending_response = client.get("/api/v1/smartflow/leases?status=pending_signature", headers=headers)
    assert pending_response.status_code == 200
    assert pending_response.json()["data"]["items"][0]["primary_action"] == "sign"

    public_preview_response = client.get(signature_path)
    assert public_preview_response.status_code == 200
    assert public_preview_response.json()["data"]["id"] == lease_id

    public_sign_response = client.post(
        signature_path,
        json={"signer_name": "John Doe", "signer_email": "tenant@example.com", "signature_text": "John Doe"},
    )
    assert public_sign_response.status_code == 200
    signed_lease = public_sign_response.json()["data"]
    assert signed_lease["status"] == "active"
    assert signed_lease["primary_action"] == "verified"

    pdf_response = client.get(f"/api/v1/smartflow/leases/{lease_id}/pdf", headers=headers)
    assert pdf_response.status_code == 200
    assert pdf_response.headers["content-type"] == "application/pdf"
    assert pdf_response.content.startswith(b"%PDF-1.4")


def test_lease_filters_renew_and_delete(client, mock_db) -> None:
    headers = _auth_headers(client, mock_db, email="leases-expired@example.com")
    yesterday = date.today() - timedelta(days=1)

    expired_response = client.post(
        "/api/v1/smartflow/leases",
        headers=headers,
        json=_lease_payload(
            tenant_name="Emily Carter",
            property_address="House - Texas",
            start_date=str(yesterday - timedelta(days=365)),
            end_date=str(yesterday),
            status="active",
        ),
    )
    assert expired_response.status_code == 201
    expired_lease = expired_response.json()["data"]
    assert expired_lease["status"] == "expired"

    active_response = client.post(
        "/api/v1/smartflow/leases",
        headers=headers,
        json=_lease_payload(
            tenant_name="David Thompson",
            property_address="Shop - Chicago",
            property_type="shop",
            monthly_rent_cents=180000,
            status="active",
        ),
    )
    assert active_response.status_code == 201
    assert active_response.json()["data"]["status"] == "active"

    active_list_response = client.get("/api/v1/smartflow/leases?status=active&search=Chicago", headers=headers)
    assert active_list_response.status_code == 200
    assert active_list_response.json()["data"]["items"][0]["tenant_name"] == "David Thompson"

    expired_list_response = client.get("/api/v1/smartflow/leases?status=expired", headers=headers)
    assert expired_list_response.status_code == 200
    assert expired_list_response.json()["data"]["items"][0]["id"] == expired_lease["id"]

    renew_response = client.post(
        f"/api/v1/smartflow/leases/{expired_lease['id']}/renew",
        headers=headers,
        json={
            "start_date": str(date.today()),
            "end_date": str(date.today() + timedelta(days=365)),
            "monthly_rent_cents": 150000,
        },
    )
    assert renew_response.status_code == 200
    renewed = renew_response.json()["data"]
    assert renewed["status"] == "draft"
    assert renewed["monthly_rent_label"] == "$1,500/mo"

    delete_response = client.delete(f"/api/v1/smartflow/leases/{expired_lease['id']}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted"] is True
