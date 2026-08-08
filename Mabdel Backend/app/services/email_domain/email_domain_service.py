"""Business email domains.

Each organization can claim one sending domain. Two flavours:

* **subdomain** — ``<slug>.<EMAIL_DOMAIN_ROOT>`` (e.g. ``dentist.gocustify.com``).
  We own the zone, so with the Route53 backend the DNS records are written for
  the owner and the domain activates without them touching anything.
* **custom** — the owner's own domain (e.g. ``dentist.com``). We cannot write to
  that zone, so the required records are returned for them to add.

Once verified the domain is a catch-all: the owner can send from *any* local
part (``market@``, ``invoice@``, …) without registering it first, and anything
sent *to* the domain arrives on the Resend inbound webhook and is ingested into
Unified Conversations.
"""

from __future__ import annotations

import asyncio
import logging
import re

import resend
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.exceptions import AppException
from app.utils.helpers import utc_now

from .dns_providers import DnsRecord, get_dns_provider

logger = logging.getLogger(__name__)

# DNS labels: letters, digits and inner hyphens only.
_SLUG_STRIP_RE = re.compile(r"[^a-z0-9]+")
_DOMAIN_RE = re.compile(r"^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$")
_LOCAL_PART_RE = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$")

# Slugs we keep for platform infrastructure so an owner can never claim them.
RESERVED_SLUGS = {
    "admin", "api", "app", "auth", "billing", "blog", "cdn", "dashboard", "dev",
    "docs", "ftp", "help", "imap", "internal", "login", "mail", "mx", "ns",
    "ns1", "ns2", "pop", "root", "security", "smtp", "staging", "static",
    "status", "support", "system", "test", "webmail", "www",
}

# Local parts reserved by RFC 2142 / abuse handling.
RESERVED_LOCAL_PARTS = {"abuse", "postmaster"}

DOMAIN_STATUSES = {"pending", "verifying", "verified", "failed"}


class EmailDomainService:
    """Provisioning and lookup for organization sending domains."""

    def __init__(self, db) -> None:
        self.db = db

    # ── lookup ────────────────────────────────────────────────────────────

    async def get_domain_for_user(self, user: dict) -> dict | None:
        """The organization's domain (org-wide, shared across the team)."""
        query = self._org_scope(user)
        return await self.db.email_domains.find_one(query)

    async def get_domain_by_user_id(self, user_id: str) -> dict | None:
        user = await self._load_user(user_id)
        if not user:
            return None
        return await self.get_domain_for_user(user)

    async def resolve_domain_record(self, domain: str) -> dict | None:
        """Find the owning organization for an inbound address' domain."""
        return await self.db.email_domains.find_one(
            {"domain": (domain or "").strip().lower(), "status": "verified"}
        )

    async def resolve_sender(self, user_id: str, prefix: str | None = None) -> dict | None:
        """Resolve the From identity for an owner, or None to use the platform default."""
        record = await self.get_domain_by_user_id(user_id)
        if not record or record.get("status") != "verified":
            return None
        local_part = self.normalize_local_part(prefix or record.get("default_prefix"))
        return {
            "email": f"{local_part}@{record['domain']}",
            "name": record.get("from_name") or None,
            "domain": record["domain"],
        }

    # ── provisioning ──────────────────────────────────────────────────────

    async def request_domain(
        self,
        user: dict,
        *,
        business_name: str | None = None,
        custom_domain: str | None = None,
        from_name: str | None = None,
        default_prefix: str | None = None,
    ) -> dict:
        if not settings.RESEND_API_KEY:
            raise AppException(
                status_code=503,
                code="EMAIL_DOMAIN_NOT_CONFIGURED",
                message="Email sending is not configured on this deployment.",
            )

        existing = await self.get_domain_for_user(user)
        if existing:
            raise AppException(
                status_code=409,
                code="EMAIL_DOMAIN_EXISTS",
                message=f"This business already has {existing['domain']}. Remove it before claiming another.",
            )

        mode, domain = self._build_domain(business_name=business_name, custom_domain=custom_domain)

        if await self.db.email_domains.find_one({"domain": domain}):
            raise AppException(
                status_code=409,
                code="EMAIL_DOMAIN_TAKEN",
                message=f"{domain} is already taken. Try a different business name.",
            )

        created = await self._resend_create_domain(domain)
        records = self._collect_records(domain, created)

        provider = get_dns_provider()
        dns_applied = False
        if mode == "subdomain" and provider.supports(domain):
            dns_applied = await provider.apply(domain, records)

        now = utc_now()
        document = {
            "user_id": str(user["_id"]),
            "organization_id": user.get("organization_id"),
            "domain": domain,
            "mode": mode,
            "resend_domain_id": created.get("id"),
            "status": "verifying" if dns_applied else "pending",
            "dns_records": [record.to_dict() for record in records],
            "dns_auto_provisioned": dns_applied,
            "dns_provider": provider.name if dns_applied else "manual",
            "default_prefix": self.normalize_local_part(default_prefix or settings.EMAIL_DOMAIN_DEFAULT_PREFIX),
            "from_name": (from_name or "").strip() or None,
            "inbound_enabled": True,
            "last_error": None,
            "verified_at": None,
            "created_at": now,
            "updated_at": now,
        }
        try:
            result = await self.db.email_domains.insert_one(document)
        except Exception as exc:  # unique index race
            raise AppException(
                status_code=409,
                code="EMAIL_DOMAIN_TAKEN",
                message=f"{domain} is already taken. Try a different business name.",
            ) from exc
        document["_id"] = result.inserted_id

        if dns_applied:
            # Records exist already, so ask Resend to start checking immediately.
            await self._resend_verify(created.get("id"))

        return self.serialize(document)

    async def refresh_domain(self, user: dict) -> dict:
        record = await self.get_domain_for_user(user)
        if not record:
            raise AppException(
                status_code=404,
                code="EMAIL_DOMAIN_NOT_FOUND",
                message="No business email domain has been set up yet.",
            )
        if record.get("status") == "verified":
            return self.serialize(record)

        domain_id = record.get("resend_domain_id")
        if not domain_id:
            return self.serialize(record)

        await self._resend_verify(domain_id)
        remote = await self._resend_get_domain(domain_id)

        updates: dict = {"updated_at": utc_now()}
        status = self._map_remote_status(remote.get("status"))
        updates["status"] = status
        if remote.get("records"):
            updates["dns_records"] = [record.to_dict() for record in self._collect_records(record["domain"], remote)]
        if status == "verified" and not record.get("verified_at"):
            updates["verified_at"] = utc_now()
            updates["last_error"] = None

        updated = await self.db.email_domains.find_one_and_update(
            {"_id": record["_id"]},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        return self.serialize(updated)

    async def update_domain_settings(
        self,
        user: dict,
        *,
        from_name: str | None = None,
        default_prefix: str | None = None,
    ) -> dict:
        record = await self.get_domain_for_user(user)
        if not record:
            raise AppException(
                status_code=404,
                code="EMAIL_DOMAIN_NOT_FOUND",
                message="No business email domain has been set up yet.",
            )
        updates: dict = {"updated_at": utc_now()}
        if from_name is not None:
            updates["from_name"] = from_name.strip() or None
        if default_prefix is not None:
            updates["default_prefix"] = self.normalize_local_part(default_prefix)
        updated = await self.db.email_domains.find_one_and_update(
            {"_id": record["_id"]},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        return self.serialize(updated)

    async def delete_domain(self, user: dict) -> None:
        record = await self.get_domain_for_user(user)
        if not record:
            raise AppException(
                status_code=404,
                code="EMAIL_DOMAIN_NOT_FOUND",
                message="No business email domain has been set up yet.",
            )
        domain_id = record.get("resend_domain_id")
        if domain_id:
            try:
                await asyncio.to_thread(self._resend_remove_sync, domain_id)
            except Exception:
                # Losing the remote record must not strand the local one.
                logger.exception("Failed to remove Resend domain %s", domain_id)
        await self.db.email_domains.delete_one({"_id": record["_id"]})

    async def check_availability(self, business_name: str) -> dict:
        mode, domain = self._build_domain(business_name=business_name, custom_domain=None)
        taken = await self.db.email_domains.find_one({"domain": domain})
        return {"domain": domain, "mode": mode, "available": taken is None}

    # ── validation helpers ────────────────────────────────────────────────

    @staticmethod
    def slugify_domain_label(value: str) -> str:
        """Turn a business name into a valid DNS label."""
        slug = _SLUG_STRIP_RE.sub("-", (value or "").strip().lower()).strip("-")
        return slug[:63].strip("-")

    @staticmethod
    def normalize_local_part(value: str | None) -> str:
        candidate = (value or "").strip().lower()
        if not candidate:
            candidate = (settings.EMAIL_DOMAIN_DEFAULT_PREFIX or "hello").strip().lower()
        if candidate in RESERVED_LOCAL_PARTS:
            raise AppException(
                status_code=422,
                code="EMAIL_PREFIX_RESERVED",
                message=f"'{candidate}' is reserved and cannot be used as a sender address.",
            )
        if not _LOCAL_PART_RE.match(candidate):
            raise AppException(
                status_code=422,
                code="EMAIL_PREFIX_INVALID",
                message="Sender name may only use letters, numbers, dots, hyphens and underscores.",
            )
        return candidate

    def _build_domain(self, *, business_name: str | None, custom_domain: str | None) -> tuple[str, str]:
        if custom_domain:
            if not settings.EMAIL_DOMAIN_ALLOW_CUSTOM:
                raise AppException(
                    status_code=422,
                    code="CUSTOM_DOMAIN_DISABLED",
                    message="Custom domains are not enabled on this plan.",
                )
            domain = custom_domain.strip().lower().rstrip(".")
            domain = re.sub(r"^https?://", "", domain).split("/")[0]
            if not _DOMAIN_RE.match(domain):
                raise AppException(
                    status_code=422,
                    code="DOMAIN_INVALID",
                    message="Enter a valid domain, for example dentist.com.",
                )
            root = (settings.EMAIL_DOMAIN_ROOT or "").strip().lower()
            if root and (domain == root or domain.endswith(f".{root}")):
                raise AppException(
                    status_code=422,
                    code="DOMAIN_INVALID",
                    message="Use the business-name option to claim a subdomain.",
                )
            return "custom", domain

        root = (settings.EMAIL_DOMAIN_ROOT or "").strip().lower()
        if not root:
            raise AppException(
                status_code=503,
                code="EMAIL_DOMAIN_ROOT_NOT_CONFIGURED",
                message="Automatic business domains are not configured on this deployment.",
            )
        slug = self.slugify_domain_label(business_name or "")
        if len(slug) < 3:
            raise AppException(
                status_code=422,
                code="BUSINESS_NAME_INVALID",
                message="Business name must contain at least 3 letters or numbers.",
            )
        if slug in RESERVED_SLUGS:
            raise AppException(
                status_code=422,
                code="BUSINESS_NAME_RESERVED",
                message=f"'{slug}' is reserved. Please choose a different business name.",
            )
        return "subdomain", f"{slug}.{root}"

    # ── Resend plumbing ───────────────────────────────────────────────────

    def _collect_records(self, domain: str, remote: dict) -> list[DnsRecord]:
        """Resend's sending records plus the MX record that enables inbound."""
        records: list[DnsRecord] = []
        for entry in remote.get("records") or []:
            name = (entry.get("name") or "").strip().rstrip(".")
            # Resend returns some names relative to the domain and some absolute.
            if not name:
                name = domain
            elif not name.endswith(domain):
                name = f"{name}.{domain}"
            ttl_raw = entry.get("ttl")
            try:
                ttl = int(ttl_raw)
            except (TypeError, ValueError):
                ttl = 300
            records.append(
                DnsRecord(
                    name=name,
                    type=(entry.get("type") or "TXT").upper(),
                    value=entry.get("value") or "",
                    ttl=ttl,
                    priority=entry.get("priority"),
                    purpose=entry.get("record") or "sending",
                )
            )

        if settings.RESEND_INBOUND_MX_HOST:
            records.append(
                DnsRecord(
                    name=domain,
                    type="MX",
                    value=settings.RESEND_INBOUND_MX_HOST,
                    ttl=300,
                    priority=10,
                    purpose="inbound",
                )
            )
        return records

    @staticmethod
    def _map_remote_status(remote_status: str | None) -> str:
        mapping = {
            "not_started": "pending",
            "pending": "verifying",
            "verified": "verified",
            "failed": "failed",
            "temporary_failure": "verifying",
        }
        return mapping.get((remote_status or "").strip().lower(), "verifying")

    async def _resend_create_domain(self, domain: str) -> dict:
        try:
            return await asyncio.to_thread(self._resend_create_sync, domain)
        except Exception as exc:
            logger.exception("Resend domain creation failed for %s", domain)
            raise AppException(
                status_code=502,
                code="EMAIL_DOMAIN_PROVISION_FAILED",
                message="Could not register the domain with the email provider. Please try again.",
            ) from exc

    async def _resend_get_domain(self, domain_id: str) -> dict:
        try:
            return await asyncio.to_thread(self._resend_get_sync, domain_id)
        except Exception as exc:
            logger.exception("Resend domain lookup failed for %s", domain_id)
            raise AppException(
                status_code=502,
                code="EMAIL_DOMAIN_LOOKUP_FAILED",
                message="Could not read the domain status from the email provider.",
            ) from exc

    async def _resend_verify(self, domain_id: str | None) -> None:
        if not domain_id:
            return
        try:
            await asyncio.to_thread(self._resend_verify_sync, domain_id)
        except Exception:
            # Verification is retried on every refresh, so a failure here is not fatal.
            logger.warning("Resend verify call failed for %s", domain_id, exc_info=True)

    @staticmethod
    def _resend_create_sync(domain: str) -> dict:
        resend.api_key = settings.RESEND_API_KEY
        return resend.Domains.create({"name": domain})

    @staticmethod
    def _resend_get_sync(domain_id: str) -> dict:
        resend.api_key = settings.RESEND_API_KEY
        return resend.Domains.get(domain_id)

    @staticmethod
    def _resend_verify_sync(domain_id: str) -> dict:
        resend.api_key = settings.RESEND_API_KEY
        return resend.Domains.verify(domain_id)

    @staticmethod
    def _resend_remove_sync(domain_id: str) -> dict:
        resend.api_key = settings.RESEND_API_KEY
        return resend.Domains.remove(domain_id)

    # ── serialization ─────────────────────────────────────────────────────

    @staticmethod
    def _org_scope(user: dict) -> dict:
        organization_id = user.get("organization_id")
        if organization_id:
            return {"organization_id": organization_id}
        return {"user_id": str(user["_id"])}

    async def _load_user(self, user_id: str) -> dict | None:
        from bson import ObjectId  # noqa: PLC0415 - avoid import cycle at module load

        if not ObjectId.is_valid(user_id):
            return None
        return await self.db.users.find_one(
            {"_id": ObjectId(user_id)}, {"organization_id": 1}
        )

    def serialize(self, document: dict | None) -> dict | None:
        if not document:
            return None
        domain = document.get("domain", "")
        default_prefix = document.get("default_prefix") or settings.EMAIL_DOMAIN_DEFAULT_PREFIX
        return {
            "id": str(document.get("_id")),
            "domain": domain,
            "mode": document.get("mode", "subdomain"),
            "status": document.get("status", "pending"),
            "dns_records": document.get("dns_records", []),
            "dns_auto_provisioned": bool(document.get("dns_auto_provisioned")),
            "requires_manual_dns": not document.get("dns_auto_provisioned")
            and document.get("status") != "verified",
            "default_prefix": default_prefix,
            "from_name": document.get("from_name"),
            "example_address": f"{default_prefix}@{domain}" if domain else None,
            "inbound_enabled": bool(document.get("inbound_enabled", True)),
            "last_error": document.get("last_error"),
            "verified_at": document.get("verified_at"),
            "created_at": document.get("created_at"),
            "updated_at": document.get("updated_at"),
        }
