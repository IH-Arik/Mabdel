from __future__ import annotations

from datetime import datetime
import re

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.schemas.content import ContentBlock, ContentPageResponse
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
        "title": "Terms & Conditions",
        "display_style": "sections",
        "version": "2026.07.15",
        "blocks": [
            {"order": 1, "heading": "Last Updated", "body": "July 15, 2026"},
            {"order": 2, "body": "Welcome to GoCustify. These Terms and Conditions (\"Terms\") govern your access to and use of the GoCustify website, software platform, applications, products, and services (collectively, the \"Services\"). By accessing or using GoCustify, you agree to be bound by these Terms. If you do not agree with these Terms, you may not use the Services."},
            {"order": 3, "heading": "1. About GoCustify", "body": "GoCustify is an AI-powered customer relationship management (CRM) platform designed to help businesses manage customer communications, appointments, workflows, documents, invoices, automation, and business operations.\n\nThe Services may include features such as:\nAI-powered communication assistants\nVoice and messaging automation\nCustomer relationship management tools\nAppointment scheduling\nEmail and SMS automation\nAI-generated content and responses\nDocument creation and management\nThird-party integrations\nBusiness analytics and reporting tools"},
            {"order": 4, "heading": "2. Eligibility", "body": "You must be at least 18 years old and have the legal authority to enter into these Terms on behalf of yourself or your business.\n\nIf you use GoCustify on behalf of a company or organization, you represent that you have authority to bind that organization to these Terms."},
            {"order": 5, "heading": "3. Account Registration", "body": "To use certain features of GoCustify, you must create an account and provide accurate and complete information.\n\nYou are responsible for:\nMaintaining the confidentiality of your login credentials\nKeeping your account information accurate\nAll activities performed through your account\nManaging user access and permissions within your organization\n\nYou must notify GoCustify immediately if you suspect unauthorized access to your account."},
            {"order": 6, "heading": "4. Subscription and Payments", "body": "Some GoCustify features require a paid subscription.\n\nBy subscribing, you agree to:\nPay all applicable subscription fees\nProvide accurate billing information\nAuthorize recurring charges according to your selected plan\n\nSubscription fees are billed according to the plan selected at signup.\nGoCustify reserves the right to change pricing, plans, or available features with reasonable notice."},
            {"order": 7, "heading": "5. Communication Services", "body": "GoCustify may provide communication features including SMS, voice calls, email, and messaging integrations.\n\nYou acknowledge that:\nCommunication services may rely on third-party providers and networks.\nDelivery of messages and calls is not guaranteed due to carrier restrictions, network failures, regulations, or recipient settings.\nYou are responsible for complying with all applicable communication laws and regulations.\n\nYou agree not to use GoCustify to send:\nSpam messages\nUnsolicited marketing communications\nIllegal content\nMisleading or deceptive communications\n\nYou are responsible for obtaining proper customer consent before sending marketing communications."},
            {"order": 8, "heading": "6. AI Features and Generated Content", "body": "GoCustify uses artificial intelligence technologies to provide automated assistance and generate content.\n\nYou acknowledge that:\nAI-generated content may contain errors or inaccuracies.\nYou are responsible for reviewing and approving AI-generated responses, documents, messages, contracts, invoices, and other materials before use.\nGoCustify does not guarantee that AI-generated content will be suitable for every business purpose.\nYou remain responsible for decisions made using information generated by AI features."},
            {"order": 9, "heading": "7. User Responsibilities", "body": "You agree to use GoCustify only for lawful purposes.\n\nYou may not:\nReverse engineer, copy, or modify the platform\nAttempt to gain unauthorized access\nInterfere with platform security or performance\nUpload harmful software or malicious content\nUse the Services in violation of applicable laws"},
            {"order": 10, "heading": "8. Data Ownership and Privacy", "body": "You retain ownership of the business information, customer data, documents, and content you upload or create using GoCustify.\n\nBy using the Services, you grant GoCustify permission to process your data only as necessary to provide, maintain, secure, and improve the Services.\n\nGoCustify's collection and use of personal information is governed by our Privacy Policy."},
            {"order": 11, "heading": "9. Third-Party Services", "body": "GoCustify may integrate with third-party services, including communication providers, payment processors, calendars, social media platforms, and other software providers.\n\nGoCustify is not responsible for:\nAvailability of third-party services\nChanges made by third-party providers\nThird-party terms, policies, or practices\n\nYour use of third-party services may be subject to separate agreements."},
            {"order": 12, "heading": "10. Intellectual Property", "body": "All GoCustify software, trademarks, branding, designs, technology, and content are owned by or licensed to GoCustify.\n\nYou may not use GoCustify intellectual property without prior written permission."},
            {"order": 13, "heading": "11. Service Availability", "body": "GoCustify works to maintain reliable service but does not guarantee uninterrupted availability.\n\nThe Services may occasionally be unavailable due to:\nMaintenance\nUpdates\nTechnical issues\nThird-party service interruptions"},
            {"order": 14, "heading": "12. Suspension and Termination", "body": "GoCustify may suspend or terminate accounts that:\nViolate these Terms\nAbuse the Services\nCreate security risks\nEngage in illegal activities\n\nYou may cancel your account according to your subscription terms.\nUpon termination, your access to certain Services may end."},
            {"order": 15, "heading": "13. Limitation of Liability", "body": "To the maximum extent permitted by law, GoCustify shall not be liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the Services.\n\nGoCustify's total liability shall not exceed the amount paid by you to GoCustify during the twelve (12) months preceding the event giving rise to the claim."},
            {"order": 16, "heading": "14. Disclaimer", "body": "GoCustify provides the Services on an \"as available\" basis.\n\nWe do not guarantee:\nSpecific business results\nIncreased revenue\nCustomer acquisition\nAccuracy of AI-generated outputs\nAvailability of third-party integrations"},
            {"order": 17, "heading": "15. Changes to These Terms", "body": "GoCustify may update these Terms from time to time.\nUpdated Terms will be posted on this page with a revised \"Last Updated\" date. Continued use of the Services after changes means you accept the updated Terms."},
            {"order": 18, "heading": "16. Governing Law", "body": "These Terms shall be governed by the laws of the jurisdiction where GoCustify operates, without regard to conflict of law principles."},
            {"order": 19, "heading": "17. Contact Information", "body": "For questions regarding these Terms, please contact:\nGoCustify\nEmail: support@gocustify.com\nWebsite: https://www.gocustify.com/"},
        ],
    },
    {
        "slug": "privacy-policy",
        "title": "Privacy Policy",
        "display_style": "sections",
        "version": "2026.07.15",
        "blocks": [
            {"order": 1, "heading": "Last Updated", "body": "July 15, 2026"},
            {"order": 2, "body": "GoCustify (\"GoCustify,\" \"we,\" \"us,\" or \"our\") respects your privacy and is committed to protecting the information you provide when using our website, software platform, and services."},
            {"order": 3, "body": "This Privacy Policy explains how we collect, use, disclose, and protect your information when you access or use GoCustify."},
            {"order": 4, "heading": "1. Information We Collect", "body": "We may collect account information such as name, business name, email address, phone number, billing information, and login credentials. We may also collect business data such as customer records, contacts, appointments, messages, documents, invoices, contracts, notes, and workflow information. Communication data may include phone numbers, SMS messages, call recordings if enabled, call transcripts, email communications, and communication history. Technical information may include IP address, browser type, device information, usage activity, and system logs."},
            {"order": 5, "heading": "2. How We Use Information", "body": "We use collected information to provide and operate GoCustify services, manage customer accounts, process subscriptions and payments, provide AI-powered assistance, enable communication features, improve platform performance, provide customer support, maintain security and prevent fraud, and comply with legal obligations."},
            {"order": 6, "heading": "3. AI Processing", "body": "GoCustify uses artificial intelligence technologies to provide features such as automated responses, content creation, workflow assistance, and communication automation. AI systems may process information provided by users in order to generate responses or perform requested actions. Users are responsible for reviewing AI-generated content before relying on it for business decisions."},
            {"order": 7, "heading": "4. Communication Data", "body": "If you use GoCustify communication features, information may be processed through third-party communication providers, including voice, SMS, email, and messaging service providers. We use such providers only as necessary to deliver requested services."},
            {"order": 8, "heading": "5. Sharing of Information", "body": "We do not sell your personal information. We may share information with service providers that help operate GoCustify, payment processors, cloud hosting providers, communication providers, integration partners requested by you, and legal authorities when required by law."},
            {"order": 9, "heading": "6. Data Security", "body": "We use reasonable administrative, technical, and organizational measures designed to protect your information. However, no internet-based service can guarantee complete security."},
            {"order": 10, "heading": "7. Data Retention", "body": "We retain information only as long as necessary to provide services, comply with legal requirements, resolve disputes, and enforce agreements."},
            {"order": 11, "heading": "8. Your Rights", "body": "Depending on applicable laws, you may request access to your information, correction of inaccurate information, deletion of information, export of your data, or restriction of certain processing."},
            {"order": 12, "heading": "9. Cookies", "body": "Our website may use cookies and similar technologies to improve user experience, analyze usage, and maintain website functionality."},
            {"order": 13, "heading": "10. Third-Party Links", "body": "GoCustify may contain links to third-party services. We are not responsible for their privacy practices."},
            {"order": 14, "heading": "11. Changes to This Policy", "body": "We may update this Privacy Policy periodically. Changes will be posted with an updated date."},
            {"order": 15, "heading": "12. Contact Us", "body": "GoCustify\nEmail: support@gocustify.com\nWebsite: https://www.gocustify.com/"},
        ],
    },
    {
        "slug": "sms-messaging-policy",
        "title": "SMS Messaging Policy",
        "display_style": "sections",
        "version": "2026.07.15",
        "blocks": [
            {"order": 1, "heading": "Last Updated", "body": "July 15, 2026"},
            {"order": 2, "body": "GoCustify provides SMS communication tools that allow businesses to communicate with their customers. This policy explains our SMS practices and compliance requirements."},
            {"order": 3, "heading": "1. SMS Consent", "body": "Businesses using GoCustify must obtain proper consent from recipients before sending SMS messages. Consent may be collected through website forms, appointment forms, customer agreements, text message opt-in forms, or other compliant methods. Users must not send unsolicited messages."},
            {"order": 4, "heading": "2. Types of Messages", "body": "Messages sent through GoCustify may include appointment reminders, customer support messages, service updates, account notifications, and marketing messages only with proper consent."},
            {"order": 5, "heading": "3. Message Frequency", "body": "Message frequency depends on the communication preferences and activities of each business using GoCustify. Customers should clearly communicate expected message frequency during opt-in."},
            {"order": 6, "heading": "4. Opt-Out Instructions", "body": "Recipients may stop receiving SMS messages at any time by replying STOP. After opting out, additional messages will not be sent unless the recipient provides new consent."},
            {"order": 7, "heading": "5. Help Instructions", "body": "Recipients may request assistance by replying HELP or contacting the business that sent the message."},
            {"order": 8, "heading": "6. Carrier Charges", "body": "Message and data rates may apply depending on the recipient's mobile carrier and plan."},
            {"order": 9, "heading": "7. Compliance Requirements", "body": "GoCustify customers agree to comply with all applicable communication laws and regulations, including the Telephone Consumer Protection Act (TCPA), CAN-SPAM requirements where applicable, carrier messaging guidelines, and applicable privacy laws."},
            {"order": 10, "heading": "8. Prohibited SMS Activities", "body": "Users may not send spam messages, fraudulent messages, misleading advertisements, illegal content, or messages without proper consent. GoCustify reserves the right to suspend messaging access for violations."},
            {"order": 11, "heading": "9. Contact", "body": "Questions regarding SMS compliance:\nEmail: support@gocustify.com"},
        ],
    },
    {
        "slug": "acceptable-use-policy",
        "title": "Acceptable Use Policy",
        "display_style": "sections",
        "version": "2026.07.15",
        "blocks": [
            {"order": 1, "heading": "Last Updated", "body": "July 15, 2026"},
            {"order": 2, "body": "This Acceptable Use Policy describes prohibited activities when using GoCustify services. By using GoCustify, you agree to use the platform responsibly and legally."},
            {"order": 3, "heading": "1. Prohibited Activities", "body": "Users may not use GoCustify to send spam or unsolicited communications, conduct fraud or scams, impersonate another person or business, store or distribute illegal content, violate privacy rights, harass or abuse individuals, attempt unauthorized access, or introduce malware or harmful code."},
            {"order": 4, "heading": "2. Communication Rules", "body": "Users are responsible for ensuring all calls, texts, emails, and automated communications comply with applicable laws. Users must obtain required consent, provide accurate sender identification, respect opt-out requests, and maintain appropriate communication practices."},
            {"order": 5, "heading": "3. AI Usage Rules", "body": "Users must not use GoCustify AI features to generate illegal content, create deceptive communications, make decisions requiring professional judgment without appropriate review, or misrepresent AI-generated content as guaranteed facts."},
            {"order": 6, "heading": "4. Account Security", "body": "Users are responsible for protecting account credentials and managing employee permissions. Users should immediately notify GoCustify of suspected unauthorized access."},
            {"order": 7, "heading": "5. Enforcement", "body": "GoCustify may investigate suspected violations and may restrict access, suspend accounts, remove prohibited content, or terminate accounts."},
            {"order": 8, "heading": "6. Reporting Violations", "body": "To report misuse of GoCustify:\nEmail: support@gocustify.com"},
            {"order": 9, "heading": "7. Updates", "body": "GoCustify may update this policy periodically to reflect changes in services, regulations, or security requirements."},
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

    async def get_page_text(self, slug: str) -> str:
        page = await self.get_page(slug)
        lines = [page.title]
        for block in page.blocks:
            if block.heading:
                lines.extend(["", block.heading])
            if block.body:
                lines.append(block.body)
        return "\n".join(lines).strip()

    async def upsert_page_text(self, slug: str, content: str, title: str | None = None) -> ContentPageResponse:
        normalized_slug = slug.lower().strip()
        try:
            existing = await self.get_page(normalized_slug)
        except AppException:
            existing = None

        page = {
            "slug": normalized_slug,
            "title": title or (existing.title if existing else self._default_title_for_slug(normalized_slug)),
            "display_style": "sections",
            "version": utc_now().strftime("%Y.%m.%d"),
            "blocks": [block.model_dump() for block in self._text_to_blocks(content)],
            "is_active": True,
        }
        return await self.upsert_page(page)

    @staticmethod
    def _default_title_for_slug(slug: str) -> str:
        return {
            "about-us": "About Us",
            "terms-and-conditions": "Terms & Conditions",
            "privacy-policy": "Privacy Policy",
            "sms-messaging-policy": "SMS Messaging Policy",
            "acceptable-use-policy": "Acceptable Use Policy",
            "help-support": "Help & Support",
        }.get(slug, slug.replace("-", " ").title())

    @staticmethod
    def _text_to_blocks(content: str) -> list[ContentBlock]:
        cleaned = ContentService._normalize_editor_content(content)
        paragraphs = [part.strip() for part in re.split(r"\n{2,}", cleaned) if part.strip()]
        blocks: list[ContentBlock] = []
        order = 1
        skipped_title = False

        for paragraph in paragraphs:
            if not skipped_title and len(paragraph) <= 160 and "\n" not in paragraph:
                skipped_title = True
                continue

            lines = [line.strip() for line in paragraph.splitlines() if line.strip()]
            if not lines:
                continue

            heading = None
            body_lines = lines
            if len(lines) > 1 and len(lines[0]) <= 160:
                heading = lines[0]
                body_lines = lines[1:]

            body = "\n".join(body_lines).strip() if body_lines else ""
            if not body:
                body = heading or paragraph
                heading = None

            blocks.append(ContentBlock(order=order, heading=heading, body=body))
            order += 1

        if not blocks:
            blocks.append(ContentBlock(order=1, body=cleaned or "Content unavailable."))

        return blocks

    @staticmethod
    def _normalize_editor_content(content: str) -> str:
        normalized = (content or "").replace("\r\n", "\n").replace("\r", "\n")
        normalized = re.sub(r"<br\s*/?>", "\n", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"</(p|div|h1|h2|h3|h4|h5|h6|li)>", "\n\n", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"<li[^>]*>", "- ", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"<[^>]+>", "", normalized)
        normalized = normalized.replace("&nbsp;", " ").replace("&amp;", "&")
        normalized = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1: \2", normalized)
        normalized = re.sub(r"\n{3,}", "\n\n", normalized)
        return normalized.strip()

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
