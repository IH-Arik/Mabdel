from __future__ import annotations

import asyncio

from app.tests.conftest import grant_owner_role


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)]))
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "email-draft@example.com") -> dict[str, str]:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Email Draft Owner", "email": email, "password": "SecurePass2024!"},
    )
    assert register_response.status_code == 201

    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify_response = client.post("/api/v1/auth/verify-otp", json={"email": email, "code": otp["code"], "purpose": "signup"})
    assert verify_response.status_code == 200

    grant_owner_role(mock_db, email)

    login_response = client.post("/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"})
    assert login_response.status_code == 200
    return {"Authorization": f"Bearer {login_response.json()['data']['access_token']}"}


def test_draft_email_returns_a_subject_and_body_for_the_given_instruction(client, mock_db) -> None:
    headers = _auth_headers(client, mock_db)

    response = client.post(
        "/api/v1/email/draft",
        headers=headers,
        json={
            "recipient": "client@example.com",
            "subject_hint": "Following up on our proposal",
            "instruction": "Ask if they have had a chance to review the proposal we sent last week.",
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["recipient"] == "client@example.com"
    assert data["subject"] == "Following up on our proposal"
    assert "review the proposal" in data["body"]


def test_draft_email_requires_authentication(client) -> None:
    response = client.post(
        "/api/v1/email/draft",
        json={
            "recipient": "client@example.com",
            "subject_hint": "Hello",
            "instruction": "Say hello.",
        },
    )
    assert response.status_code in (401, 403)
