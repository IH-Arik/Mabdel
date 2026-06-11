from __future__ import annotations

from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.schemas.content import ContentPageResponse
from app.utils.helpers import utc_now


DEFAULT_CONTENT_PAGES: list[dict] = [
    {
        "slug": "about-us",
        "title": "About Us",
        "display_style": "numbered_list",
        "version": "1.0",
        "blocks": [
            {
                "order": 1,
                "body": "Mabdel AI brings customer messages, voice requests, documents, invoices, meetings, and business workflows into one assistant-led workspace.",
            },
            {
                "order": 2,
                "body": "The app is built for small teams and business owners who need faster follow-up, clearer records, and fewer repeated manual tasks.",
            },
            {
                "order": 3,
                "body": "SmartFlow keeps conversations, AI command history, call logs, calendar events, and notifications organized around the signed-in account.",
            },
            {
                "order": 4,
                "body": "Business profiles help teams present consistent company details across invoices, shared documents, outreach, and assistant-generated work.",
            },
            {
                "order": 5,
                "body": "Mabdel is designed with secure authentication, token-based sessions, and production APIs that mobile clients can use directly.",
            },
        ],
    },
    {
        "slug": "terms-and-conditions",
        "title": "Terms & Condition",
        "display_style": "numbered_list",
        "version": "1.0",
        "blocks": [
            {
                "order": 1,
                "body": "You are responsible for keeping your account credentials secure and for activity performed through your account.",
            },
            {
                "order": 2,
                "body": "Do not use Mabdel to send unlawful, harmful, misleading, abusive, or unsolicited content, or to interfere with the service.",
            },
            {
                "order": 3,
                "body": "You retain ownership of the business information, documents, contacts, and messages you submit to the platform.",
            },
            {
                "order": 4,
                "body": "Features, integrations, and AI outputs may change as the product improves or as third-party services update their requirements.",
            },
            {
                "order": 5,
                "body": "By continuing to use Mabdel, you agree to follow these terms and any product-specific policies shown in the app.",
            },
        ],
    },
    {
        "slug": "privacy-policy",
        "title": "Privacy Policy",
        "display_style": "numbered_list",
        "version": "1.0",
        "blocks": [
            {
                "order": 1,
                "body": "Mabdel processes account details, profile preferences, business profile data, messages, documents, call metadata, and app activity needed to provide the service.",
            },
            {
                "order": 2,
                "body": "We use data to authenticate users, power SmartFlow workflows, deliver notifications, maintain account settings, and improve reliability.",
            },
            {
                "order": 3,
                "body": "When you connect third-party services, Mabdel stores the integration status and protected tokens required to perform requested actions.",
            },
            {
                "order": 4,
                "body": "Notification and support preferences are used to personalize your app experience and reduce unwanted alerts.",
            },
            {
                "order": 5,
                "body": "Deleting your account removes your profile and associated SmartFlow records from active application collections.",
            },
        ],
    },
    {
        "slug": "help-support",
        "title": "Help & Support",
        "display_style": "sections",
        "version": "1.0",
        "blocks": [
            {
                "order": 1,
                "heading": "Getting Help",
                "body": "Use the support ticket endpoint to send product questions, technical issues, billing questions, or account requests to the support team.",
            },
            {
                "order": 2,
                "heading": "Before You Report",
                "body": "Include the screen, action, expected result, actual result, and any safe-to-share context that helps reproduce the issue.",
            },
        ],
    },
]


class ContentService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def ensure_defaults(self) -> None:
        now = utc_now()
        for page in DEFAULT_CONTENT_PAGES:
            await self.db.content_pages.update_one(
                {"slug": page["slug"]},
                {
                    "$setOnInsert": {
                        **page,
                        "created_at": now,
                        "updated_at": now,
                        "is_active": True,
                    }
                },
                upsert=True,
            )

    async def get_page(self, slug: str) -> ContentPageResponse:
        await self.ensure_defaults()
        normalized_slug = slug.lower().strip()
        page = await self.db.content_pages.find_one({"slug": normalized_slug, "is_active": True})
        if not page:
            raise AppException(status_code=404, code="CONTENT_PAGE_NOT_FOUND", message="Requested content page was not found.")
        return self._to_response(page)

    async def upsert_page(self, page: dict) -> ContentPageResponse:
        now = utc_now()
        updated = await self.db.content_pages.find_one_and_update(
            {"slug": page["slug"]},
            {
                "$set": {
                    **page,
                    "is_active": page.get("is_active", True),
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return self._to_response(updated)

    @staticmethod
    def _to_response(page: dict) -> ContentPageResponse:
        updated_at = page.get("updated_at")
        if not isinstance(updated_at, datetime):
            updated_at = utc_now()
        return ContentPageResponse(
            slug=page["slug"],
            title=page["title"],
            display_style=page.get("display_style", "sections"),
            version=page.get("version", "1.0"),
            blocks=sorted(page.get("blocks", []), key=lambda item: item.get("order", 0)),
            updated_at=updated_at,
        )
