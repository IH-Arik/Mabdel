from __future__ import annotations

import asyncio

import pytest

from app.core.config import settings
from app.core.exceptions import AppException
from app.services.email_domain.email_domain_service import EmailDomainService
from app.services.email_domain.inbound_service import InboundEmailService
from app.tests.conftest import grant_owner_role


def _get_latest_otp(db, email: str, purpose: str) -> dict:
    otp = asyncio.run(
        db.otp_codes.find_one({"email": email, "purpose": purpose}, sort=[("created_at", -1)])
    )
    assert otp is not None
    return otp


def _auth_headers(client, mock_db, email: str = "domainowner@example.com") -> dict[str, str]:
    register = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Domain Owner", "email": email, "password": "SecurePass2024!"},
    )
    assert register.status_code == 201

    otp = _get_latest_otp(mock_db, email=email, purpose="signup")
    verify = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": email, "code": otp["code"], "purpose": "signup"},
    )
    assert verify.status_code == 200

    grant_owner_role(mock_db, email)

    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "SecurePass2024!"}
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}


# ── pure validation logic ────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("business_name", "expected"),
    [
        ("Dentist Care", "dentist-care"),
        ("Bright  Smile & Co.", "bright-smile-co"),
        ("Acme-Realty!!", "acme-realty"),
        ("   ", ""),
    ],
)
def test_slugify_domain_label(business_name, expected):
    assert EmailDomainService.slugify_domain_label(business_name) == expected


def test_slugify_truncates_to_dns_label_limit():
    slug = EmailDomainService.slugify_domain_label("a" * 200)
    assert len(slug) == 63
    assert not slug.startswith("-") and not slug.endswith("-")


@pytest.mark.parametrize("prefix", ["market", "Invoice", "ok.name-1"])
def test_normalize_local_part_accepts_valid(prefix):
    assert EmailDomainService.normalize_local_part(prefix) == prefix.lower()


@pytest.mark.parametrize(
    ("prefix", "code"),
    [
        ("a b", "EMAIL_PREFIX_INVALID"),
        ("-bad", "EMAIL_PREFIX_INVALID"),
        ("bad-", "EMAIL_PREFIX_INVALID"),
        ("abuse", "EMAIL_PREFIX_RESERVED"),
        ("postmaster", "EMAIL_PREFIX_RESERVED"),
    ],
)
def test_normalize_local_part_rejects_invalid(prefix, code):
    with pytest.raises(AppException) as exc:
        EmailDomainService.normalize_local_part(prefix)
    assert exc.value.code == code


def test_normalize_local_part_falls_back_to_default():
    assert EmailDomainService.normalize_local_part("") == settings.EMAIL_DOMAIN_DEFAULT_PREFIX


def test_build_domain_rejects_reserved_slug(mock_db, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_DOMAIN_ROOT", "gocustify.com")
    service = EmailDomainService(mock_db)
    with pytest.raises(AppException) as exc:
        service._build_domain(business_name="admin", custom_domain=None)
    assert exc.value.code == "BUSINESS_NAME_RESERVED"


def test_build_domain_rejects_short_name(mock_db, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_DOMAIN_ROOT", "gocustify.com")
    service = EmailDomainService(mock_db)
    with pytest.raises(AppException) as exc:
        service._build_domain(business_name="ab", custom_domain=None)
    assert exc.value.code == "BUSINESS_NAME_INVALID"


def test_build_domain_subdomain_and_custom(mock_db, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_DOMAIN_ROOT", "gocustify.com")
    monkeypatch.setattr(settings, "EMAIL_DOMAIN_ALLOW_CUSTOM", True)
    service = EmailDomainService(mock_db)

    assert service._build_domain(business_name="Dentist Care", custom_domain=None) == (
        "subdomain",
        "dentist-care.gocustify.com",
    )
    assert service._build_domain(business_name=None, custom_domain="https://Dentist.com/x") == (
        "custom",
        "dentist.com",
    )


def test_build_domain_rejects_custom_under_platform_root(mock_db, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_DOMAIN_ROOT", "gocustify.com")
    service = EmailDomainService(mock_db)
    with pytest.raises(AppException) as exc:
        service._build_domain(business_name=None, custom_domain="evil.gocustify.com")
    assert exc.value.code == "DOMAIN_INVALID"


def test_build_domain_rejects_malformed_custom(mock_db, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_DOMAIN_ALLOW_CUSTOM", True)
    service = EmailDomainService(mock_db)
    with pytest.raises(AppException) as exc:
        service._build_domain(business_name=None, custom_domain="not a domain")
    assert exc.value.code == "DOMAIN_INVALID"


# ── inbound payload parsing ──────────────────────────────────────────────


def _parser() -> InboundEmailService:
    return InboundEmailService.__new__(InboundEmailService)


def test_inbound_parse_normalizes_and_strips_quoted_reply():
    parsed = _parser()._parse_payload(
        {
            "email_id": "evt_1",
            "from": "Jane Doe <Jane@Example.COM>",
            "to": ["Market@dentist.gocustify.com", "cc@other.com"],
            "subject": "Need a quote",
            "text": "Please send pricing.\n\nOn Mon, someone wrote:\n> old thread",
        }
    )
    assert parsed["from_email"] == "jane@example.com"
    assert parsed["from_name"] == "Jane Doe"
    assert parsed["to_addresses"] == ["market@dentist.gocustify.com", "cc@other.com"]
    assert parsed["content"] == "Need a quote\n\nPlease send pricing."
    assert "old thread" not in parsed["content"]


def test_inbound_parse_falls_back_to_html_body():
    parsed = _parser()._parse_payload(
        {
            "id": "evt_2",
            "from": "a@b.com",
            "to": "x@y.com",
            "subject": "Hi",
            "html": "<p>Hello <b>world</b></p><script>bad()</script>",
        }
    )
    assert "Hello world" in parsed["content"]
    assert "bad()" not in parsed["content"]


def test_inbound_parse_handles_object_address_shape():
    parsed = _parser()._parse_payload(
        {
            "email_id": "evt_3",
            "from": {"address": "Sender@Example.com"},
            "to": [{"address": "Sales@dentist.gocustify.com"}],
            "text": "hi",
        }
    )
    assert parsed["from_email"] == "sender@example.com"
    assert parsed["to_addresses"] == ["sales@dentist.gocustify.com"]


def test_inbound_parse_collects_attachment_references():
    """Resend gives attachment ids, not URLs — content is fetched separately."""
    parsed = _parser()._parse_payload(
        {
            "email_id": "evt_4",
            "from": "a@b.com",
            "to": "x@y.com",
            "text": "hi",
            "attachments": [
                {"filename": "no-id.png"},
                {"id": "att_1", "filename": "doc.pdf", "content_type": "application/pdf", "size": 90},
            ],
        }
    )
    assert len(parsed["attachments"]) == 1
    assert parsed["attachments"][0] == {
        "provider_attachment_id": "att_1",
        "file_name": "doc.pdf",
        "mime_type": "application/pdf",
        "file_size_bytes": 90,
    }


def test_merge_full_email_overlays_fetched_body():
    """The webhook has no body, so the fetched message must supply the content."""
    parser = _parser()
    parsed = parser._parse_payload(
        {"email_id": "evt_5", "from": "a@b.com", "to": "x@y.com", "subject": "Quote"}
    )
    assert parsed["content"] == "Quote"  # metadata only

    merged = parser._merge_full_email(
        parsed,
        {
            "subject": "Quote",
            "text": "Here are the numbers.",
            "message_id": "<abc@mail>",
            "attachments": [{"id": "att_9", "filename": "q.pdf"}],
        },
    )
    assert merged["content"] == "Quote\n\nHere are the numbers."
    assert merged["provider_message_id"] == "<abc@mail>"
    assert merged["attachments"][0]["provider_attachment_id"] == "att_9"


def test_inbound_parse_truncates_long_bodies():
    parsed = _parser()._parse_payload(
        {"email_id": "e", "from": "a@b.com", "to": "x@y.com", "text": "x" * 50000}
    )
    assert len(parsed["content"]) <= 10000


# ── API surface ──────────────────────────────────────────────────────────


def test_get_email_domain_returns_null_when_not_set_up(client, mock_db):
    headers = _auth_headers(client, mock_db)
    response = client.get("/api/v1/smartflow/email-domain", headers=headers)
    assert response.status_code == 200
    assert response.json()["data"] is None


def test_email_domain_endpoints_require_auth(client):
    assert client.get("/api/v1/smartflow/email-domain").status_code in (401, 403)
    assert client.post("/api/v1/smartflow/email-domain", json={"business_name": "x"}).status_code in (401, 403)


def test_availability_reports_free_domain(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_DOMAIN_ROOT", "gocustify.com")
    headers = _auth_headers(client, mock_db)
    response = client.get(
        "/api/v1/smartflow/email-domain/availability",
        headers=headers,
        params={"business_name": "Dentist Care"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data == {"domain": "dentist-care.gocustify.com", "mode": "subdomain", "available": True}


def test_request_domain_requires_a_source(client, mock_db):
    headers = _auth_headers(client, mock_db)
    response = client.post("/api/v1/smartflow/email-domain", headers=headers, json={})
    assert response.status_code == 422


def test_verify_without_domain_returns_404(client, mock_db):
    headers = _auth_headers(client, mock_db)
    response = client.post("/api/v1/smartflow/email-domain/verify", headers=headers)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "EMAIL_DOMAIN_NOT_FOUND"


# ── inbound routing ──────────────────────────────────────────────────────


def test_inbound_webhook_ignores_unknown_domain(client, mock_db, monkeypatch):
    # These payloads aren't Svix-signed, so verification must be off to reach the
    # routing logic under test — independent of whatever the developer's real
    # RESEND_INBOUND_WEBHOOK_SECRET happens to be set to locally.
    monkeypatch.setattr(settings, "RESEND_INBOUND_WEBHOOK_SECRET", None)
    response = client.post(
        "/api/v1/dashboard/webhooks/resend/inbound",
        json={
            "type": "email.received",
            "data": {
                "email_id": "evt_unknown",
                "from": "someone@example.com",
                "to": ["hi@not-ours.com"],
                "text": "hello",
            },
        },
    )
    assert response.status_code == 200
    assert response.json()["reason"] == "unknown_recipient_domain"


def test_inbound_webhook_ignores_other_event_types(client, mock_db, monkeypatch):
    monkeypatch.setattr(settings, "RESEND_INBOUND_WEBHOOK_SECRET", None)
    response = client.post(
        "/api/v1/dashboard/webhooks/resend/inbound",
        json={"type": "email.delivered", "data": {}},
    )
    assert response.status_code == 200
    assert response.json()["reason"] == "unsupported_event_type"


def test_inbound_webhook_lands_message_in_conversations(client, mock_db, monkeypatch):
    """End-to-end: mail to a verified domain becomes an inbox conversation.

    The body arrives from the follow-up fetch (the webhook carries metadata only),
    so that call is stubbed here rather than hitting Resend.
    """
    from app.services.email_domain.inbound_service import InboundEmailService

    async def fake_fetch(self, email_id):
        return {
            "subject": "Appointment request",
            "text": "Can I book for Friday?",
            "message_id": f"<{email_id}@mail>",
            "attachments": [],
        }

    monkeypatch.setattr(InboundEmailService, "_fetch_received_email", fake_fetch)
    monkeypatch.setattr(settings, "RESEND_INBOUND_WEBHOOK_SECRET", None)

    headers = _auth_headers(client, mock_db, email="inbound-owner@example.com")
    me = client.get("/api/v1/smartflow/business-profile", headers=headers)
    assert me.status_code == 200

    owner = asyncio.run(mock_db.users.find_one({"email": "inbound-owner@example.com"}))
    owner_id = str(owner["_id"])

    asyncio.run(
        mock_db.email_domains.insert_one(
            {
                "user_id": owner_id,
                "organization_id": owner.get("organization_id"),
                "domain": "dentist.gocustify.com",
                "mode": "subdomain",
                "status": "verified",
                "default_prefix": "hello",
                "inbound_enabled": True,
            }
        )
    )

    payload = {
        "type": "email.received",
        "data": {
            "email_id": "evt_inbound_1",
            "from": "Patient One <patient@example.com>",
            "to": ["market@dentist.gocustify.com"],
            "subject": "Appointment request",
            "text": "Can I book for Friday?",
        },
    }
    response = client.post("/api/v1/dashboard/webhooks/resend/inbound", json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "processed"

    # Same event again must not duplicate.
    repeat = client.post("/api/v1/dashboard/webhooks/resend/inbound", json=payload)
    assert repeat.json()["reason"] == "duplicate_event"

    conversations = client.get(
        "/api/v1/smartflow/conversations", headers=headers, params={"platform": "email"}
    )
    assert conversations.status_code == 200
    items = conversations.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["platform"] == "email"

    messages = client.get(
        f"/api/v1/smartflow/conversations/{items[0]['id']}/messages", headers=headers
    )
    assert messages.status_code == 200
    contents = [m["content"] for m in messages.json()["data"]["items"]]
    assert any("Can I book for Friday?" in c for c in contents)

    contact = asyncio.run(mock_db.contacts.find_one({"user_id": owner_id, "email": "patient@example.com"}))
    assert contact is not None
    assert contact["name"] == "Patient One"


def test_resolve_sender_returns_none_without_verified_domain(mock_db):
    service = EmailDomainService(mock_db)
    assert asyncio.run(service.resolve_sender("64b7f9f9f9f9f9f9f9f9f9f9")) is None
