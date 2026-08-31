from __future__ import annotations

from datetime import datetime, timedelta

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.exceptions import AppException
from app.utils.helpers import resolve_team_user_ids, utc_now


class ZohoMailService:
    """Alternative to the Resend-provisioned business domain (see
    ``EmailDomainService``): a business that already hosts its domain's mail on
    Zoho connects that real mailbox via OAuth, and bulk email sends go out through
    it directly — no DNS records to add, since the domain is already Zoho's to
    begin with.

    Zoho's token endpoint takes client credentials in the request body (unlike
    Zoom's Basic Auth requirement) — verified against Zoho's own OAuth docs."""

    BASE_URL = "https://mail.zoho.com/api"
    ACCOUNTS_URL = "https://mail.zoho.com/api/accounts"
    TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token"

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def get_connected_integration(self, user_id: str) -> dict | None:
        """Prefer the user's own connected Zoho Mail account; fall back to any
        teammate's so the whole organization shares one sending mailbox — same
        precedent as GoogleCalendarService/ZoomCalendarService."""
        own = await self.db.social_integrations.find_one({"user_id": user_id, "platform": "zoho", "status": "connected"})
        if own:
            return own
        team_ids = await resolve_team_user_ids(self.db, user_id)
        if len(team_ids) <= 1:
            return None
        return await self.db.social_integrations.find_one({"user_id": {"$in": team_ids}, "platform": "zoho", "status": "connected"})

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
                        "last_error": "Zoho Mail access expired. Reconnect the account.",
                        "updated_at": utc_now(),
                    }
                },
            )
            raise AppException(
                status_code=401,
                code="ZOHO_REFRESH_TOKEN_MISSING",
                message="Zoho Mail access expired. Reconnect the account.",
                details={"sync_status": "needs_reauth"},
            )

        refresh_token = decrypt_value(refresh_token_encrypted)
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings.ZOHO_CLIENT_ID,
            "client_secret": settings.ZOHO_CLIENT_SECRET,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.TOKEN_URL, data=payload, headers={"Accept": "application/json"})

        if response.status_code >= 400:
            await self.db.social_integrations.update_one(
                {"_id": integration["_id"]},
                {
                    "$set": {
                        "sync_status": "needs_reauth",
                        "last_error": "Zoho Mail refresh token was rejected. Reconnect the account.",
                        "updated_at": utc_now(),
                    }
                },
            )
            raise AppException(
                status_code=401,
                code="ZOHO_TOKEN_REFRESH_FAILED",
                message="Zoho Mail refresh token was rejected. Reconnect the account.",
                details={"sync_status": "needs_reauth", "provider_status": response.status_code},
            )

        token_data = response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise AppException(
                status_code=502,
                code="ZOHO_ACCESS_TOKEN_MISSING",
                message="Zoho did not return a refreshed access token.",
                details={"sync_status": "error"},
            )

        expires_in = int(token_data.get("expires_in") or 3600)
        access_token_expires_at = utc_now() + timedelta(seconds=expires_in)
        updated = await self.db.social_integrations.find_one_and_update(
            {"_id": integration["_id"]},
            {
                "$set": {
                    "access_token_encrypted": encrypt_value(access_token),
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
        """GET /api/accounts — returns the connected user's Zoho Mail account(s).
        We need the accountId (used in the send-mail path) plus the mailbox address
        it corresponds to, distinct from the OAuth-authenticating user's login email."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                self.ACCOUNTS_URL, headers={"Authorization": f"Zoho-oauthtoken {access_token}", "Accept": "application/json"}
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="ZOHO_ACCOUNTS_FAILED",
                message="Zoho Mail account could not be loaded.",
                details={"provider_status": response.status_code, "provider_body": response.text[:500]},
            )
        accounts = (response.json() or {}).get("data") or []
        if not accounts:
            raise AppException(
                status_code=502,
                code="ZOHO_ACCOUNTS_EMPTY",
                message="No Zoho Mail account found for this login.",
            )
        primary = next((item for item in accounts if item.get("isDefault")), accounts[0])
        send_mail_details = (primary.get("sendMailDetails") or [{}])[0]
        return {
            "account_id": primary.get("accountId"),
            "email": send_mail_details.get("fromAddress") or primary.get("primaryEmailAddress"),
            "display_name": send_mail_details.get("displayName") or primary.get("displayName"),
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
        """Sends through the organization's connected Zoho Mail account. Returns
        False (rather than raising) when nothing is connected, so callers can fall
        back to the platform's default sender — this is an opt-in alternative
        sending path, not a hard requirement."""
        integration = await self.get_connected_integration(user_id)
        if not integration:
            return False
        access_token, current_integration = await self.ensure_access_token(integration)
        provider_metadata = current_integration.get("provider_metadata") or {}
        account_id = provider_metadata.get("account_id")
        from_address = provider_metadata.get("email")
        if not account_id or not from_address:
            return False

        body = {
            "fromAddress": from_address,
            "toAddress": to,
            "subject": subject,
            "content": html or text or "",
            "mailFormat": "html" if html else "plaintext",
        }
        if reply_to and reply_to != from_address:
            # Zoho Mail's send API has no explicit reply-to field — approximate it
            # by CC'ing is wrong, so this is intentionally left unset rather than
            # silently sending from an address the caller didn't ask for.
            pass

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.BASE_URL}/accounts/{account_id}/messages",
                json=body,
                headers={
                    "Authorization": f"Zoho-oauthtoken {access_token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="ZOHO_SEND_FAILED",
                message="Zoho Mail could not send the message.",
                details={"provider_status": response.status_code, "response": response.text[:300]},
            )
        return True
