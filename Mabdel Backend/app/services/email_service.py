from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

import httpx
import resend

from app.core.config import settings
from app.core.exceptions import AppException

logger = logging.getLogger(__name__)


class EmailService:
    async def send_invoice_email(self, email: str, subject: str, text: str, html: str) -> None:
        await self._send_email(email=email, subject=subject, text=text, html=html)

    async def send_otp_email(self, email: str, otp_code: str, purpose: str) -> None:
        subject = "Your Mabdel verification code"
        if purpose == "forgot_password":
            subject = "Your Mabdel password reset code"

        html = self._build_otp_template(otp_code=otp_code, purpose=purpose)
        text = f"Your OTP code is {otp_code}. It expires in {settings.OTP_EXPIRE_MINUTES} minutes."

        await self._send_email(email=email, subject=subject, text=text, html=html)

    async def _send_email(self, *, email: str, subject: str, text: str, html: str) -> None:

        if settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            await asyncio.to_thread(self._send_via_smtp, email, subject, text, html)
            return

        if settings.RESEND_API_KEY:
            resend.api_key = settings.RESEND_API_KEY
            await asyncio.to_thread(
                resend.Emails.send,
                {
                    "from": settings.MAIL_FROM,
                    "to": [email],
                    "subject": subject,
                    "html": html,
                    "text": text,
                },
            )
            return

        if not settings.MAILTRAP_API_TOKEN:
            message = "SMTP, RESEND_API_KEY, and MAILTRAP_API_TOKEN are not set. Email delivery is unavailable."
            if settings.ENVIRONMENT.lower() != "development":
                raise AppException(
                    status_code=503,
                    code="EMAIL_DELIVERY_NOT_CONFIGURED",
                    message=message,
                )
            logger.warning("%s Email skipped for %s.", message, email)
            return

        payload = {
            "from": {"email": settings.MAIL_FROM, "name": settings.MAIL_FROM_NAME},
            "to": [{"email": email}],
            "subject": subject,
            "text": text,
            "html": html,
        }
        headers = {
            "Authorization": f"Bearer {settings.MAILTRAP_API_TOKEN}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post("https://send.api.mailtrap.io/api/send", json=payload, headers=headers)
            response.raise_for_status()

    @staticmethod
    def _send_via_smtp(email: str, subject: str, text: str, html: str) -> None:
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
        message["To"] = email
        message.set_content(text)
        message.add_alternative(html, subtype="html")

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)

    @staticmethod
    def _build_otp_template(otp_code: str, purpose: str) -> str:
        action_text = "Verify your account"
        if purpose == "forgot_password":
            action_text = "Reset your password"
        return f"""
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 16px;">
          <h2 style="margin-bottom: 8px;">Mabdel AI</h2>
          <p style="margin: 0 0 12px 0;">{action_text}</p>
          <p style="margin: 0 0 8px 0;">Use this one-time code:</p>
          <div style="font-size: 28px; font-weight: 700; letter-spacing: 8px; margin: 16px 0;">{otp_code}</div>
          <p style="margin: 0;">This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.</p>
        </div>
        """
