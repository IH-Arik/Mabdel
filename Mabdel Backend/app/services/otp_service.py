from __future__ import annotations

from datetime import timedelta

from starlette import status

from app.core.config import settings
from app.core.exceptions import AppException
from app.repositories.otp_repository import OTPRepository
from app.schemas.auth_schema import OTPPurpose
from app.services.email_service import EmailService
from app.utils.helpers import generate_otp, mask_email, utc_now


class OTPService:
    def __init__(self, otp_repository: OTPRepository, email_service: EmailService) -> None:
        self.otp_repository = otp_repository
        self.email_service = email_service

    async def issue_otp(self, email: str, purpose: OTPPurpose) -> dict:
        latest = await self.otp_repository.get_latest_otp(email=email, purpose=purpose)
        now = utc_now()
        if latest:
            created_at = latest["created_at"]
            if getattr(created_at, "tzinfo", None) is None:
                comparison_now = now.replace(tzinfo=None)
            else:
                comparison_now = now
            elapsed_seconds = int((comparison_now - created_at).total_seconds())
            if elapsed_seconds < settings.OTP_RESEND_COOLDOWN_SECONDS:
                retry_after = settings.OTP_RESEND_COOLDOWN_SECONDS - elapsed_seconds
                raise AppException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    code="OTP_RESEND_COOLDOWN",
                    message=f"Please wait {retry_after}s before requesting another OTP.",
                    details={"retry_after_seconds": retry_after},
                )

        code = generate_otp(length=settings.OTP_LENGTH)
        expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

        await self.otp_repository.invalidate_active_otps(email=email, purpose=purpose)
        await self.otp_repository.create_otp(
            email=email,
            code=code,
            purpose=purpose,
            expires_at=expires_at,
        )

        try:
            await self.email_service.send_otp_email(email=email, otp_code=code, purpose=purpose)
        except Exception as exc:
            raise AppException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                code="OTP_EMAIL_SEND_FAILED",
                message="Unable to send OTP email. Please try again.",
                details=str(exc),
            ) from exc

        return {
            "email": email,
            "masked_email": mask_email(email),
            "purpose": purpose,
            "expires_in_minutes": settings.OTP_EXPIRE_MINUTES,
        }

    async def verify_otp(self, email: str, purpose: OTPPurpose, code: str) -> None:
        otp = await self.otp_repository.get_latest_active_otp(email=email, purpose=purpose)
        if not otp:
            raise AppException(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="OTP_INVALID_OR_EXPIRED",
                message="OTP is invalid or has expired.",
            )

        otp_id = str(otp["_id"])
        attempts = int(otp.get("attempts", 0))
        if attempts >= settings.OTP_MAX_ATTEMPTS:
            await self.otp_repository.mark_otp_used(otp_id)
            raise AppException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                code="OTP_MAX_ATTEMPTS_EXCEEDED",
                message="Maximum OTP attempts exceeded. Request a new OTP.",
            )

        if otp["code"] != code:
            updated_attempts = await self.otp_repository.increment_attempts(otp_id)
            if updated_attempts >= settings.OTP_MAX_ATTEMPTS:
                await self.otp_repository.mark_otp_used(otp_id)
                raise AppException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    code="OTP_MAX_ATTEMPTS_EXCEEDED",
                    message="Maximum OTP attempts exceeded. Request a new OTP.",
                )

            attempts_left = settings.OTP_MAX_ATTEMPTS - updated_attempts
            raise AppException(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="OTP_MISMATCH",
                message="Incorrect OTP code.",
                details={"attempts_left": attempts_left},
            )

        await self.otp_repository.mark_otp_used(otp_id)
