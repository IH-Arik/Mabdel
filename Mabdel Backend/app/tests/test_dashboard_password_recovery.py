from __future__ import annotations

import asyncio

import pytest

from app.core.exceptions import AppException
from app.schemas.dashboard_schemas import ResetPasswordRequest, VerifyOTPRequest
from app.services.dashboard.dashboard_service import DashboardService

# Regression coverage for the original audit's "duplicate recovery
# implementation" finding: forgot_password saved an OTP and reported success
# without ever delivering it anywhere, and verify_otp/reset_password had no
# attempt limit and no one-time-use marker, so a guessed OTP could reset the
# password repeatedly until the 10-minute window expired.


async def _seed_user(db, email: str) -> None:
    await db.users.insert_one({"email": email, "role": "admin", "hashed_password": "x"})


def test_forgot_password_actually_sends_the_otp_email(mock_db, monkeypatch):
    sent = []

    async def fake_send_otp_email(self, *, email, otp_code, purpose):
        sent.append({"email": email, "otp_code": otp_code, "purpose": purpose})

    import app.services.email_service as email_service_module
    monkeypatch.setattr(email_service_module.EmailService, "send_otp_email", fake_send_otp_email)

    asyncio.run(_seed_user(mock_db, "dash-admin@example.com"))
    service = DashboardService(mock_db)
    asyncio.run(service.forgot_password("dash-admin@example.com"))

    assert len(sent) == 1
    assert sent[0]["email"] == "dash-admin@example.com"
    assert sent[0]["purpose"] == "forgot_password"

    stored = asyncio.run(mock_db.otps.find_one({"email": "dash-admin@example.com"}))
    assert stored["otp"] == sent[0]["otp_code"]


def test_the_same_otp_cannot_reset_the_password_twice(mock_db, monkeypatch):
    import app.services.email_service as email_service_module

    async def fake_send_otp_email(self, *, email, otp_code, purpose):
        pass

    monkeypatch.setattr(email_service_module.EmailService, "send_otp_email", fake_send_otp_email)

    asyncio.run(_seed_user(mock_db, "dash-replay@example.com"))
    service = DashboardService(mock_db)
    asyncio.run(service.forgot_password("dash-replay@example.com"))
    otp = asyncio.run(mock_db.otps.find_one({"email": "dash-replay@example.com"}))["otp"]

    first = asyncio.run(
        service.reset_password(ResetPasswordRequest(email="dash-replay@example.com", otp=otp, new_password="FirstNewPass2025!"))
    )
    assert first is True

    with pytest.raises(AppException) as exc_info:
        asyncio.run(
            service.reset_password(ResetPasswordRequest(email="dash-replay@example.com", otp=otp, new_password="SecondNewPass2025!"))
        )
    assert exc_info.value.code == "INVALID_OTP"


def test_verify_otp_still_works_as_a_non_mutating_check_before_reset(mock_db, monkeypatch):
    """verify_otp is the frontend's preliminary "is this code right" check and
    must stay usable before the real reset_password call consumes the OTP."""
    import app.services.email_service as email_service_module

    async def fake_send_otp_email(self, *, email, otp_code, purpose):
        pass

    monkeypatch.setattr(email_service_module.EmailService, "send_otp_email", fake_send_otp_email)

    asyncio.run(_seed_user(mock_db, "dash-verify@example.com"))
    service = DashboardService(mock_db)
    asyncio.run(service.forgot_password("dash-verify@example.com"))
    otp = asyncio.run(mock_db.otps.find_one({"email": "dash-verify@example.com"}))["otp"]

    assert asyncio.run(service.verify_otp(VerifyOTPRequest(email="dash-verify@example.com", otp=otp))) is True

    reset_ok = asyncio.run(
        service.reset_password(ResetPasswordRequest(email="dash-verify@example.com", otp=otp, new_password="NewPass2025!"))
    )
    assert reset_ok is True


def test_an_incorrect_otp_guess_is_counted_and_eventually_locked_out(mock_db, monkeypatch):
    import app.services.email_service as email_service_module
    from app.core.config import settings

    async def fake_send_otp_email(self, *, email, otp_code, purpose):
        pass

    monkeypatch.setattr(email_service_module.EmailService, "send_otp_email", fake_send_otp_email)

    asyncio.run(_seed_user(mock_db, "dash-bruteforce@example.com"))
    service = DashboardService(mock_db)
    asyncio.run(service.forgot_password("dash-bruteforce@example.com"))

    for _ in range(settings.OTP_MAX_ATTEMPTS):
        result = asyncio.run(service.verify_otp(VerifyOTPRequest(email="dash-bruteforce@example.com", otp="000000")))
        assert result is False

    stored = asyncio.run(mock_db.otps.find_one({"email": "dash-bruteforce@example.com"}))
    assert stored["attempts"] >= settings.OTP_MAX_ATTEMPTS
