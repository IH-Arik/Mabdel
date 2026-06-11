from __future__ import annotations

import asyncio
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.api.v1.auth_routes import get_email_service
from app.core.database import get_database
from app.main import app


class FakeEmailService:
    async def send_otp_email(self, email: str, otp_code: str, purpose: str) -> None:
        return None

    async def send_invoice_email(self, email: str, subject: str, text: str, html: str) -> None:
        return None


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(
        db.otp_codes.find_one(
            {"email": email, "purpose": purpose},
            sort=[("created_at", -1)],
        )
    )
    assert otp is not None
    return otp


def _auth_headers(client: TestClient, mock_db, email: str = "invoice-api@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Invoice Owner", "email": email, "password": "SecurePass2024!"},
    )
    assert register_response.status_code == 201

    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify_response = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "code": otp["code"], "purpose": "signup"},
    )
    assert verify_response.status_code == 200

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePass2024!"},
    )
    assert login_response.status_code == 200
    access_token = login_response.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


def _create_invoice(client: TestClient, headers: dict[str, str]) -> int:
    response = client.post(
        "/api/v1/invoices",
        headers=headers,
        json={
            "client_name": "Acme Corporation",
            "client_email": "billing@acme.example",
            "billing_address": "456 Corporate Way\nNew York, NY 10001",
            "issue_date": "2099-04-30",
            "due_date": "2099-05-15",
            "tax_rate": 8.25,
            "currency": "USD",
            "items": [
                {"description": "AI Data Analytics Pro", "details": "Monthly subscription", "quantity": 1, "unit_price": 499},
                {"description": "API Overages", "details": "2,500 additional requests", "quantity": 1, "unit_price": 25},
            ],
        },
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


@pytest.fixture
def invoice_api_client(mock_db) -> Generator[TestClient, None, None]:
    async def override_get_database():
        return mock_db

    app.dependency_overrides[get_database] = override_get_database
    app.dependency_overrides[get_email_service] = lambda: FakeEmailService()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_invoice_crud_send_share_and_pdf_flow(invoice_api_client, mock_db):
    headers = _auth_headers(invoice_api_client, mock_db)
    invoice_id = _create_invoice(invoice_api_client, headers)

    list_response = invoice_api_client.get("/api/v1/invoices", headers=headers)
    assert list_response.status_code == 200
    list_payload = list_response.json()["data"]
    assert list_payload["summary"]["total_invoices"] == 1
    assert list_payload["items"][0]["client_name"] == "Acme Corporation"

    detail_response = invoice_api_client.get(f"/api/v1/invoices/{invoice_id}", headers=headers)
    assert detail_response.status_code == 200
    detail_payload = detail_response.json()["data"]
    assert detail_payload["invoice_number"].startswith("INV-2099-")
    assert detail_payload["subtotal"] == 524
    assert detail_payload["tax_amount"] == 43.23
    assert detail_payload["total_amount"] == 567.23
    assert detail_payload["timeline"][0]["event_type"] == "created"

    update_response = invoice_api_client.patch(
        f"/api/v1/invoices/{invoice_id}",
        headers=headers,
        json={"notes": "Net 15 terms", "items": [{"description": "AI Consultation", "quantity": 1, "unit_price": 1250}]},
    )
    assert update_response.status_code == 200
    updated_payload = update_response.json()["data"]
    assert updated_payload["subtotal"] == 1250
    assert updated_payload["notes"] == "Net 15 terms"

    send_response = invoice_api_client.post(
        f"/api/v1/invoices/{invoice_id}/send",
        headers=headers,
        json={"channel": "email"},
    )
    assert send_response.status_code == 200
    assert send_response.json()["data"]["status"] == "sent"

    share_response = invoice_api_client.post(
        f"/api/v1/invoices/{invoice_id}/share",
        headers=headers,
        json={"channel": "link"},
    )
    assert share_response.status_code == 200
    share_url = share_response.json()["data"]["share_url"]
    assert "/api/v1/invoices/shared/" in share_url

    timeline_response = invoice_api_client.get(f"/api/v1/invoices/{invoice_id}/timeline", headers=headers)
    assert timeline_response.status_code == 200
    event_types = [item["event_type"] for item in timeline_response.json()["data"]]
    assert "created" in event_types
    assert "sent" in event_types
    assert "shared" in event_types

    pdf_response = invoice_api_client.get(f"/api/v1/invoices/{invoice_id}/pdf", headers=headers)
    assert pdf_response.status_code == 200
    assert pdf_response.headers["content-type"] == "application/pdf"
    assert pdf_response.content.startswith(b"%PDF-1.4")

    public_pdf_response = invoice_api_client.get(share_url.replace("http://127.0.0.1:8000", ""))
    assert public_pdf_response.status_code == 200
    assert public_pdf_response.content.startswith(b"%PDF-1.4")

    reminder_response = invoice_api_client.post(
        f"/api/v1/invoices/{invoice_id}/remind",
        headers=headers,
        json={"channel": "email"},
    )
    assert reminder_response.status_code == 200

    status_response = invoice_api_client.post(
        f"/api/v1/invoices/{invoice_id}/status",
        headers=headers,
        json={"status": "paid"},
    )
    assert status_response.status_code == 200
    assert status_response.json()["data"]["status"] == "paid"

    delete_response = invoice_api_client.delete(f"/api/v1/invoices/{invoice_id}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted"] is True


def test_invoice_search_and_status_filters(invoice_api_client, mock_db):
    headers = _auth_headers(invoice_api_client, mock_db, email="invoice-filters@example.com")
    first_invoice_id = _create_invoice(invoice_api_client, headers)
    second_response = invoice_api_client.post(
        "/api/v1/invoices",
        headers=headers,
        json={
            "client_name": "Nebula Stream Inc.",
            "client_email": "ops@nebula.example",
            "issue_date": "2000-04-01",
            "due_date": "2000-04-10",
            "currency": "USD",
            "items": [{"description": "Setup", "quantity": 1, "unit_price": 300}],
        },
    )
    assert second_response.status_code == 201
    second_invoice_id = second_response.json()["data"]["id"]

    status_response = invoice_api_client.post(
        f"/api/v1/invoices/{first_invoice_id}/send",
        headers=headers,
        json={"channel": "manual"},
    )
    assert status_response.status_code == 200

    overdue_response = invoice_api_client.get("/api/v1/invoices?status=overdue", headers=headers)
    assert overdue_response.status_code == 200
    overdue_items = overdue_response.json()["data"]["items"]
    assert any(item["id"] == second_invoice_id for item in overdue_items)

    search_response = invoice_api_client.get("/api/v1/invoices?search=Nebula", headers=headers)
    assert search_response.status_code == 200
    assert search_response.json()["data"]["items"][0]["client_name"] == "Nebula Stream Inc."
