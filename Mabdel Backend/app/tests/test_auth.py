from __future__ import annotations

import asyncio

from app.core.config import settings
from app.services.auth_service import AuthService


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(
        db.otp_codes.find_one(
            {"email": email, "purpose": purpose},
            sort=[("created_at", -1)],
        )
    )
    assert otp is not None
    return otp


def _register_user(client, email: str = "arik@example.com", password: str = "SecurePass2024!") -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Arik Hasan", "email": email, "password": password},
    )
    assert response.status_code == 201


def _verify_signup_otp(client, db, email: str = "arik@example.com") -> None:
    otp = _get_latest_otp(db, email=email, purpose="signup")
    response = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "code": otp["code"], "purpose": "signup"},
    )
    assert response.status_code == 200


def test_register_creates_unverified_user_and_sends_signup_otp(client, mock_db) -> None:
    _register_user(client)

    user = asyncio.run(mock_db.users.find_one({"email": "arik@example.com"}))
    assert user is not None
    assert user["is_verified"] is False

    otp = _get_latest_otp(mock_db, email="arik@example.com", purpose="signup")
    assert otp["is_used"] is False


def test_login_requires_verified_user(client) -> None:
    _register_user(client, email="notverified@example.com")

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "notverified@example.com", "password": "SecurePass2024!"},
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "EMAIL_NOT_VERIFIED"


def test_verify_otp_then_login_success(client, mock_db) -> None:
    _register_user(client, email="verified@example.com")
    _verify_signup_otp(client, mock_db, email="verified@example.com")

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "verified@example.com", "password": "SecurePass2024!"},
    )
    assert login_response.status_code == 200
    payload = login_response.json()["data"]
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert payload["user"]["is_verified"] is True


def test_forgot_password_verify_and_reset_password_flow(client, mock_db) -> None:
    email = "reset@example.com"
    old_password = "SecurePass2024!"
    new_password = "NewSecurePass2025!"

    _register_user(client, email=email, password=old_password)
    _verify_signup_otp(client, mock_db, email=email)

    forgot_response = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert forgot_response.status_code == 200

    forgot_otp = _get_latest_otp(mock_db, email=email, purpose="forgot_password")
    verify_response = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "code": forgot_otp["code"], "purpose": "forgot_password"},
    )
    assert verify_response.status_code == 200
    reset_token = verify_response.json()["data"]["reset_token"]
    assert reset_token

    reset_response = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": email,
            "reset_token": reset_token,
            "new_password": new_password,
            "confirm_password": new_password,
        },
    )
    assert reset_response.status_code == 200

    old_login = client.post("/api/v1/auth/login", json={"email": email, "password": old_password})
    assert old_login.status_code == 401

    new_login = client.post("/api/v1/auth/login", json={"email": email, "password": new_password})
    assert new_login.status_code == 200


def test_refresh_token_and_me_endpoint(client, mock_db) -> None:
    email = "token@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePass2024!"},
    )
    assert login_response.status_code == 200
    data = login_response.json()["data"]
    refresh_token = data["refresh_token"]
    access_token = data["access_token"]

    me_response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me_response.status_code == 200
    assert me_response.json()["data"]["email"] == email

    refresh_response = client.post("/api/v1/auth/refresh-token", json={"refresh_token": refresh_token})
    assert refresh_response.status_code == 200
    refreshed_payload = refresh_response.json()["data"]
    assert refreshed_payload["access_token"]
    assert refreshed_payload["refresh_token"]


def test_duplicate_email_registration_returns_409(client) -> None:
    _register_user(client, email="dupe@example.com")
    response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Arik Hasan", "email": "dupe@example.com", "password": "SecurePass2024!"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"


def test_otp_resend_cooldown_returns_429(client) -> None:
    _register_user(client, email="cooldown@example.com")
    response = client.post(
        "/api/v1/auth/resend-otp",
        json={"email": "cooldown@example.com", "purpose": "signup"},
    )
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "OTP_RESEND_COOLDOWN"


def test_otp_max_attempts_brute_force_lockout(client) -> None:
    _register_user(client, email="lockout@example.com")
    for _ in range(4):
        response = client.post(
            "/api/v1/auth/verify-otp",
            json={"email": "lockout@example.com", "code": "0000", "purpose": "signup"},
        )
        assert response.status_code == 400

    final_response = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "lockout@example.com", "code": "0000", "purpose": "signup"},
    )
    assert final_response.status_code == 429
    assert final_response.json()["error"]["code"] == "OTP_MAX_ATTEMPTS_EXCEEDED"


def test_refresh_token_reuse_after_rotation_rejected(client, mock_db) -> None:
    email = "rotation@example.com"
    _register_user(client, email=email)
    _verify_signup_otp(client, mock_db, email=email)

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePass2024!"},
    )
    assert login_response.status_code == 200
    old_refresh_token = login_response.json()["data"]["refresh_token"]

    first_refresh = client.post("/api/v1/auth/refresh-token", json={"refresh_token": old_refresh_token})
    assert first_refresh.status_code == 200

    second_refresh = client.post("/api/v1/auth/refresh-token", json={"refresh_token": old_refresh_token})
    assert second_refresh.status_code == 401
    assert second_refresh.json()["error"]["code"] == "INVALID_REFRESH_TOKEN"


def test_google_login_creates_verified_user_and_tokens(client, mock_db, monkeypatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "google-client-id")

    async def fake_verify(self, id_token: str) -> dict:
        assert id_token == "valid-google-token"
        return {
            "sub": "google-user-123",
            "aud": "google-client-id",
            "email": "google.user@example.com",
            "email_verified": "true",
            "name": "Google User",
            "picture": "https://lh3.googleusercontent.com/avatar.png",
        }

    monkeypatch.setattr(AuthService, "_verify_google_id_token", fake_verify)

    response = client.post("/api/v1/auth/google", json={"id_token": "valid-google-token"})

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert payload["user"]["email"] == "google.user@example.com"
    assert payload["user"]["auth_provider"] == "google"
    user = asyncio.run(mock_db.users.find_one({"email": "google.user@example.com"}))
    assert user["is_verified"] is True
    assert user["provider_user_id"] == "google-user-123"
