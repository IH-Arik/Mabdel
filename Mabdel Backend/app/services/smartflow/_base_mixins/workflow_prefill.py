from __future__ import annotations

import asyncio
import re
import json
from datetime import date, datetime, timedelta, timezone

from bson import ObjectId

from app.core.config import settings
from app.utils.helpers import utc_now


class WorkflowPrefillMixin:
    async def _build_workflow_prefill(
        self,
        intent: str,
        transcript: str,
        current_values: dict,
        user_id: str | None = None,
        workflow_output: dict | None = None,
    ) -> dict:
        text = transcript.strip()
        lowered = text.lower()
        amount = self._extract_money_amount(text)
        emails = self._extract_emails(text)
        ai_prefill = await self._extract_workflow_prefill_with_ai(intent, text, current_values)
        ai_recipient_name = (
            ai_prefill.pop("_recipient_name", None)
            or ai_prefill.get("client_name")
            or ai_prefill.get("tenant_name")
        )

        # 1. Resolve recipient or client name
        recipient_name = ai_recipient_name
        if not recipient_name and workflow_output:
            recipient_name = (
                workflow_output.get("recipient")
                or workflow_output.get("tenant_name")
                or workflow_output.get("client_name")
                or workflow_output.get("party_b")
            )
        if not recipient_name:
            recipient_name = self._extract_name_phrase(text)

        # 2. Look up name in DB contacts to resolve their full name & email
        resolved_contact = None
        if user_id and recipient_name:
            clean_name = recipient_name.strip()
            if clean_name:
                # Contacts belong to the whole organization, not just the login that asks.
                resolved_contact = await self.db.contacts.find_one({
                    "user_id": {"$in": await self._resolve_team_user_ids(user_id)},
                    "$or": [
                        {"name": {"$regex": rf"\b{re.escape(clean_name)}\b", "$options": "i"}},
                        {"first_name": {"$regex": rf"^{re.escape(clean_name)}$", "$options": "i"}},
                        {"last_name": {"$regex": rf"^{re.escape(clean_name)}$", "$options": "i"}},
                    ]
                })

        if resolved_contact:
            final_name = resolved_contact.get("name") or resolved_contact.get("first_name") or recipient_name
            final_email = resolved_contact.get("email") or ""
        else:
            final_name = recipient_name or ""
            final_email = emails[0] if emails else ""

        tomorrow = utc_now() + timedelta(days=1)
        prefill: dict = dict(current_values)
        prefill.update(ai_prefill)

        if intent == "invoice":
            if final_name:
                prefill["client_name"] = final_name
                prefill["client_email"] = final_email or prefill.get("client_email", "")
            elif emails:
                prefill["client_email"] = emails[0]

            prefill.setdefault("currency", "USD")
            prefill.setdefault("tax_rate", 0)
            prefill.setdefault("notes", text)

            # Cleanly build prefilled items with dynamic quantity and price
            qty, unit_price = self._extract_qty_and_price(text, amount)
            work_desc = self._extract_work_description(text, recipient_name) or "Service"
            # If the description has the quantity pattern (e.g., "5 website designs"), strip the leading quantity number
            if work_desc and re.match(r"^\d+\s+", work_desc):
                work_desc = re.sub(r"^\d+\s+", "", work_desc).strip()

            if amount is not None or (not prefill.get("items") and work_desc != "Service"):
                prefill["items"] = [{
                    "description": work_desc,
                    "quantity": qty,
                    "unit_price": unit_price,
                }]

            # Dynamic Due Date (prefill both due_date and payment_due_date)
            extracted_due = None
            if workflow_output:
                extracted_due = workflow_output.get("due_date")
            if not extracted_due:
                extracted_due = prefill.get("due_date") or prefill.get("payment_due_date")
            resolved_due_date = self._parse_due_date(extracted_due, text)

            if resolved_due_date:
                prefill["due_date"] = resolved_due_date
                prefill["payment_due_date"] = resolved_due_date

            return prefill

        if intent == "bulk_message":
            channel = "sms" if "sms" in lowered or "text message" in lowered else "email"
            prefill.setdefault("channel", channel)
            prefill.setdefault("recipient_emails", emails)
            prefill.setdefault("contact_ids", [])
            prefill.setdefault("group_ids", [])
            prefill.setdefault("subject", self._short_subject_from_text(text) if channel == "email" else None)
            prefill.setdefault("content", text)
            prefill.setdefault("send_now", True)
            prefill.setdefault("timezone", "UTC")
            prefill.setdefault("ai_transcript", text)
            return prefill

        if intent == "calendar":
            starts_at = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
            ends_at = starts_at + timedelta(hours=1)
            prefill.setdefault("title", self._calendar_title_from_text(text))
            prefill.setdefault("description", text)
            prefill.setdefault("starts_at", starts_at.isoformat())
            prefill.setdefault("ends_at", ends_at.isoformat())
            prefill.setdefault("meeting_mode", "online" if "online" in lowered or "zoom" in lowered or "meet" in lowered else "offline")
            prefill.setdefault("contact_ids", [])
            prefill.setdefault("timezone", "UTC")
            prefill.setdefault("reminder_minutes", 15)
            return prefill

        if intent == "lease":
            prefill.setdefault("prompt", text)
            if final_name:
                prefill["tenant_name"] = final_name
            prefill.setdefault("property_type", self._infer_property_type(lowered))
            prefill.setdefault("property_address", self._extract_address_hint(text) or "")
            prefill.setdefault("monthly_rent", amount)
            prefill.setdefault("currency", "USD")
            prefill.setdefault("rent_due_day", 1)
            prefill.setdefault("signature_fields", {"tenant_signature": True, "landlord_signature": True})
            return prefill

        if intent == "agreement":
            agreement_type = "nda" if "nda" in lowered else "service" if "service" in lowered else "contract"
            prefill.setdefault("prompt", text)
            prefill.setdefault("title", self._agreement_title_from_text(text, agreement_type))
            if final_name:
                prefill["client_name"] = final_name
                prefill["client_email"] = final_email or prefill.get("client_email", "")
            elif emails:
                prefill["client_email"] = emails[0]
            prefill.setdefault("agreement_type", agreement_type)
            prefill.setdefault("priority", "standard")
            return prefill

        if intent == "contact":
            if final_name:
                parts = final_name.strip().split(" ", 1)
                prefill.setdefault("first_name", parts[0])
                if len(parts) > 1:
                    prefill.setdefault("last_name", parts[1])
            if final_email:
                prefill.setdefault("email", final_email)
            phone_match = re.search(r"\+?[\d][\d\s\-\(\)]{6,}\d", text)
            if phone_match and not prefill.get("phone"):
                prefill["phone"] = re.sub(r"[\s\-\(\)]", "", phone_match.group(0))
            return prefill

        if intent == "call":
            phone_match = re.search(r"\+?[\d][\d\s\-\(\)]{6,}\d", text)
            if phone_match and not prefill.get("phone_number"):
                prefill["phone_number"] = re.sub(r"[\s\-\(\)]", "", phone_match.group(0))
            if not prefill.get("phone_number") and workflow_output and workflow_output.get("phone_number"):
                prefill["phone_number"] = workflow_output["phone_number"]
            if not prefill.get("purpose"):
                prefill["purpose"] = text[:120]
            return prefill

        return prefill

    async def _extract_workflow_prefill_with_ai(self, intent: str, transcript: str, current_values: dict) -> dict:
        if not settings.OPENAI_API_KEY:
            return {}

        prompt = self._workflow_prefill_ai_prompt(intent, transcript, current_values)

        def call_openai() -> tuple[str | None, int]:
            try:
                from openai import OpenAI
            except ImportError:
                return None, 0

            try:
                client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=20.0, max_retries=1)
                response = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    response_format={"type": "json_object"},
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You extract form-prefill JSON for a business workflow. "
                                "Return only valid JSON. Do not invent people, emails, dates, or prices "
                                "that the user did not state or clearly imply."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                )
                raw_content = response.choices[0].message.content
                tok = getattr(getattr(response, "usage", None), "total_tokens", 0) or max(1, (len(prompt) + len(raw_content or "")) // 4)
                return raw_content, tok
            except Exception:
                return None, 0

        content, extracted_tokens = await asyncio.to_thread(call_openai)
        if content:
            asyncio.create_task(self.log_ai_usage(
                "system", f"prefill_{intent}", "success",
                tokens_used=extracted_tokens,
                prompt_text=prompt,
                response_text=content
            ))
        if not content:
            return {}

        try:
            parsed = json.loads(self._strip_json_code_fence(content))
        except (TypeError, ValueError):
            return {}

        raw_prefill = parsed.get("prefill") if isinstance(parsed, dict) else None
        if not isinstance(raw_prefill, dict):
            raw_prefill = parsed if isinstance(parsed, dict) else {}
        sanitized = self._sanitize_ai_prefill(intent, raw_prefill)

        recipient_name = parsed.get("recipient_name") if isinstance(parsed, dict) else None
        if isinstance(recipient_name, str) and recipient_name.strip():
            sanitized["_recipient_name"] = recipient_name.strip()[:120]

        return sanitized

    @staticmethod
    def _workflow_prefill_ai_prompt(intent: str, transcript: str, current_values: dict) -> str:
        field_guides = {
            "invoice": {
                "fields": {
                    "client_name": "person/company being billed",
                    "client_email": "email only if explicitly provided",
                    "currency": "3-letter code, default omitted unless stated",
                    "notes": "short invoice note from the request",
                    "due_date": "YYYY-MM-DD when stated or clearly relative to current_date",
                    "payment_due_date": "same as due_date when applicable",
                    "items": [{"description": "work/product", "quantity": 1, "unit_price": 0}],
                }
            },
            "bulk_message": {
                "fields": {
                    "channel": "email, sms, whatsapp, or in_app",
                    "recipient_emails": ["explicit email addresses"],
                    "subject": "email subject when useful",
                    "content": "message body the user wants sent",
                    "send_now": "true unless user asks to schedule",
                    "timezone": "timezone if stated",
                }
            },
            "calendar": {
                "fields": {
                    "title": "meeting/event title",
                    "description": "details",
                    "starts_at": "ISO datetime when stated or clearly relative to current_date",
                    "ends_at": "ISO datetime, infer duration only when user implies it",
                    "meeting_mode": "online or offline",
                    "location": "physical location if stated",
                    "meeting_link": "online link if stated",
                    "timezone": "timezone if stated",
                    "reminder_minutes": "integer reminder if stated",
                }
            },
            "lease": {
                "fields": {
                    "prompt": "lease generation request",
                    "tenant_name": "tenant",
                    "tenant_email": "email only if explicitly provided",
                    "property_type": "apartment, house, office_space, shop, warehouse, or land",
                    "property_address": "property address",
                    "monthly_rent": "monthly rent as number",
                    "security_deposit": "deposit as number",
                    "currency": "3-letter code",
                    "rent_due_day": "1-31",
                    "start_date": "YYYY-MM-DD",
                    "end_date": "YYYY-MM-DD",
                    "custom_terms": "extra terms",
                }
            },
            "agreement": {
                "fields": {
                    "prompt": "agreement generation request",
                    "title": "agreement title",
                    "client_name": "client/other party",
                    "client_email": "email only if explicitly provided",
                    "client_phone": "phone if explicitly provided",
                    "agreement_type": "contract, service, nda, partnership, employment, vendor, or other",
                    "priority": "low, standard, high, or urgent",
                    "start_date": "YYYY-MM-DD",
                    "end_date": "YYYY-MM-DD",
                }
            },
            "contact": {
                "fields": {
                    "first_name": "contact first name",
                    "last_name": "contact last name if stated",
                    "phone": "phone number if explicitly stated",
                    "email": "email address if explicitly stated",
                    "date_of_birth": "YYYY-MM-DD if explicitly stated",
                    "notes": "any notes about the contact if stated",
                }
            },
            "email": {
                "fields": {
                    "recipient_email": "email address of the recipient",
                    "subject": "email subject if stated",
                    "content": "message body the user wants sent",
                }
            },
            "group": {
                "fields": {
                    "title": "group name",
                    "description": "group description",
                }
            },
            "call": {
                "fields": {
                    "phone_number": "phone number to call",
                    "purpose": "reason for calling",
                }
            },
        }
        payload = {
            "intent": intent,
            "current_date": utc_now().date().isoformat(),
            "transcript": transcript,
            "current_values": current_values,
            "allowed_output": {
                "recipient_name": "best person/company name for contact lookup, if present",
                "prefill": field_guides.get(intent, {}).get("fields", {}),
            },
        }
        return json.dumps(payload, ensure_ascii=True, default=str)

    @staticmethod
    def _strip_json_code_fence(content: str) -> str:
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        return cleaned.strip()

    @classmethod
    def _sanitize_ai_prefill(cls, intent: str, raw: dict) -> dict:
        allowed = {
            "invoice": {"client_name", "client_email", "currency", "tax_rate", "notes", "items", "due_date", "payment_due_date"},
            "bulk_message": {"channel", "recipient_emails", "contact_ids", "group_ids", "subject", "content", "send_now", "timezone", "scheduled_at"},
            "calendar": {"title", "description", "starts_at", "ends_at", "meeting_mode", "contact_ids", "timezone", "reminder_minutes", "location", "meeting_link"},
            "lease": {
                "prompt", "title", "tenant_name", "tenant_email", "tenant_phone", "property_type", "property_address",
                "monthly_rent", "security_deposit", "currency", "rent_due_day", "start_date", "end_date", "custom_terms",
                "signature_fields",
            },
            "agreement": {
                "prompt", "title", "client_name", "client_email", "client_phone", "agreement_type", "priority",
                "start_date", "end_date",
            },
            "contact": {"first_name", "last_name", "phone", "email", "date_of_birth", "notes"},
            "email": {"recipient_email", "subject", "content"},
            "group": {"title", "description", "member_ids"},
            "call": {"phone_number", "purpose"},
        }.get(intent, set())
        clean: dict = {}
        for key, value in raw.items():
            if key not in allowed or value in (None, "", []):
                continue
            clean[key] = cls._sanitize_ai_value(key, value)
        if intent == "invoice" and isinstance(raw.get("items"), list):
            items = []
            for item in raw["items"][:20]:
                if not isinstance(item, dict):
                    continue
                description = str(item.get("description") or "Service").strip()[:120]
                quantity = cls._coerce_int(item.get("quantity"), default=1, minimum=1)
                unit_price = cls._coerce_float(item.get("unit_price"), default=0.0, minimum=0.0)
                items.append({"description": description or "Service", "quantity": quantity, "unit_price": unit_price})
            if items:
                clean["items"] = items
        return clean

    @staticmethod
    def _sanitize_ai_value(key: str, value):
        if key in {"recipient_emails", "contact_ids", "group_ids"}:
            return [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []
        if key in {"send_now"}:
            return bool(value)
        if key in {"tax_rate", "monthly_rent", "security_deposit", "reminder_minutes"}:
            return WorkflowPrefillMixin._coerce_float(value, default=0.0, minimum=0.0)
        if key in {"rent_due_day"}:
            return WorkflowPrefillMixin._coerce_int(value, default=1, minimum=1, maximum=31)
        if key == "currency":
            return str(value).strip().upper()[:3]
        if key == "signature_fields" and isinstance(value, dict):
            return {
                "tenant_signature": bool(value.get("tenant_signature", True)),
                "landlord_signature": bool(value.get("landlord_signature", True)),
            }
        if key == "items":
            return value
        return str(value).strip()[:3000]

    @staticmethod
    def _coerce_float(value, default: float = 0.0, minimum: float | None = None, maximum: float | None = None) -> float:
        try:
            number = float(str(value).replace(",", ""))
        except (TypeError, ValueError):
            number = default
        if minimum is not None:
            number = max(minimum, number)
        if maximum is not None:
            number = min(maximum, number)
        return number

    @staticmethod
    def _coerce_int(value, default: int = 0, minimum: int | None = None, maximum: int | None = None) -> int:
        try:
            number = int(float(str(value).replace(",", "")))
        except (TypeError, ValueError):
            number = default
        if minimum is not None:
            number = max(minimum, number)
        if maximum is not None:
            number = min(maximum, number)
        return number

    @staticmethod
    def _workflow_missing_fields(intent: str, prefill: dict) -> list[str]:
        required = {
            "invoice": ["client_name", "items"],
            "bulk_message": ["content"],
            "calendar": ["title", "starts_at", "ends_at"],
            "lease": ["prompt"],
            "agreement": ["prompt", "client_name"],
            "contact": ["first_name"],
            "email": ["recipient_email", "content"],
            "group": ["title"],
            "call": ["phone_number"],
        }.get(intent, [])
        missing = [field for field in required if prefill.get(field) in (None, "", [])]
        if intent == "bulk_message" and not prefill.get("recipient_emails") and not prefill.get("contact_ids") and not prefill.get("group_ids"):
            missing.append("recipients")
        return missing

    @staticmethod
    def _workflow_create_config(intent: str) -> dict:
        configs = {
            "invoice": {"endpoint": "/api/v1/invoices", "submit_label": "Create Invoice"},
            "bulk_message": {"endpoint": "/api/v1/smartflow/bulk-messages", "submit_label": "Create Bulk Message"},
            "calendar": {"endpoint": "/api/v1/smartflow/calendar/events", "submit_label": "Schedule Meeting"},
            "lease": {"endpoint": "/api/v1/smartflow/leases/generate", "submit_label": "Generate Lease"},
            "agreement": {"endpoint": "/api/v1/smartflow/agreements/generate", "submit_label": "Generate Agreement"},
            "contact": {"endpoint": "/api/v1/smartflow/contacts", "submit_label": "Save Contact"},
            "email": {"endpoint": "/api/v1/smartflow/messages", "submit_label": "Send Email"},
            "group": {"endpoint": "/api/v1/smartflow/groups", "submit_label": "Create Group"},
            "call": {"endpoint": "/api/v1/smartflow/calls/outbound", "submit_label": "Initiate Call"},
        }
        return configs[intent]

    @staticmethod
    def _workflow_label(intent: str) -> str:
        return {"invoice": "Invoice", "bulk_message": "Bulk message", "calendar": "Calendar", "lease": "Lease", "agreement": "Agreement", "contact": "Contact", "email": "Email", "group": "Group", "call": "Call"}.get(intent, "AI")

    @staticmethod
    def _extract_qty_and_price(text: str, default_amount: float | None = None) -> tuple[int, float]:
        # Standard fallback: check for numbers preceding typical item words (allowing optional adjective)
        qty_match = re.search(r"\b(\d+)\s+(?:[\w-]+\s+)?(?:items?|pcs?|copies|designs?|hours?|days?|services?)\b", text, flags=re.IGNORECASE)
        qty = int(qty_match.group(1)) if qty_match else 1

        # Determine the price
        price_match = re.search(r"(?:\$|usd\s*)\s*([0-9][0-9,]*(?:\.\d{1,2})?)", text, flags=re.IGNORECASE)
        if not price_match:
            price_match = re.search(r"([0-9][0-9,]*(?:\.\d{1,2})?)\s*(?:dollars?|usd|/month|per month)", text, flags=re.IGNORECASE)

        amount = float(price_match.group(1).replace(",", "")) if price_match else (default_amount or 0.0)

        # If "each" or "per" or "a piece" is mentioned, the amount is the unit price
        if re.search(r"\b(?:each|per|/|a piece)\b", text, flags=re.IGNORECASE):
            unit_price = amount
        else:
            # Otherwise, the amount is the total worth, so divide by quantity
            unit_price = amount / qty if qty > 0 else amount

        return qty, unit_price

    @staticmethod
    def _parse_due_date(due_date_str: str | None, transcript: str) -> str | None:
        now = utc_now()

        # Parse relative phrases from due_date_str or the raw transcript text
        val = (due_date_str or "").strip().lower() or transcript.lower()

        if "tomorrow" in val:
            return (now + timedelta(days=1)).date().isoformat()
        if "next week" in val:
            return (now + timedelta(days=7)).date().isoformat()
        if "next month" in val:
            return (now + timedelta(days=30)).date().isoformat()

        # Check standard date formats like 2026-06-15 or 06-15-2026
        match_iso = re.search(r"(\d{4})[-/](\d{2})[-/](\d{2})", val)
        if match_iso:
            return f"{match_iso.group(1)}-{match_iso.group(2)}-{match_iso.group(3)}"

        # Default fallback to 7 days from now (standard payment terms)
        return (now + timedelta(days=7)).date().isoformat()

    @staticmethod
    def _extract_money_amount(text: str) -> float | None:
        match = re.search(r"(?:\$|usd\s*)\s*([0-9][0-9,]*(?:\.\d{1,2})?)", text, flags=re.IGNORECASE)
        if not match:
            match = re.search(r"([0-9][0-9,]*(?:\.\d{1,2})?)\s*(?:dollars?|usd|/month|per month)", text, flags=re.IGNORECASE)
        return float(match.group(1).replace(",", "")) if match else None

    @staticmethod
    def _extract_emails(text: str) -> list[str]:
        return re.findall(r"[\w.\-+]+@[\w.\-]+\.[A-Za-z]{2,}", text)

    @staticmethod
    def _extract_name_phrase(text: str) -> str | None:
        patterns = [
            r"\bfor\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})",
            r"\bwith\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})",
            r"\bto\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})",
            r"\bclient\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})",
            r"\btenant\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})",
        ]
        stop_words = {"Apartment", "Office", "House", "Shop", "Warehouse", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                candidate = match.group(1).strip()
                if candidate.split()[0] not in stop_words:
                    return candidate
        return None

    @staticmethod
    def _extract_work_description(text: str, recipient_name: str | None = None) -> str | None:
        cleaned_text = text
        if recipient_name:
            # Strip "for Sarah", "to Sarah", etc. case-insensitively
            cleaned_text = re.sub(rf"\b(?:for|to|with|client|tenant)\s+{re.escape(recipient_name)}\b", "", cleaned_text, flags=re.IGNORECASE)

        match = re.search(r"\bfor\s+(.+?)\s+(?:worth|for|\$|usd|at)\b", cleaned_text, flags=re.IGNORECASE)
        if not match:
            match = re.search(r"\bfor\s+([^$]+)$", cleaned_text, flags=re.IGNORECASE)
        return match.group(1).strip()[:120] if match else None

    @staticmethod
    def _short_subject_from_text(text: str) -> str:
        cleaned = re.sub(r"\s+", " ", text.strip())
        return cleaned if len(cleaned) <= 80 else cleaned[:77].rstrip() + "..."

    @staticmethod
    def _calendar_title_from_text(text: str) -> str:
        cleaned = re.sub(r"\b(schedule|create|set up|meeting|calendar|event)\b", "", text, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" -:,.")
        return cleaned[:140] if cleaned else "Meeting"

    @staticmethod
    def _infer_property_type(lowered: str) -> str:
        for value in ("apartment", "house", "office_space", "shop", "warehouse", "land"):
            if value.replace("_", " ") in lowered:
                return value
        return "office_space" if "office" in lowered else "apartment"

    @staticmethod
    def _extract_address_hint(text: str) -> str | None:
        match = re.search(r"\b(?:at|located at|property at)\s+(.+?)(?:\s+for\s+\$|\s+with\s+|\s+rent|\s*$)", text, flags=re.IGNORECASE)
        return match.group(1).strip(" ,.")[:300] if match else None

    @staticmethod
    def _agreement_title_from_text(text: str, agreement_type: str) -> str:
        if agreement_type == "nda":
            return "NDA Agreement"
        if agreement_type == "service":
            return "Service Agreement"
        cleaned = re.sub(r"\b(create|draft|agreement|contract|for)\b", "", text, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" -:,.")
        return f"{cleaned[:120]} Agreement" if cleaned else "Agreement"

    async def _replay_linked_resource(self, user_id: str, history: dict) -> dict | None:
        related = history.get("related_resource") or {}
        resource_type = related.get("type")
        resource_id = related.get("id")
        if not resource_type or not resource_id:
            return None

        if resource_type == "invoice" and ObjectId.is_valid(resource_id):
            invoice = await self.db.invoices.find_one({"_id": ObjectId(resource_id), "owner_user_id": user_id})
            if invoice:
                return {
                    "result_type": "invoice",
                    "resource_id": resource_id,
                    "resource_type": "invoice",
                    "resource": {
                        "id": resource_id,
                        "invoice_number": invoice.get("invoice_number"),
                        "status": invoice.get("status"),
                        "total_amount": invoice.get("total_amount"),
                        "client_name": invoice.get("client_name"),
                    },
                }

        if resource_type == "bulk_message" and ObjectId.is_valid(resource_id):
            bulk_message = await self.db.bulk_messages.find_one({"_id": ObjectId(resource_id), "user_id": user_id})
            if bulk_message:
                serialized = self._serialize_bulk_message(bulk_message)
                return {
                    "result_type": "bulk_message",
                    "resource_id": resource_id,
                    "resource_type": "bulk_message",
                    "resource": serialized,
                }

        if resource_type == "document" and ObjectId.is_valid(resource_id):
            document = await self.db.documents.find_one({"_id": ObjectId(resource_id), "user_id": user_id})
            if document:
                serialized = self._with_preview_url(self._to_public(document))
                return {
                    "result_type": "document",
                    "resource_id": resource_id,
                    "resource_type": "document",
                    "resource": serialized,
                }

        if resource_type == "agreement" and ObjectId.is_valid(resource_id):
            agreement = await self.db.agreements.find_one({"_id": ObjectId(resource_id), "user_id": user_id})
            if agreement:
                return {
                    "result_type": "agreement",
                    "resource_id": resource_id,
                    "resource_type": "agreement",
                    "resource": self._serialize_agreement(agreement, include_content=False),
                }
        return None

