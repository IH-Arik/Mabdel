from __future__ import annotations

from datetime import datetime, timedelta

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.exceptions import AppException
from app.utils.helpers import resolve_team_user_ids, utc_now


class MicrosoftMailService:
    """Alternative to the Resend-provisioned business domain (see
    ``EmailDomainService``): a business that already hosts its mailbox on
    Microsoft 365 / Outlook connects that real mailbox via OAuth (Microsoft
    Graph), and bulk email sends go out through it directly.

    Same single Azure AD app registration (single-tenant) also backs Outlook
    Calendar sync (see ``MicrosoftCalendarService``) — both share one connected
    ``social_integrations`` record (``platform: "microsoft"``), since the OAuth
    consent requests both Mail.Send and Calendars.ReadWrite scopes together in
    a single grant, exactly like Zoho's single mail-only connection.

    Microsoft's token endpoint takes client credentials in the request body
    (like Zoho, unlike Zoom's Basic Auth requirement) — verified against
    Microsoft's own identity platform docs."""

    GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
    ME_URL = "https://graph.microsoft.com/v1.0/me"
    SEND_MAIL_URL = "https://graph.microsoft.com/v1.0/me/sendMail"

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    @staticmethod
    def token_url() -> str:
        # "organizations", not a specific tenant — see _oauth_provider("microsoft")
        # in _base.py for why (multi-tenant SaaS: any customer's own Microsoft 365).
        return "https://login.microsoftonline.com/organizations/oauth2/v2.0/token"

    async def get_connected_integration(self, user_id: str) -> dict | None:
        """Prefer the user's own connected Microsoft 365 account; fall back to
        any teammate's so the whole organization shares one sending mailbox —
        same precedent as ZohoMailService/GoogleCalendarService."""
        own = await self.db.social_integrations.find_one({"user_id": user_id, "platform": "microsoft", "status": "connected"})
        if own:
            return own
        team_ids = await resolve_team_user_ids(self.db, user_id)
        if len(team_ids) <= 1:
            return None
        return await self.db.social_integrations.find_one({"user_id": {"$in": team_ids}, "platform": "microsoft", "status": "connected"})

    async def ensure_access_token(self, integration: dict) -> tuple[str, dict]:
        expires_at = integration.get("access_token_expires_at")
        if not isinstance(expires_at, datetime):
            return await self.refresh_access_token(integration)
        threshold = utc_now() + timedelta(seconds=60)
        comparable_threshold = threshold if expires_at.tzinfo else threshold.replace(tzinfo=None)
        if expires_at <= comparable_threshold:
            return await self.refresh_access_token(integration)
        access_token = decrypt_value(integration["access_token_encrypted"])
        return access_token, integration

    async def refresh_access_token(self, integration: dict) -> tuple[str, dict]:
        refresh_token_encrypted = integration.get("refresh_token_encrypted")
        if not refresh_token_encrypted:
            await self.db.social_integrations.update_one(
                {"_id": integration["_id"]},
                {
                    "$set": {
                        "sync_status": "needs_reauth",
                        "last_error": "Microsoft 365 access expired. Reconnect the account.",
                        "updated_at": utc_now(),
                    }
                },
            )
            raise AppException(
                status_code=401,
                code="MICROSOFT_REFRESH_TOKEN_MISSING",
                message="Microsoft 365 access expired. Reconnect the account.",
                details={"sync_status": "needs_reauth"},
            )

        refresh_token = decrypt_value(refresh_token_encrypted)
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "client_secret": settings.MICROSOFT_CLIENT_SECRET,
            "scope": " ".join(
                [
                    "offline_access",
                    "https://graph.microsoft.com/Mail.Send",
                    "https://graph.microsoft.com/Calendars.ReadWrite",
                    "https://graph.microsoft.com/User.Read",
                ]
            ),
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.token_url(), data=payload, headers={"Accept": "application/json"})

        if response.status_code >= 400:
            await self.db.social_integrations.update_one(
                {"_id": integration["_id"]},
                {
                    "$set": {
                        "sync_status": "needs_reauth",
                        "last_error": "Microsoft 365 refresh token was rejected. Reconnect the account.",
                        "updated_at": utc_now(),
                    }
                },
            )
            raise AppException(
                status_code=401,
                code="MICROSOFT_TOKEN_REFRESH_FAILED",
                message="Microsoft 365 refresh token was rejected. Reconnect the account.",
                details={"sync_status": "needs_reauth", "provider_status": response.status_code},
            )

        token_data = response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise AppException(
                status_code=502,
                code="MICROSOFT_ACCESS_TOKEN_MISSING",
                message="Microsoft did not return a refreshed access token.",
                details={"sync_status": "error"},
            )

        expires_in = int(token_data.get("expires_in") or 3600)
        access_token_expires_at = utc_now() + timedelta(seconds=expires_in)
        updated = await self.db.social_integrations.find_one_and_update(
            {"_id": integration["_id"]},
            {
                "$set": {
                    "access_token_encrypted": encrypt_value(access_token),
                    **(
                        {"refresh_token_encrypted": encrypt_value(token_data["refresh_token"])}
                        if token_data.get("refresh_token")
                        else {}
                    ),
                    "access_token_expires_at": access_token_expires_at,
                    "sync_status": "idle",
                    "last_error": None,
                    "updated_at": utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return access_token, updated or integration

    async def fetch_account_context(self, access_token: str) -> dict:
        """GET /v1.0/me — returns the connected mailbox's address (falling back to
        userPrincipalName when ``mail`` is null, which happens for some tenant
        configurations) and display name."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                self.ME_URL,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json",
                    # Precautionary, mirroring the fix that Zoho's equivalent call
                    # needed — Graph is less picky about this, but there's no
                    # downside to sending both headers.
                    "Content-Type": "application/json",
                },
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="MICROSOFT_ME_FAILED",
                message="Microsoft 365 account could not be loaded.",
                details={"provider_status": response.status_code, "provider_body": response.text[:500]},
            )
        data = response.json() or {}
        return {
            "email": data.get("mail") or data.get("userPrincipalName"),
            "display_name": data.get("displayName"),
        }

    async def send_email(
        self,
        user_id: str,
        *,
        to: str,
        subject: str,
        html: str,
        text: str | None = None,
        reply_to: str | None = None,
    ) -> bool:
        """Sends through the organization's connected Microsoft 365 mailbox.
        Returns False (rather than raising) when nothing is connected, so
        callers can fall back to the platform's default sender."""
        integration = await self.get_connected_integration(user_id)
        if not integration:
            return False
        access_token, current_integration = await self.ensure_access_token(integration)
        provider_metadata = current_integration.get("provider_metadata") or {}
        from_address = provider_metadata.get("email")
        if not from_address:
            return False

        message: dict = {
            "subject": subject,
            "body": {"contentType": "HTML" if html else "Text", "content": html or text or ""},
            "toRecipients": [{"emailAddress": {"address": to}}],
        }
        if reply_to and reply_to != from_address:
            message["replyTo"] = [{"emailAddress": {"address": reply_to}}]

        body = {"message": message, "saveToSentItems": True}

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.SEND_MAIL_URL,
                json=body,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
        # Graph returns 202 Accepted with an empty body on success — not 200.
        if response.status_code != 202:
            raise AppException(
                status_code=502,
                code="MICROSOFT_SEND_FAILED",
                message="Microsoft 365 could not send the message.",
                details={"provider_status": response.status_code, "response": response.text[:300]},
            )
        return True
