from __future__ import annotations

from app.core.exceptions import AppException
from app.services.call_phrases import SUPPORTED_LANGUAGES
from app.utils.helpers import utc_now

from ._base import SmartFlowBase

# Reading out eleven options would be absurd on a real call, and there are only so
# many keys a caller will listen through before giving up.
MAX_LANGUAGE_MENU_OPTIONS = 4
MAX_CUSTOM_INSTRUCTIONS_CHARS = 2000
MAX_GREETING_CHARS = 500


class AICallSettingsService(SmartFlowBase):
    """Per-business persona for the AI phone agent.

    Stored on the ``organizations`` document beside ``business_hours``, and read the
    same way (merge over defaults), so a business that has never opened the settings
    screen still behaves exactly as it did before this feature existed.
    """

    DEFAULT_AI_CALL_SETTINGS = {
        "assistant_name": None,
        "voice_id": "female_warm",
        "business_type": None,
        "custom_instructions": None,
        "greeting_inbound": None,
        "greeting_outbound": None,
        "language_menu_enabled": False,
        "language_menu": [],
    }

    async def get_settings(self, user_id: str) -> dict:
        organization_id = await self._resolve_organization_id(user_id)
        org = await self.db.organizations.find_one({"organization_id": organization_id}) if organization_id else None
        return self.merge_settings((org or {}).get("ai_call_settings"))

    @classmethod
    def merge_settings(cls, stored: dict | None) -> dict:
        return {**cls.DEFAULT_AI_CALL_SETTINGS, **(stored or {})}

    async def get_settings_for_organization(self, organization_id: str | None) -> dict:
        """Used on a live call, where the organization is already resolved."""
        if not organization_id:
            return self.merge_settings(None)
        org = await self.db.organizations.find_one({"organization_id": organization_id})
        return self.merge_settings((org or {}).get("ai_call_settings"))

    async def update_settings(self, user_id: str, payload: dict) -> dict:
        organization_id = await self._resolve_organization_id(user_id)
        if not organization_id:
            raise AppException(
                status_code=422,
                code="NO_ORGANIZATION",
                message="Your account isn't part of an organization yet.",
            )

        current = await self.get_settings(user_id)
        # Only keys the caller actually sent are applied, so a PATCH of one field
        # never silently blanks the rest. None is a meaningful value here — it clears
        # a custom greeting back to the built-in one — so it is not filtered out.
        merged = {**current, **payload}
        merged["language_menu"] = self._validate_language_menu(merged.get("language_menu"))

        await self.db.organizations.update_one(
            {"organization_id": organization_id},
            {
                "$set": {"ai_call_settings": merged, "updated_at": utc_now()},
                "$setOnInsert": {"organization_id": organization_id, "created_at": utc_now()},
            },
            upsert=True,
        )
        return merged

    @staticmethod
    def _validate_language_menu(menu: list | None) -> list[dict]:
        """Keeps the menu playable: real digits, supported languages, no duplicate
        keys (a caller pressing 1 must map to exactly one language)."""
        if not menu:
            return []
        cleaned: list[dict] = []
        seen_digits: set[str] = set()
        for entry in menu:
            if not isinstance(entry, dict):
                continue
            digit = str(entry.get("digit") or "").strip()
            language = str(entry.get("language") or "").strip().lower()
            if digit not in {"1", "2", "3", "4", "5", "6", "7", "8", "9"}:
                continue
            if language not in SUPPORTED_LANGUAGES:
                continue
            if digit in seen_digits:
                continue
            seen_digits.add(digit)
            cleaned.append({"digit": digit, "language": language})
            if len(cleaned) >= MAX_LANGUAGE_MENU_OPTIONS:
                break
        return cleaned
