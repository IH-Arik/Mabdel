from __future__ import annotations

import base64
import hashlib
import secrets


from app.core.config import settings
from app.core.crypto import decrypt_value
from app.core.exceptions import AppException
from app.services.social_provider_adapters import get_social_provider_adapter


class IntegrationMixin:
    def _sanitize_integration(self, document: dict) -> dict:
        safe = self._to_public(document)
        safe.pop("access_token_encrypted", None)
        safe.pop("refresh_token_encrypted", None)
        safe.pop("user_id", None)
        # Webhook secrets authenticate the *gateway/bot* back to us - they must
        # never reach the frontend (this response is what list/catalog/connect
        # endpoints all return to the browser).
        safe.pop("whatsapp_secret_token", None)
        safe.pop("telegram_secret_token", None)
        return safe

    @staticmethod
    def _decrypt_integration_token(document: dict) -> str | None:
        encrypted = document.get("access_token_encrypted")
        return decrypt_value(encrypted) if encrypted else None

    def _serialize_integration(self, document: dict, metadata: dict | None = None) -> dict:
        safe = self._sanitize_integration(document)
        meta = metadata or self._integration_metadata(safe.get("platform"))
        connected = safe.get("status") == "connected"
        if safe.get("platform") == "whatsapp" and connected:
            # Read before sanitizing hides the credentials: a token means the official API.
            safe["connection_mode"] = "official" if document.get("access_token_encrypted") else "qr"
        adapter = get_social_provider_adapter(safe.get("platform") or "")
        safe["connected"] = connected
        safe["platform_label"] = meta["platform_label"]
        safe["description"] = meta["description"]
        safe["icon_key"] = meta["icon_key"]
        safe["brand_color"] = meta["brand_color"]
        safe["auth_mode"] = meta["auth_mode"]
        safe["is_available"] = meta["is_available"]
        safe["is_configured"] = meta["is_configured"]
        safe["sync_status"] = safe.get("sync_status") or "idle"
        safe["last_sync_at"] = safe.get("last_sync_at")
        safe["last_error"] = safe.get("last_error")
        safe["message_sync_enabled"] = bool(safe.get("message_sync_enabled", adapter.supports_webhooks or adapter.supports_recent_sync))
        safe["webhook_status"] = safe.get("webhook_status") or ("configured" if connected and adapter.supports_webhooks else "not_configured")
        safe["external_account_name"] = safe.get("external_account_name")
        needs_reauth = connected and safe.get("sync_status") == "needs_reauth"
        if not meta["is_configured"]:
            health_status = "misconfigured"
        elif needs_reauth:
            health_status = "needs_reauth"
        elif connected and safe.get("sync_status") == "error":
            health_status = "error"
        elif connected:
            health_status = "connected"
        else:
            health_status = "disconnected"
        safe["health_status"] = health_status
        if needs_reauth:
            safe["cta_label"] = "Reconnect"
        elif connected:
            safe["cta_label"] = "Connected"
        else:
            safe["cta_label"] = "Connect" if meta["is_configured"] else "Unavailable"
        return safe

    def _integration_metadata(self, platform: str | None) -> dict:
        for item in self._integration_catalog_metadata():
            if item["platform"] == platform:
                return item
        return {
            "platform": platform or "unknown",
            "platform_label": "Unknown",
            "description": "",
            "icon_key": platform or "unknown",
            "brand_color": "#64748B",
            "auth_mode": "oauth",
            "is_available": False,
            "is_configured": False,
        }

    def _integration_catalog_metadata(self) -> list[dict]:
        return [
            {
                "platform": "facebook_messenger",
                "platform_label": "Facebook",
                "description": "Manage page posts and messenger leads.",
                "icon_key": "facebook",
                "brand_color": "#1877F2",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.META_CLIENT_ID and settings.META_CLIENT_SECRET),
            },
            {
                "platform": "instagram",
                "platform_label": "Instagram",
                "description": "Sync visual content and DMs.",
                "icon_key": "instagram",
                "brand_color": "#E4405F",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.INSTAGRAM_APP_ID and settings.INSTAGRAM_APP_SECRET),
            },
            {
                "platform": "whatsapp",
                "platform_label": "WhatsApp",
                "description": "Customer service and automated replies.",
                "icon_key": "whatsapp",
                "brand_color": "#25D366",
                "auth_mode": "manual",
                "is_available": True,
                "is_configured": True,
            },
            {
                "platform": "google_business",
                "platform_label": "Google Business",
                "description": "Connect your business listing and messages.",
                "icon_key": "google",
                "brand_color": "#4285F4",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET),
            },
            {
                "platform": "zoom",
                "platform_label": "Zoom Calendar",
                "description": "Sync meetings and generate real Zoom Meeting links.",
                "icon_key": "zoom",
                "brand_color": "#2D8CFF",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.ZOOM_CLIENT_ID and settings.ZOOM_CLIENT_SECRET),
            },
            {
                "platform": "zoho",
                "platform_label": "Zoho Mail",
                "description": "Send bulk email from your own Zoho-hosted mailbox instead of a shared domain.",
                "icon_key": "zoho",
                "brand_color": "#E42527",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.ZOHO_CLIENT_ID and settings.ZOHO_CLIENT_SECRET),
            },
            {
                "platform": "microsoft",
                "platform_label": "Microsoft 365",
                "description": "Send bulk email from your Outlook mailbox and sync your Outlook Calendar.",
                "icon_key": "microsoft",
                "brand_color": "#0078D4",
                "auth_mode": "oauth",
                "is_available": True,
                # No tenant ID needed here — the app is multi-tenant, so any
                # customer's own Microsoft 365 org can connect (see
                # _oauth_provider("microsoft") for why).
                "is_configured": bool(settings.MICROSOFT_CLIENT_ID and settings.MICROSOFT_CLIENT_SECRET),
            },
            {
                "platform": "linkedin",
                "platform_label": "LinkedIn",
                "description": "B2B outreach and company updates.",
                "icon_key": "linkedin",
                "brand_color": "#0A66C2",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.LINKEDIN_CLIENT_ID and settings.LINKEDIN_CLIENT_SECRET),
            },
            {
                "platform": "twitter_x",
                "platform_label": "Twitter (X)",
                "description": "Real-time engagement and support.",
                "icon_key": "x",
                "brand_color": "#111111",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.TWITTER_CLIENT_ID and settings.TWITTER_CLIENT_SECRET),
            },
            {
                "platform": "snapchat",
                "platform_label": "Snapchat",
                "description": "Sync allowed Public Profile collaboration messages.",
                "icon_key": "snapchat",
                "brand_color": "#FFFC00",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.SNAPCHAT_CLIENT_ID and settings.SNAPCHAT_CLIENT_SECRET),
            },
            {
                "platform": "telegram",
                "platform_label": "Telegram",
                "description": "Broadcast news and direct support.",
                "icon_key": "telegram",
                "brand_color": "#229ED9",
                "auth_mode": "manual",
                "is_available": True,
                "is_configured": True,
            },
            {
                "platform": "threads",
                "platform_label": "Threads",
                "description": "Publish posts and manage replies.",
                "icon_key": "threads",
                "brand_color": "#101010",
                "auth_mode": "oauth",
                "is_available": True,
                "is_configured": bool(settings.THREADS_APP_ID and settings.THREADS_APP_SECRET),
            },
        ]

    @staticmethod
    def _oauth_provider(platform: str) -> dict:
        providers = {
            "google_business": {
                "provider": "google",
                "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
                "token_url": "https://oauth2.googleapis.com/token",
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/google_business/oauth/callback",
                "scopes": [
                    "https://www.googleapis.com/auth/calendar",
                    "https://www.googleapis.com/auth/userinfo.email",
                ],
                "token_payload": {"grant_type": "authorization_code"},
                "extra_authorize_params": {"access_type": "offline", "prompt": "consent"},
            },
            "zoom": {
                "provider": "zoom",
                "authorize_url": "https://zoom.us/oauth/authorize",
                "token_url": "https://zoom.us/oauth/token",
                "client_id": settings.ZOOM_CLIENT_ID,
                "client_secret": settings.ZOOM_CLIENT_SECRET,
                "redirect_uri": settings.ZOOM_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/zoom/oauth/callback",
                "scopes": ["meeting:write:meeting", "meeting:read:meeting", "user:read:user"],
                "token_payload": {"grant_type": "authorization_code"},
                "extra_authorize_params": {},
                # Zoom's token endpoint requires client credentials as an HTTP Basic
                # Auth header, not body params — every other provider here uses body params.
                "token_auth": "basic",
            },
            "zoho": {
                "provider": "zoho",
                "authorize_url": "https://accounts.zoho.com/oauth/v2/auth",
                "token_url": "https://accounts.zoho.com/oauth/v2/token",
                "client_id": settings.ZOHO_CLIENT_ID,
                "client_secret": settings.ZOHO_CLIENT_SECRET,
                "redirect_uri": settings.ZOHO_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/zoho/oauth/callback",
                "scopes": ["ZohoMail.messages.CREATE", "ZohoMail.accounts.READ"],
                "token_payload": {"grant_type": "authorization_code"},
                # access_type=offline is required to get a refresh_token back at all;
                # prompt=consent forces Zoho to reissue one even on a repeat connect
                # (otherwise a second consent can come back with no refresh_token).
                "extra_authorize_params": {"access_type": "offline", "prompt": "consent"},
            },
            "microsoft": {
                "provider": "microsoft",
                # "organizations" (not a specific tenant ID) so ANY GoCustify customer
                # can connect their own Microsoft 365 org — matches the multi-tenant
                # SaaS pattern already used for Google/Zoom/Zoho. This requires the
                # Azure AD app registration itself to be set to multi-tenant
                # ("Accounts in any organizational directory") rather than the
                # single-tenant default — a single-tenant app rejects every user who
                # isn't a member of that one specific tenant (AADSTS50020).
                "authorize_url": "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
                "token_url": "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
                "client_id": settings.MICROSOFT_CLIENT_ID,
                "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                "redirect_uri": settings.MICROSOFT_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/microsoft/oauth/callback",
                # One consent covers both bulk email sending (Mail.Send) and Outlook
                # Calendar sync (Calendars.ReadWrite) — a single Azure AD app
                # registration backs both features, so there is one stored
                # integration record used by both MicrosoftMailService and
                # MicrosoftCalendarService, not two separate OAuth connections.
                "scopes": [
                    "offline_access",
                    "https://graph.microsoft.com/Mail.Send",
                    "https://graph.microsoft.com/Calendars.ReadWrite",
                    "https://graph.microsoft.com/User.Read",
                ],
                "token_payload": {"grant_type": "authorization_code"},
                # offline_access is required to get a refresh_token back at all —
                # Microsoft omits it otherwise, exactly like Zoho's
                # access_type=offline behavior.
                "extra_authorize_params": {},
            },
            # Instagram DMs use "Instagram API with Instagram Login" (Meta's current path):
            # Instagram's own authorize/token hosts and app credentials, and
            # instagram_business_* scopes. Facebook Login is not used for Instagram.
            "instagram": {
                "provider": "instagram_login",
                "authorize_url": "https://www.instagram.com/oauth/authorize",
                "token_url": "https://api.instagram.com/oauth/access_token",
                "client_id": settings.INSTAGRAM_APP_ID,
                "client_secret": settings.INSTAGRAM_APP_SECRET,
                "redirect_uri": settings.META_INSTAGRAM_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/instagram/oauth/callback",
                "scopes": ["instagram_business_basic", "instagram_business_manage_messages"],
                "token_payload": {"grant_type": "authorization_code"},
                "extra_authorize_params": {},
            },
            "facebook_messenger": {
                "provider": "meta",
                "authorize_url": f"https://www.facebook.com/{settings.META_GRAPH_VERSION}/dialog/oauth",
                "token_url": f"https://graph.facebook.com/{settings.META_GRAPH_VERSION}/oauth/access_token",
                "client_id": settings.META_CLIENT_ID,
                "client_secret": settings.META_CLIENT_SECRET,
                "redirect_uri": settings.META_MESSENGER_REDIRECT_URI or settings.META_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/facebook_messenger/oauth/callback",
                "scopes": ["pages_show_list", "pages_messaging", "pages_manage_metadata"],
                "token_payload": {},
                "extra_authorize_params": {},
            },
            # Official Meta WhatsApp Business Platform. The other way to connect
            # WhatsApp is the unofficial Baileys QR gateway (start_whatsapp_connect);
            # an organization uses one or the other, never both at once.
            "whatsapp": {
                "provider": "meta",
                "authorize_url": f"https://www.facebook.com/{settings.META_GRAPH_VERSION}/dialog/oauth",
                "token_url": f"https://graph.facebook.com/{settings.META_GRAPH_VERSION}/oauth/access_token",
                "client_id": settings.META_CLIENT_ID,
                "client_secret": settings.META_CLIENT_SECRET,
                "redirect_uri": settings.META_WHATSAPP_REDIRECT_URI or settings.META_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/whatsapp/oauth/callback",
                "scopes": ["whatsapp_business_messaging", "whatsapp_business_management"],
                "token_payload": {},
                "extra_authorize_params": {},
            },
            "linkedin": {
                "provider": "linkedin",
                "authorize_url": "https://www.linkedin.com/oauth/v2/authorization",
                "token_url": "https://www.linkedin.com/oauth/v2/accessToken",
                "client_id": settings.LINKEDIN_CLIENT_ID,
                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
                "redirect_uri": settings.LINKEDIN_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/linkedin/oauth/callback",
                "scopes": ["openid", "profile", "email", "w_member_social"],
                "token_payload": {"grant_type": "authorization_code"},
                "extra_authorize_params": {},
            },
            "twitter_x": {
                "provider": "twitter",
                "authorize_url": "https://twitter.com/i/oauth2/authorize",
                "token_url": "https://api.twitter.com/2/oauth2/token",
                "client_id": settings.TWITTER_CLIENT_ID,
                "client_secret": settings.TWITTER_CLIENT_SECRET,
                "redirect_uri": settings.TWITTER_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/twitter_x/oauth/callback",
                "scopes": ["tweet.read", "users.read", "offline.access"],
                "token_payload": {"grant_type": "authorization_code"},
                "extra_authorize_params": {},
            },
            "snapchat": {
                "provider": "snapchat",
                "authorize_url": "https://accounts.snapchat.com/login/oauth2/authorize",
                "token_url": "https://accounts.snapchat.com/login/oauth2/access_token",
                "client_id": settings.SNAPCHAT_CLIENT_ID,
                "client_secret": settings.SNAPCHAT_CLIENT_SECRET,
                "redirect_uri": settings.SNAPCHAT_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/snapchat/oauth/callback",
                "scopes": ["snapchat-marketing-api"],
                "token_payload": {"grant_type": "authorization_code"},
                "extra_authorize_params": {},
            },
            "threads": {
                "provider": "threads",
                "authorize_url": "https://www.threads.net/oauth/authorize",
                "token_url": "https://graph.threads.net/oauth/access_token",
                "client_id": settings.THREADS_APP_ID,
                "client_secret": settings.THREADS_APP_SECRET,
                "redirect_uri": settings.THREADS_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/integrations/threads/oauth/callback",
                "scopes": ["threads_basic"],
                "token_payload": {"grant_type": "authorization_code"},
                "extra_authorize_params": {},
            },
        }
        provider = providers.get(platform)
        if not provider:
            raise AppException(status_code=400, code="INTEGRATION_UNSUPPORTED", message="This integration is not supported yet.")
        if not provider["client_id"] or not provider["client_secret"]:
            raise AppException(
                status_code=503,
                code="INTEGRATION_NOT_CONFIGURED",
                message="This integration is not configured yet.",
                details={"platform": platform},
            )
        return provider

    @staticmethod
    def _twitter_pkce_authorize_params(code_verifier: str) -> dict[str, str]:
        digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
        code_challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
        return {
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }

