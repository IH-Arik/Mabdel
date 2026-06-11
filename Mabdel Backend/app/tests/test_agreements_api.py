from __future__ import annotations

import asyncio
from datetime import date, timedelta


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "agreements@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Agreement Owner", "email": email, "password": "SecurePass2024!"},
    )
    assert register_response.status_code == 201

    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify_response = client.post("/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"})
    assert verify_response.status_code == 200

    login_response = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login_response.status_code == 200
    return {"Authorization": f"Bearer {login_response.json()['data']['access_token']}"}


def test_agreement_creator_preview_signature_and_pdf_flow(client, mock_db) -> None:
    headers = _auth_headers(client, mock_db)

    metadata_response = client.get("/api/v1/smartflow/agreements/metadata", headers=headers)
    assert metadata_response.status_code == 200
    assert any(item["key"] == "contract" for item in metadata_response.json()["data"]["types"])

    generate_response = client.post(
        "/api/v1/smartflow/agreements/generate",
        headers=headers,
        json={
            "prompt": "Create a service agreement for website design worth $2000 with 50% upfront payment.",
            "client_name": "Nexus Digital Systems LLC",
            "agreement_type": "contract",
        },
    )
    assert generate_response.status_code == 200
    draft = generate_response.json()["data"]
    assert "PAYMENT TERMS" in draft["content"]
    assert len(draft["smart_fields"]) == 2

    create_response = client.post(
        "/api/v1/smartflow/agreements",
        headers=headers,
        json={
            "title": draft["title"],
            "client_name": draft["client_name"],
            "client_email": "client@example.com",
            "agreement_type": draft["agreement_type"],
            "priority": "standard",
            "content": draft["content"],
            "smart_fields": draft["smart_fields"],
        },
    )
    assert create_response.status_code == 201
    agreement = create_response.json()["data"]
    agreement_id = agreement["id"]
    assert agreement["agreement_number"].startswith("AGR-")
    assert agreement["status"] == "draft"
    assert agreement["pdf_url"].endswith(f"/agreements/{agreement_id}/pdf")

    review_response = client.post(f"/api/v1/smartflow/agreements/{agreement_id}/review", headers=headers)
    assert review_response.status_code == 200
    review_items = review_response.json()["data"]["ai_review"]
    assert any(item["key"] == "penalty_clause" and item["severity"] == "warning" for item in review_items)

    improve_response = client.post(
        f"/api/v1/smartflow/agreements/{agreement_id}/improve",
        headers=headers,
        json={"content": agreement["content"], "instruction": "Add penalty clause."},
    )
    assert improve_response.status_code == 200
    assert "PENALTY CLAUSE" in improve_response.json()["data"]["content"]

    send_response = client.post(
        f"/api/v1/smartflow/agreements/{agreement_id}/send-signature",
        headers=headers,
        json={"channel": "link", "recipient_name": "Apex Client"},
    )
    assert send_response.status_code == 200
    signature_url = send_response.json()["data"]["signature_request_url"]
    signature_path = signature_url.replace("http://127.0.0.1:8000", "")

    pending_response = client.get("/api/v1/smartflow/agreements?status=pending_signature", headers=headers)
    assert pending_response.status_code == 200
    pending_payload = pending_response.json()["data"]
    assert pending_payload["summary"]["pending_signature_agreements"] == 1
    assert pending_payload["items"][0]["status"] == "pending_signature"
    assert "sign" in pending_payload["items"][0]["actions"]

    public_preview_response = client.get(signature_path)
    assert public_preview_response.status_code == 200
    assert public_preview_response.json()["data"]["id"] == agreement_id

    public_sign_response = client.post(
        signature_path,
        json={"signer_name": "Apex Client", "signer_email": "client@example.com", "signature_text": "Apex Client"},
    )
    assert public_sign_response.status_code == 200
    assert public_sign_response.json()["data"]["status"] == "signed"

    pdf_response = client.get(f"/api/v1/smartflow/agreements/{agreement_id}/pdf", headers=headers)
    assert pdf_response.status_code == 200
    assert pdf_response.headers["content-type"] == "application/pdf"
    assert pdf_response.content.startswith(b"%PDF-1.4")


def test_agreement_filters_renew_and_delete(client, mock_db) -> None:
    headers = _auth_headers(client, mock_db, email="agreements-expired@example.com")
    yesterday = date.today() - timedelta(days=1)

    create_response = client.post(
        "/api/v1/smartflow/agreements",
        headers=headers,
        json={
            "title": "NDA Agreement",
            "client_name": "Olivia Martinez",
            "agreement_type": "nda",
            "priority": "high",
            "start_date": str(yesterday - timedelta(days=30)),
            "end_date": str(yesterday),
            "content": "NDA Agreement\n\n1. Parties\nClient and Provider.\n\n2. Confidentiality\nBoth parties protect private information.\n\n3. Signature\nAuthorized representative signs.",
        },
    )
    assert create_response.status_code == 201
    agreement_id = create_response.json()["data"]["id"]
    assert create_response.json()["data"]["status"] == "expired"

    expired_response = client.get("/api/v1/smartflow/agreements?status=expired&agreement_type=nda", headers=headers)
    assert expired_response.status_code == 200
    expired_item = expired_response.json()["data"]["items"][0]
    assert expired_item["id"] == agreement_id
    assert "renew" in expired_item["actions"]

    renew_response = client.post(
        f"/api/v1/smartflow/agreements/{agreement_id}/renew",
        headers=headers,
        json={"start_date": str(date.today()), "end_date": str(date.today() + timedelta(days=365))},
    )
    assert renew_response.status_code == 200
    assert renew_response.json()["data"]["status"] == "draft"

    delete_response = client.delete(f"/api/v1/smartflow/agreements/{agreement_id}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted"] is True
