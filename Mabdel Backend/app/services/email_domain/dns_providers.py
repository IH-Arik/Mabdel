"""DNS provisioning backends for business email domains.

Two backends exist:

* ``route53`` — we own the zone, so records are created automatically and the
  owner never touches DNS. This is the flow used for ``<slug>.<EMAIL_DOMAIN_ROOT>``
  subdomains.
* ``manual`` — we cannot write to the zone (the owner brought their own domain,
  or Route53 is not configured), so the records are handed back to the caller
  and surfaced in the UI for the owner to add.

boto3 is imported lazily so the package stays optional; the Vercel bundle does
not ship it and falls back to ``manual`` automatically.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DnsRecord:
    """A single DNS record required to activate a domain."""

    name: str
    type: str
    value: str
    ttl: int = 300
    priority: int | None = None
    purpose: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "type": self.type,
            "value": self.value,
            "ttl": self.ttl,
            "priority": self.priority,
            "purpose": self.purpose,
        }


class DnsProvider:
    """Base DNS backend. ``manual`` behaviour is the default."""

    name = "manual"
    automated = False

    def supports(self, domain: str) -> bool:
        return False

    async def apply(self, domain: str, records: list[DnsRecord]) -> bool:
        """Create/update ``records``. Returns True when records were written."""
        return False


class ManualDnsProvider(DnsProvider):
    """No-op backend — records are shown to the owner instead of being written."""


class Route53DnsProvider(DnsProvider):
    name = "route53"
    automated = True

    def __init__(self, hosted_zone_id: str, root_domain: str) -> None:
        self.hosted_zone_id = hosted_zone_id
        self.root_domain = root_domain.lower().strip(".")

    def supports(self, domain: str) -> bool:
        """Only subdomains of the zone we actually own can be automated."""
        domain = domain.lower().strip(".")
        return bool(self.root_domain) and (
            domain == self.root_domain or domain.endswith(f".{self.root_domain}")
        )

    async def apply(self, domain: str, records: list[DnsRecord]) -> bool:
        if not self.supports(domain):
            return False
        try:
            return await asyncio.to_thread(self._apply_sync, records)
        except Exception:
            logger.exception("Route53 record provisioning failed for %s", domain)
            return False

    def _apply_sync(self, records: list[DnsRecord]) -> bool:
        try:
            import boto3  # noqa: PLC0415 - optional dependency
        except ImportError:
            logger.warning("boto3 is not installed; falling back to manual DNS setup.")
            return False

        client = boto3.client(
            "route53",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        changes = [
            {
                "Action": "UPSERT",
                "ResourceRecordSet": {
                    "Name": record.name,
                    "Type": record.type,
                    "TTL": record.ttl,
                    "ResourceRecords": [{"Value": _format_value(record)}],
                },
            }
            for record in records
        ]
        if not changes:
            return False
        client.change_resource_record_sets(
            HostedZoneId=self.hosted_zone_id,
            ChangeBatch={"Comment": "GoCustify business email domain", "Changes": changes},
        )
        return True


def _format_value(record: DnsRecord) -> str:
    """Route53 wants TXT values quoted and MX values prefixed with a priority."""
    if record.type == "TXT":
        value = record.value.replace('"', '\\"')
        return f'"{value}"'
    if record.type == "MX" and record.priority is not None:
        return f"{record.priority} {record.value}"
    return record.value


def get_dns_provider() -> DnsProvider:
    provider = (settings.EMAIL_DOMAIN_DNS_PROVIDER or "manual").strip().lower()
    if provider == "route53":
        if settings.ROUTE53_HOSTED_ZONE_ID and settings.EMAIL_DOMAIN_ROOT:
            return Route53DnsProvider(settings.ROUTE53_HOSTED_ZONE_ID, settings.EMAIL_DOMAIN_ROOT)
        logger.warning(
            "EMAIL_DOMAIN_DNS_PROVIDER=route53 but ROUTE53_HOSTED_ZONE_ID/EMAIL_DOMAIN_ROOT "
            "are not set; using manual DNS setup."
        )
    return ManualDnsProvider()
