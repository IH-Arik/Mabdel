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

    async def send_business_email(
        self,
        *,
        email: str,
        subject: str,
        text: str,
        html: str,
        from_email: str | None = None,
        from_name: str | None = None,
        reply_to: str | None = None,
        headers: dict | None = None,
        sender_provider: str | None = None,
        sender_user_id: str | None = None,
        db=None,
    ) -> None:
        """Send from an organization's own verified domain when one is set up.

        Falls back to the platform sender when ``from_email`` is None, so callers
        can pass the resolved sender straight through without branching.

        ``sender_provider``/``sender_user_id``/``db`` come from
        ``EmailDomainService.resolve_sender`` — when the sender resolved to a
        connected Zoho Mail account (``sender_provider == "zoho"``) or a
        connected Microsoft 365/Outlook account (``sender_provider ==
        "microsoft"``), this routes through that provider's own send API
        instead of Resend/SMTP, since that mailbox lives on the provider's own
        infrastructure, not ours.
        """
        if sender_provider == "zoho" and sender_user_id and db is not None:
            from app.services.email_domain.zoho_mail_service import ZohoMailService

            sent = await ZohoMailService(db).send_email(
                sender_user_id,
                to=email,
                subject=subject,
                html=html,
                text=text,
                reply_to=reply_to,
            )
            if sent:
                return
            # Connection vanished between resolve and send (disconnected mid-flight,
            # token unrecoverable) — fall through to the platform default rather
            # than losing the message.

        if sender_provider == "microsoft" and sender_user_id and db is not None:
            from app.services.email_domain.microsoft_mail_service import MicrosoftMailService

            sent = await MicrosoftMailService(db).send_email(
                sender_user_id,
                to=email,
                subject=subject,
                html=html,
                text=text,
                reply_to=reply_to,
            )
            if sent:
                return
            # Same fallback rationale as the Zoho branch above.

        await self._send_email(
            email=email,
            subject=subject,
            text=text,
            html=html,
            from_email=from_email,
            from_name=from_name,
            reply_to=reply_to,
            headers=headers,
        )

    async def send_subordinate_credentials_email(self, email: str, login_email: str, password: str, role: str) -> None:
        subject = f"Your GoCustify AI {role.capitalize()} Credentials"

        text = f"Welcome to GoCustify AI! You have been granted access as a {role}.\n\n" \
               f"Your login email: {login_email}\n" \
               f"Your temporary password: {password}\n\n" \
               f"You can change this password later from your profile settings."

        html = f"""
        <html>
            <body>
                <h2>Welcome to GoCustify AI!</h2>
                <p>You have been granted access as a <strong>{role}</strong>.</p>
                <p><strong>Your login email:</strong> {login_email}</p>
                <p><strong>Your temporary password:</strong> {password}</p>
                <br/>
                <p><em>You can change this password later from your profile settings.</em></p>
            </body>
        </html>
        """
        
        await self._send_email(email=email, subject=subject, text=text, html=html)

    async def send_otp_email(self, email: str, otp_code: str, purpose: str) -> None:
        subject = "Your GoCustify verification code"
        if purpose == "forgot_password":
            subject = "Your GoCustify password reset code"

        html = self._build_otp_template(otp_code=otp_code, purpose=purpose)
        text = f"Your OTP code is {otp_code}. It expires in {settings.OTP_EXPIRE_MINUTES} minutes."

        await self._send_email(email=email, subject=subject, text=text, html=html)

    async def _send_email(
        self,
        *,
        email: str,
        subject: str,
        text: str,
        html: str,
        from_email: str | None = None,
        from_name: str | None = None,
        reply_to: str | None = None,
        headers: dict | None = None,
    ) -> None:
        sender = self._format_sender(from_email, from_name)

        # A business domain is registered with Resend, so it must go out via Resend
        # even when SMTP is configured for platform mail.
        prefer_resend = bool(from_email) and bool(settings.RESEND_API_KEY)

        if not prefer_resend and settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            await asyncio.to_thread(self._send_via_smtp, email, subject, text, html, sender, reply_to)
            return

        if settings.RESEND_API_KEY:
            resend.api_key = settings.RESEND_API_KEY
            payload: dict = {
                "from": sender,
                "to": [email],
                "subject": subject,
                "html": html,
                "text": text,
            }
            if reply_to:
                payload["reply_to"] = reply_to
            if headers:
                payload["headers"] = headers
            await asyncio.to_thread(resend.Emails.send, payload)
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
            "from": {
                "email": from_email or settings.MAIL_FROM,
                "name": from_name or settings.MAIL_FROM_NAME,
            },
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
    def _format_sender(from_email: str | None, from_name: str | None) -> str:
        address = from_email or settings.MAIL_FROM
        name = from_name or (settings.MAIL_FROM_NAME if not from_email else None)
        return f"{name} <{address}>" if name else address

    @staticmethod
    def _send_via_smtp(
        email: str,
        subject: str,
        text: str,
        html: str,
        sender: str | None = None,
        reply_to: str | None = None,
    ) -> None:
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = sender or f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
        message["To"] = email
        if reply_to:
            message["Reply-To"] = reply_to
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
          <h2 style="margin-bottom: 8px;">GoCustify AI</h2>
          <p style="margin: 0 0 12px 0;">{action_text}</p>
          <p style="margin: 0 0 8px 0;">Use this one-time code:</p>
          <div style="font-size: 28px; font-weight: 700; letter-spacing: 8px; margin: 16px 0;">{otp_code}</div>
          <p style="margin: 0;">This code expires in {settings.OTP_EXPIRE_MINUTES} minutes.</p>
        </div>
        """
