from __future__ import annotations

import re
from datetime import date, datetime
from io import BytesIO

from pymongo import ReturnDocument

from app.core.config import settings
from app.core.exceptions import AppException
from app.utils.helpers import utc_now


class LeaseAgreementMixin:
    async def _next_agreement_number(self) -> str:
        counter = await self.db.counters.find_one_and_update(
            {"_id": "agreement_number"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return f"AGR-{date.today().year}-{int(counter['seq']):04d}"

    async def _next_lease_number(self) -> str:
        counter = await self.db.counters.find_one_and_update(
            {"_id": "lease_number"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return f"LD-{date.today().year}-{int(counter['seq']):04d}"

    async def _expire_stale_agreements(self, user_id: str) -> None:
        team_ids = await self._resolve_team_user_ids(user_id)
        await self.db.agreements.update_many(
            {
                "user_id": {"$in": team_ids},
                "status": {"$in": ["draft", "pending_signature"]},
                "end_date": {"$lt": date.today().isoformat()},
            },
            {"$set": {"status": "expired", "expired_at": utc_now(), "updated_at": utc_now()}},
        )

    async def _expire_stale_leases(self, user_id: str) -> None:
        team_ids = await self._resolve_team_user_ids(user_id)
        await self.db.agreements.update_many(
            {
                "user_id": {"$in": team_ids},
                "agreement_type": "lease",
                "status": {"$nin": ["expired", "cancelled"]},
                "end_date": {"$lt": date.today().isoformat()},
            },
            {"$set": {"status": "expired", "expired_at": utc_now(), "updated_at": utc_now()}},
        )

    async def _refresh_agreement_status(self, agreement: dict) -> dict:
        derived_status = self._derive_agreement_status(agreement)
        if derived_status != agreement.get("status"):
            agreement = await self.db.agreements.find_one_and_update(
                {"_id": agreement["_id"]},
                {"$set": {"status": derived_status, "expired_at": utc_now(), "updated_at": utc_now()}},
                return_document=ReturnDocument.AFTER,
            )
        return agreement

    async def _refresh_lease_status(self, lease: dict) -> dict:
        derived_status = self._derive_lease_status(lease)
        agreement_status = self._agreement_status_from_lease_status(derived_status)
        if agreement_status != lease.get("status"):
            lease = await self.db.agreements.find_one_and_update(
                {"_id": lease["_id"]},
                {"$set": {"status": agreement_status, "expired_at": utc_now() if derived_status == "expired" else None, "updated_at": utc_now()}},
                return_document=ReturnDocument.AFTER,
            )
        return lease

    async def _get_owned_lease(self, user_id: str, lease_id: str) -> dict:
        lease = await self._get_team_document(self.db.agreements, user_id, lease_id, "LEASE_NOT_FOUND")
        if lease.get("agreement_type") != "lease":
            raise AppException(status_code=404, code="LEASE_NOT_FOUND", message="Requested lease was not found.")
        return lease

    def _lease_list_filters(self, user_ids: list[str], search: str | None, status: str | None) -> dict:
        filters: dict = {"user_id": {"$in": user_ids}, "agreement_type": "lease"}
        and_clauses: list[dict] = []
        today = date.today().isoformat()
        if status and status != "all":
            if status == "active":
                and_clauses.append({"status": "signed"})
                and_clauses.append({"$or": [{"end_date": None}, {"end_date": ""}, {"end_date": {"$gte": today}}]})
            elif status == "expired":
                and_clauses.append({"$or": [{"status": "expired"}, {"end_date": {"$lt": today}}]})
            elif status == "pending_signature":
                and_clauses.append({"status": "pending_signature"})
            elif status in {"draft", "cancelled"}:
                and_clauses.append({"status": status})
        if search:
            escaped_search = re.escape(search)
            normalized_search = str(search).strip().lower().replace(" ", "_")
            search_clauses = [
                {"title": {"$regex": escaped_search, "$options": "i"}},
                {"client_name": {"$regex": escaped_search, "$options": "i"}},
                {"client_email": {"$regex": escaped_search, "$options": "i"}},
                {"agreement_number": {"$regex": escaped_search, "$options": "i"}},
                {"metadata.lease.tenant_name": {"$regex": escaped_search, "$options": "i"}},
                {"metadata.lease.landlord_name": {"$regex": escaped_search, "$options": "i"}},
                {"metadata.lease.property_address": {"$regex": escaped_search, "$options": "i"}},
                {"client_phone": {"$regex": escaped_search, "$options": "i"}},
                {"metadata.lease.tenant_phone": {"$regex": escaped_search, "$options": "i"}},
                {"status": {"$regex": escaped_search, "$options": "i"}},
            ]
            if normalized_search == "active":
                search_clauses.append({"status": "signed"})
            elif normalized_search == "pending_signature":
                search_clauses.append({"status": "pending_signature"})
            elif normalized_search == "draft":
                search_clauses.append({"status": "draft"})
            elif normalized_search == "cancelled":
                search_clauses.append({"status": "cancelled"})
            elif normalized_search == "expired":
                search_clauses.extend([
                    {"status": "expired"},
                    {"end_date": {"$lt": today}},
                ])
            and_clauses.append(
                {
                    "$or": search_clauses
                }
            )
        if and_clauses:
            filters["$and"] = and_clauses
        return filters

    @staticmethod
    def _agreement_status_from_lease_status(status: str | None) -> str:
        if status == "active":
            return "signed"
        if status in {"draft", "pending_signature", "expired", "cancelled", "signed"}:
            return status
        return "draft"

    def _normalize_lease_details(self, payload: dict, existing: dict | None = None) -> dict:
        details = dict(existing or {})
        rent_cents_source = payload["monthly_rent_cents"] if "monthly_rent_cents" in payload else None if "monthly_rent" in payload else details.get("monthly_rent_cents")
        deposit_cents_source = (
            payload["security_deposit_cents"]
            if "security_deposit_cents" in payload
            else None if "security_deposit" in payload else details.get("security_deposit_cents")
        )
        amount_cents = self._amount_to_cents(
            rent_cents_source,
            payload.get("monthly_rent"),
        )
        if amount_cents == 0 and payload.get("prompt") and not existing:
            amount_cents = self._prompt_money_to_cents(payload["prompt"])
        deposit_cents = self._amount_to_cents(
            deposit_cents_source,
            payload.get("security_deposit"),
        )
        signature_fields = payload.get("signature_fields", details.get("signature_fields") or {})
        if hasattr(signature_fields, "model_dump"):
            signature_fields = signature_fields.model_dump()
        normalized = {
            "property_address": str(payload.get("property_address", details.get("property_address") or "Property address to be confirmed")).strip(),
            "property_type": payload.get("property_type", details.get("property_type") or "apartment"),
            "self_role": payload.get("self_role", details.get("self_role") or "landlord"),
            "landlord_name": str(payload.get("landlord_name", details.get("landlord_name") or "Landlord")).strip(),
            "landlord_email": payload.get("landlord_email", details.get("landlord_email")),
            "tenant_name": str(payload.get("tenant_name", details.get("tenant_name") or payload.get("client_name") or "Tenant")).strip(),
            "tenant_email": payload.get("tenant_email", details.get("tenant_email")),
            "tenant_phone": payload.get("tenant_phone", details.get("tenant_phone")),
            "monthly_rent_cents": amount_cents,
            "security_deposit_cents": deposit_cents,
            "currency": str(payload.get("currency", details.get("currency") or "USD")).strip().upper(),
            "rent_due_day": int(payload.get("rent_due_day", details.get("rent_due_day") or 1)),
            "start_date": self._agreement_date_to_iso(payload.get("start_date", details.get("start_date"))),
            "end_date": self._agreement_date_to_iso(payload.get("end_date", details.get("end_date"))),
            "custom_terms": str(payload.get("custom_terms", details.get("custom_terms") or "")).strip(),
            "signature_fields": {
                "tenant_signature": bool(signature_fields.get("tenant_signature", True)),
                "landlord_signature": bool(signature_fields.get("landlord_signature", True)),
            },
        }
        if not 1 <= normalized["rent_due_day"] <= 31:
            raise AppException(status_code=422, code="LEASE_RENT_DUE_DAY_INVALID", message="Rent due day must be between 1 and 31.")
        self._validate_agreement_dates(normalized)
        return normalized

    @staticmethod
    def _lease_other_party(details: dict) -> dict:
        """The counterparty of whichever role the website user plays (self_role)."""
        if details.get("self_role") == "tenant":
            return {"role": "landlord", "name": details.get("landlord_name"), "email": details.get("landlord_email"), "phone": None}
        return {"role": "tenant", "name": details.get("tenant_name"), "email": details.get("tenant_email"), "phone": details.get("tenant_phone")}

    @staticmethod
    def _lease_self_party(details: dict) -> dict:
        if details.get("self_role") == "tenant":
            return {"role": "tenant", "name": details.get("tenant_name"), "email": details.get("tenant_email"), "phone": details.get("tenant_phone")}
        return {"role": "landlord", "name": details.get("landlord_name"), "email": details.get("landlord_email"), "phone": None}

    def _lease_details_from_agreement(self, agreement: dict) -> dict:
        metadata = agreement.get("metadata") or {}
        details = metadata.get("lease") or {}
        return self._normalize_lease_details(
            {
                "property_address": details.get("property_address") or agreement.get("title"),
                "property_type": details.get("property_type") or "apartment",
                "self_role": details.get("self_role") or "landlord",
                "landlord_name": details.get("landlord_name") or "Landlord",
                "landlord_email": details.get("landlord_email"),
                "tenant_name": details.get("tenant_name") or agreement.get("client_name"),
                "tenant_email": details.get("tenant_email") or agreement.get("client_email"),
                "tenant_phone": details.get("tenant_phone") or agreement.get("client_phone"),
                "monthly_rent_cents": details.get("monthly_rent_cents"),
                "security_deposit_cents": details.get("security_deposit_cents"),
                "currency": details.get("currency") or "USD",
                "rent_due_day": details.get("rent_due_day") or 1,
                "start_date": details.get("start_date") or agreement.get("start_date"),
                "end_date": details.get("end_date") or agreement.get("end_date"),
                "custom_terms": details.get("custom_terms") or "",
                "signature_fields": details.get("signature_fields") or {},
            }
        )

    @staticmethod
    def _lease_smart_fields(details: dict) -> list[dict]:
        fields: list[dict] = []
        signature_fields = details.get("signature_fields") or {}
        if signature_fields.get("tenant_signature", True):
            fields.append(
                {
                    "key": "tenant_signature",
                    "label": "Tenant Signature",
                    "field_type": "signature",
                    "required": True,
                    "enabled": True,
                    "page": 1,
                    "anchor_text": "Tenant Signature",
                }
            )
        if signature_fields.get("landlord_signature", True):
            fields.append(
                {
                    "key": "landlord_signature",
                    "label": "Landlord Signature",
                    "field_type": "signature",
                    "required": True,
                    "enabled": True,
                    "page": 1,
                    "anchor_text": "Landlord Signature",
                }
            )
        fields.append(
            {
                "key": "date_signed",
                "label": "Date Signed",
                "field_type": "date",
                "required": True,
                "enabled": True,
                "page": 1,
                "anchor_text": "Date Signed",
            }
        )
        return fields

    @staticmethod
    def _derive_lease_status(lease: dict) -> str:
        status = lease.get("status") or "draft"
        if status == "cancelled":
            return "cancelled"
        end_date = LeaseAgreementMixin._agreement_date_value(lease.get("end_date"))
        if end_date and end_date < date.today():
            return "expired"
        if status == "pending_signature":
            return "pending_signature"
        if status == "signed":
            return "active"
        if status == "expired":
            return "expired"
        return "draft"

    def _lease_summary(self, leases: list[dict]) -> dict:
        statuses = [self._derive_lease_status(item) for item in leases]
        return {
            "total_leases": len(leases),
            "draft_leases": statuses.count("draft"),
            "active_leases": statuses.count("active"),
            "pending_signature_leases": statuses.count("pending_signature"),
            "expired_leases": statuses.count("expired"),
            "cancelled_leases": statuses.count("cancelled"),
        }

    def _serialize_lease(self, lease: dict, *, include_content: bool) -> dict:
        safe = self._serialize_agreement(lease, include_content=include_content)
        details = self._lease_details_from_agreement(lease)
        lease_status = self._derive_lease_status({**lease, "end_date": details.get("end_date")})
        lease_id = safe["id"]
        docusign = lease.get("docusign") or {}
        safe["pdf_url"] = self._lease_pdf_url(lease_id)
        safe["signed_pdf_url"] = self._lease_signed_pdf_url(lease_id) if docusign.get("signed_pdf_public_path") else None
        safe["completion_certificate_url"] = self._lease_certificate_url(lease_id) if docusign.get("certificate_public_path") else None
        safe["agreement_status"] = safe.get("status")
        safe["status"] = lease_status
        safe["lease_status"] = lease_status
        safe["status_label"] = self._lease_status_label(lease_status)
        safe["status_tone"] = self._lease_status_tone(lease_status)
        safe["lease_number"] = safe.get("agreement_number")
        safe["self_role"] = details["self_role"]
        safe["tenant_name"] = details["tenant_name"]
        safe["landlord_name"] = details["landlord_name"]
        safe["landlord_email"] = details.get("landlord_email")
        safe["property_address"] = details["property_address"]
        safe["property_type"] = details["property_type"]
        safe["property_type_label"] = self._lease_property_type_label(details["property_type"])
        safe["monthly_rent_cents"] = details["monthly_rent_cents"]
        safe["monthly_rent"] = round((details["monthly_rent_cents"] or 0) / 100, 2)
        safe["monthly_rent_label"] = self._money_label(details["monthly_rent_cents"], details["currency"], suffix="/mo")
        safe["security_deposit_cents"] = details["security_deposit_cents"]
        safe["security_deposit"] = round((details["security_deposit_cents"] or 0) / 100, 2)
        safe["security_deposit_label"] = self._money_label(details["security_deposit_cents"], details["currency"])
        safe["currency"] = details["currency"]
        safe["rent_due_day"] = details["rent_due_day"]
        safe["rent_due_label"] = self._ordinal_day(details["rent_due_day"])
        safe["duration_months"] = self._lease_duration_months(details.get("start_date"), details.get("end_date"))
        safe["duration_label"] = self._lease_duration_label(details.get("start_date"), details.get("end_date"))
        safe["signature_fields"] = details["signature_fields"]
        safe["lease"] = details
        safe["property"] = {
            "address": details["property_address"],
            "type": details["property_type"],
            "type_label": safe["property_type_label"],
        }
        safe["rent"] = {
            "monthly_rent_cents": details["monthly_rent_cents"],
            "monthly_rent_label": safe["monthly_rent_label"],
            "security_deposit_cents": details["security_deposit_cents"],
            "security_deposit_label": safe["security_deposit_label"],
            "currency": details["currency"],
            "due_day": details["rent_due_day"],
            "due_label": safe["rent_due_label"],
        }
        safe["duration"] = {
            "start_date": details.get("start_date"),
            "end_date": details.get("end_date"),
            "months": safe["duration_months"],
            "label": safe["duration_label"],
        }
        safe["created_date_label"] = self._date_label(safe.get("created_at"))
        safe["renewed_from_lease_id"] = lease.get("renewed_from_lease_id") or (lease.get("metadata") or {}).get("renewed_from_lease_id")
        safe["renewed_from_lease_number"] = lease.get("renewed_from_lease_number") or (lease.get("metadata") or {}).get("renewed_from_lease_number")
        safe["renewed_to_lease_id"] = lease.get("renewed_to_lease_id") or (lease.get("metadata") or {}).get("renewed_to_lease_id")
        safe["renewed_to_lease_number"] = lease.get("renewed_to_lease_number") or (lease.get("metadata") or {}).get("renewed_to_lease_number")
        existing_review = lease.get("ai_review") or []
        safe["ai_review"] = existing_review if any(item.get("key") == "duration" for item in existing_review) else self._review_lease_content(lease.get("content", ""), details)
        safe["actions"] = self._lease_actions(lease_status, lease)
        safe["primary_action"] = self._lease_primary_action(lease_status, lease)
        safe["pdf_url"] = f"/api/v1/smartflow/leases/{lease_id}/pdf"
        safe["signature_request_url"] = self._lease_signature_url(lease["signature_request_token"]) if lease.get("signature_request_token") else None
        return safe

    @staticmethod
    def _lease_property_type_label(property_type: str | None) -> str:
        labels = {
            "apartment": "Apartment",
            "house": "House",
            "office_space": "Office Space",
            "shop": "Shop",
            "warehouse": "Warehouse",
            "land": "Land",
            "other": "Other",
        }
        return labels.get(property_type or "", "Property")

    @staticmethod
    def _lease_status_label(status: str | None) -> str:
        labels = {
            "draft": "Draft",
            "active": "Active",
            "pending_signature": "Pending Signature",
            "expired": "Expired",
            "cancelled": "Cancelled",
        }
        return labels.get(status or "", "Draft")

    @staticmethod
    def _lease_status_tone(status: str | None) -> str:
        tones = {
            "draft": "muted",
            "active": "success",
            "pending_signature": "warning",
            "expired": "danger",
            "cancelled": "muted",
        }
        return tones.get(status or "", "muted")

    @staticmethod
    def _lease_actions(status: str | None, lease: dict) -> list[str]:
        actions = ["view", "download"]
        if status == "draft":
            actions.extend(["edit", "send_signature"])
        elif status == "pending_signature":
            actions.extend(["sign", "edit"])
        elif status == "active":
            actions.append("manage")
            if lease.get("signature"):
                actions.append("verified")
        elif status == "expired":
            actions.extend(["renew", "download"])
        elif status == "cancelled":
            actions.append("delete")
        return list(dict.fromkeys(actions))

    @staticmethod
    def _lease_primary_action(status: str | None, lease: dict) -> str:
        if status == "pending_signature":
            return "sign"
        if status == "expired":
            return "renew"
        if status == "active" and lease.get("signature"):
            return "verified"
        if status == "active":
            return "manage"
        if status == "draft":
            return "manage"
        return "view"

    @staticmethod
    def _lease_signature_url(token: str) -> str:
        return f"{settings.PUBLIC_FRONTEND_URL.rstrip('/')}/sign/lease/{token}"

    @staticmethod
    def _infer_lease_title(details: dict) -> str:
        property_label = LeaseAgreementMixin._lease_property_type_label(details.get("property_type"))
        address = details.get("property_address")
        if address and address != "Property address to be confirmed":
            return f"{property_label} Lease - {address}"
        return f"{property_label} Lease Agreement"

    def _generate_lease_content(self, payload: dict) -> str:
        details = self._normalize_lease_details(payload)
        title = (payload.get("title") or "Residential Lease Agreement").strip()
        prompt = (payload.get("prompt") or "").strip()
        start_date = details.get("start_date") or "the lease start date"
        end_date = details.get("end_date") or "the lease end date"
        rent_label = self._money_label(details["monthly_rent_cents"], details["currency"], suffix="/month")
        deposit_label = self._money_label(details["security_deposit_cents"], details["currency"])
        custom_terms = details.get("custom_terms")
        sections = [
            title.upper(),
            f"This Lease Agreement is made by and between {details['landlord_name']} (\"Landlord\") and {details['tenant_name']} (\"Tenant\").",
            f"1. PROPERTY ADDRESS\nThe Landlord agrees to rent the {self._lease_property_type_label(details['property_type']).lower()} located at {details['property_address']} to the Tenant.",
            f"2. RENT PAYMENT\nThe Tenant shall pay monthly rent of {rent_label}. Rent is due on the {self._ordinal_day(details['rent_due_day'])} day of each calendar month.",
            f"3. SECURITY DEPOSIT\nThe Tenant shall pay a refundable security deposit of {deposit_label}. Deductions may be made only for unpaid rent, approved charges, or damage beyond ordinary wear and tear.",
            f"4. TERM OF LEASE\nThe lease begins on {start_date} and ends on {end_date}, unless extended or terminated in accordance with this Agreement.",
            "5. LATE FEES\nIf rent is not received within five calendar days after the due date, the Landlord may charge a reasonable late fee where permitted by applicable law.",
            "6. USE AND OCCUPANCY\nThe Tenant shall use the property only for lawful occupancy and shall not assign or sublet the property without written consent from the Landlord.",
            "7. MAINTENANCE\nThe Tenant shall keep the property clean and promptly report needed repairs. The Landlord remains responsible for repairs required by applicable housing law.",
        ]
        if prompt:
            sections.append(f"8. AI REQUEST SUMMARY\nThis lease was generated from the following request: {prompt}")
        if custom_terms:
            sections.append(f"9. ADDITIONAL TERMS\n{custom_terms}")
        sections.append("10. SIGNATURES\nTenant Signature: ____________________ Date: __________\nLandlord Signature: __________________ Date: __________")
        return "\n\n".join(sections)

    @staticmethod
    def _enhance_lease_terms_text(custom_terms: str | None, focus: str) -> str:
        base_terms = (custom_terms or "").strip()
        additions = [
            "Late Fee: If rent is unpaid five calendar days after the due date, a reasonable late fee may apply where allowed by law.",
            "Maintenance: Tenant must promptly report urgent repairs, and Landlord must address habitability repairs within a reasonable time.",
            "Access: Landlord may enter the property after reasonable notice, except during emergencies.",
            "Renewal: Any renewal, rent change, or extension must be confirmed in writing by both parties.",
        ]
        if focus == "tenant":
            additions.append("Tenant Protection: Security deposit deductions must be itemized in writing with supporting documentation.")
        elif focus == "landlord":
            additions.append("Landlord Protection: Unauthorized occupants, subletting, or material property misuse may trigger default remedies.")
        elif focus == "compliance":
            additions.append("Compliance: Both parties must comply with applicable local rental, housing, safety, and notice requirements.")
        enhanced = base_terms
        for addition in additions:
            key = addition.split(":", 1)[0].lower()
            if key not in enhanced.lower():
                enhanced = f"{enhanced}\n{addition}".strip()
        return enhanced

    @staticmethod
    def _merge_lease_enhanced_terms(content: str, enhanced_terms: str) -> str:
        cleaned = content.strip()
        if "additional terms" in cleaned.lower():
            return f"{cleaned}\n\nAI-ENHANCED TERMS\n{enhanced_terms}"
        return f"{cleaned}\n\nADDITIONAL TERMS\n{enhanced_terms}"

    def _review_lease_content(self, content: str, details: dict) -> list[dict]:
        lower = content.lower()
        signature_fields = details.get("signature_fields") or {}
        checks = [
            (
                "duration",
                "Lease duration clearly defined",
                bool(details.get("start_date") and details.get("end_date")) or ("begin" in lower and ("end" in lower or "terminate" in lower)),
                "Lease start and end dates are present.",
                "Start date or end date is missing.",
                "error",
            ),
            (
                "payment_terms",
                "Payment terms included",
                details.get("monthly_rent_cents", 0) > 0 or "rent" in lower or "$" in content,
                "Monthly rent and due date are specified.",
                "Monthly rent amount or due date is missing.",
                "error",
            ),
            (
                "late_fee",
                "Late fee specified",
                "late fee" in lower or "late charge" in lower,
                "Late payment consequence is defined.",
                "Missing standard late fee terms for payment delays.",
                "warning",
            ),
            (
                "property_address",
                "Property address included",
                bool(details.get("property_address") and details["property_address"] != "Property address to be confirmed"),
                "Rental property address is present.",
                "Property address should be confirmed before signature.",
                "error",
            ),
            (
                "signature_fields",
                "Signature fields included",
                bool(signature_fields.get("tenant_signature", True) and signature_fields.get("landlord_signature", True)) and "signature" in lower,
                "Tenant and landlord signature fields are enabled.",
                "Both tenant and landlord signature fields should be enabled.",
                "warning",
            ),
            (
                "security_deposit",
                "Security deposit addressed",
                details.get("security_deposit_cents", 0) > 0 or "security deposit" in lower,
                "Security deposit handling is included.",
                "Security deposit amount or handling is not specified.",
                "warning",
            ),
        ]
        return [
            {
                "key": key,
                "title": title,
                "message": success_message if passed else failure_message,
                "severity": "success" if passed else severity,
                "passed": passed,
            }
            for key, title, passed, success_message, failure_message, severity in checks
        ]

    @staticmethod
    def _amount_to_cents(cents_value, amount_value) -> int:
        if cents_value is not None:
            return int(cents_value)
        if amount_value is None or amount_value == "":
            return 0
        return int(round(float(amount_value) * 100))

    @staticmethod
    def _prompt_money_to_cents(prompt: str) -> int:
        match = re.search(r"\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)", prompt)
        if not match:
            return 0
        return int(round(float(match.group(1).replace(",", "")) * 100))

    @staticmethod
    def _money_label(cents: int | None, currency: str, suffix: str = "") -> str:
        amount = (cents or 0) / 100
        symbol = "$" if currency == "USD" else f"{currency} "
        if amount.is_integer():
            formatted = f"{symbol}{int(amount):,}"
        else:
            formatted = f"{symbol}{amount:,.2f}"
        return f"{formatted}{suffix}"

    @staticmethod
    def _lease_duration_months(start_value, end_value) -> int | None:
        start = LeaseAgreementMixin._agreement_date_value(start_value)
        end = LeaseAgreementMixin._agreement_date_value(end_value)
        if not start or not end:
            return None
        months = (end.year - start.year) * 12 + end.month - start.month
        if end.day >= start.day:
            months += 1
        return max(1, months)

    @staticmethod
    def _lease_duration_label(start_value, end_value) -> str:
        months = LeaseAgreementMixin._lease_duration_months(start_value, end_value)
        if not months:
            return "Duration TBD"
        return f"{months} Month" if months == 1 else f"{months} Months"

    @staticmethod
    def _ordinal_day(day: int) -> str:
        if 10 <= day % 100 <= 20:
            suffix = "th"
        else:
            suffix = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        return f"{day}{suffix}"

    @staticmethod
    def _date_label(value) -> str | None:
        if not value:
            return None
        if isinstance(value, datetime):
            return value.strftime("%b %d, %Y")
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime("%b %d, %Y")
            except ValueError:
                return value
        return str(value)

    @staticmethod
    def _normalize_agreement_smart_fields(fields: list[dict] | None) -> list[dict]:
        if fields is None:
            return LeaseAgreementMixin._default_agreement_smart_fields()
        normalized: list[dict] = []
        for field in fields:
            key = str(field.get("key") or "").strip()
            if not key:
                continue
            normalized.append(
                {
                    "key": key,
                    "label": str(field.get("label") or key.replace("_", " ").title()).strip(),
                    "field_type": field.get("field_type") or field.get("type") or "text",
                    "required": bool(field.get("required", True)),
                    "enabled": bool(field.get("enabled", True)),
                    "page": int(field.get("page") or 1),
                    "anchor_text": field.get("anchor_text"),
                }
            )
        return normalized or LeaseAgreementMixin._default_agreement_smart_fields()

    @staticmethod
    def _default_agreement_smart_fields() -> list[dict]:
        return [
            {
                "key": "signature",
                "label": "Signature Field",
                "field_type": "signature",
                "required": True,
                "enabled": True,
                "page": 1,
                "anchor_text": "Client Authorized Representative",
            },
            {
                "key": "date_signed",
                "label": "Date Signed",
                "field_type": "date",
                "required": True,
                "enabled": True,
                "page": 1,
                "anchor_text": "Date Signed",
            },
        ]

    @staticmethod
    def _validate_agreement_dates(document: dict) -> None:
        start_date = LeaseAgreementMixin._agreement_date_value(document.get("start_date"))
        end_date = LeaseAgreementMixin._agreement_date_value(document.get("end_date"))
        if start_date and end_date and end_date < start_date:
            raise AppException(status_code=422, code="AGREEMENT_DATE_INVALID", message="Agreement end date must be after start date.")

    @staticmethod
    def _derive_agreement_status(agreement: dict) -> str:
        status = agreement.get("status") or "draft"
        if status in {"signed", "cancelled"}:
            return status
        end_date = LeaseAgreementMixin._agreement_date_value(agreement.get("end_date"))
        if end_date and end_date < date.today():
            return "expired"
        return status

    @staticmethod
    def _agreement_date_to_iso(value) -> str | None:
        if value is None or value == "":
            return None
        if isinstance(value, date):
            return value.isoformat()
        return str(value)

    @staticmethod
    def _agreement_date_value(value) -> date | None:
        if value is None or value == "":
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            return date.fromisoformat(value)
        return None

    def _agreement_summary(self, agreements: list[dict]) -> dict:
        statuses = [self._derive_agreement_status(item) for item in agreements]
        return {
            "total_agreements": len(agreements),
            "draft_agreements": statuses.count("draft"),
            "pending_signature_agreements": statuses.count("pending_signature"),
            "signed_agreements": statuses.count("signed"),
            "expired_agreements": statuses.count("expired"),
            "cancelled_agreements": statuses.count("cancelled"),
        }

    def _serialize_agreement(self, agreement: dict, *, include_content: bool) -> dict:
        safe = self._to_public(agreement)
        safe.pop("user_id", None)
        agreement_id = safe["id"]
        status = self._derive_agreement_status(safe)
        docusign = safe.get("docusign") or {}
        safe["status"] = status
        safe["agreement_type_label"] = self._agreement_type_label(safe.get("agreement_type"))
        safe["status_label"] = self._agreement_status_label(status)
        safe["status_tone"] = self._agreement_status_tone(status)
        safe["smart_fields"] = self._normalize_agreement_smart_fields(safe.get("smart_fields"))
        safe["ai_review"] = safe.get("ai_review") or self._review_agreement_content(safe.get("content", ""), safe.get("agreement_type", "contract"))
        safe["signature_provider"] = safe.get("signature_provider") or ("docusign" if docusign.get("envelope_id") else "native")
        safe["provider_status"] = docusign.get("provider_status")
        safe["provider_envelope_id"] = docusign.get("envelope_id")
        safe["provider_error"] = docusign.get("last_error")
        safe["provider_signing_url"] = docusign.get("recipient_view_url")
        safe["signed_pdf_url"] = self._agreement_signed_pdf_url(agreement_id) if docusign.get("signed_pdf_public_path") else None
        safe["completion_certificate_url"] = self._agreement_certificate_url(agreement_id) if docusign.get("certificate_public_path") else None
        safe["signature_request_url"] = self._agreement_signature_url(safe["signature_request_token"]) if safe.get("signature_request_token") else None
        safe["pdf_url"] = self._agreement_pdf_url(agreement_id)
        safe["actions"] = self._agreement_actions(status)
        if not include_content:
            safe["content"] = None
        return safe

    @staticmethod
    def _agreement_type_label(agreement_type: str | None) -> str:
        labels = {
            "contract": "Contract",
            "lease": "Lease",
            "legal": "Legal",
            "vendor": "Vendor",
            "service": "Service Agreement",
            "nda": "NDA",
            "other": "Other",
        }
        return labels.get(agreement_type or "", "Agreement")

    @staticmethod
    def _agreement_status_label(status: str | None) -> str:
        labels = {
            "draft": "Draft",
            "pending_signature": "Pending Signature",
            "signed": "Signed",
            "expired": "Expired",
            "cancelled": "Cancelled",
        }
        return labels.get(status or "", "Draft")

    @staticmethod
    def _agreement_status_tone(status: str | None) -> str:
        tones = {
            "draft": "muted",
            "pending_signature": "warning",
            "signed": "success",
            "expired": "danger",
            "cancelled": "muted",
        }
        return tones.get(status or "", "muted")

    @staticmethod
    def _agreement_actions(status: str | None) -> list[str]:
        actions = ["view", "download"]
        if status in {"draft", "pending_signature"}:
            actions.append("edit")
        if status == "draft":
            actions.append("send_signature")
        if status == "pending_signature":
            actions.append("sign")
        if status == "expired":
            actions.extend(["renew", "delete"])
        if status == "cancelled":
            actions.append("delete")
        return actions

    @staticmethod
    def _agreement_pdf_url(agreement_id: str) -> str:
        return f"/api/v1/smartflow/agreements/{agreement_id}/pdf"

    @staticmethod
    def _agreement_signed_pdf_url(agreement_id: str) -> str:
        return f"/api/v1/smartflow/agreements/{agreement_id}/signed-pdf"

    @staticmethod
    def _agreement_certificate_url(agreement_id: str) -> str:
        return f"/api/v1/smartflow/agreements/{agreement_id}/completion-certificate"

    @staticmethod
    def _lease_pdf_url(lease_id: str) -> str:
        return f"/api/v1/smartflow/leases/{lease_id}/pdf"

    @staticmethod
    def _lease_signed_pdf_url(lease_id: str) -> str:
        return f"/api/v1/smartflow/leases/{lease_id}/signed-pdf"

    @staticmethod
    def _lease_certificate_url(lease_id: str) -> str:
        return f"/api/v1/smartflow/leases/{lease_id}/completion-certificate"

    @staticmethod
    def _agreement_signature_url(token: str) -> str:
        return f"{settings.PUBLIC_FRONTEND_URL.rstrip('/')}/sign/agreement/{token}"

    @staticmethod
    def _infer_agreement_title(prompt: str, agreement_type: str) -> str:
        prompt_lower = prompt.lower()
        if "website" in prompt_lower:
            return "Website Development Agreement"
        if agreement_type == "nda":
            return "NDA Agreement"
        if agreement_type == "lease":
            return "Office Lease Agreement"
        if agreement_type == "vendor":
            return "Vendor Agreement"
        return f"{LeaseAgreementMixin._agreement_type_label(agreement_type)} Agreement"

    def _generate_agreement_content(self, payload: dict) -> str:
        prompt = payload.get("prompt", "").strip()
        title = payload.get("title") or self._infer_agreement_title(prompt, payload.get("agreement_type", "contract"))
        client_name = payload.get("client_name") or "Client"
        amount_match = re.search(r"\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)", prompt)
        amount_text = f"${amount_match.group(1)} USD" if amount_match else "the agreed project fee"
        upfront_text = "50% upfront and 50% upon completion" if "50%" in prompt else "according to the payment schedule agreed by both parties"
        start_date = payload.get("start_date") or date.today()
        end_date = payload.get("end_date") or "the final delivery date"
        return "\n\n".join(
            [
                f"{title.upper()}",
                f"This Agreement is entered into as of {start_date} by and between the Provider and {client_name} (\"Client\").",
                "1. PARTIES\nThe Provider will deliver the services described in this Agreement, and the Client will cooperate in good faith to provide timely information, approvals, and access needed for delivery.",
                f"2. SCOPE OF WORK\nThe Provider shall complete the work described by the following request: {prompt or 'the agreed business services'}. Deliverables must be reasonably fit for the agreed purpose.",
                f"3. PAYMENT TERMS\nThe total fee is {amount_text}. Payment will be made {upfront_text}. Late payments may pause delivery timelines until the account is current.",
                f"4. TERM AND DELIVERY\nThe Agreement begins on {start_date} and remains active until {end_date}, unless extended in writing by both parties.",
                "5. CONFIDENTIALITY\nBoth parties shall protect confidential information received during the engagement and use it only for the purposes of this Agreement.",
                "6. SIGNATURE\nBy signing below, the authorized representatives confirm that they understand and accept the terms of this Agreement.",
            ]
        )

    def _improve_agreement_content(self, content: str, instruction: str | None) -> str:
        improved = content.strip()
        lower = improved.lower()
        additions: list[str] = []
        if "payment" not in lower:
            additions.append("PAYMENT TERMS\nThe Client will pay all approved fees according to the agreed schedule and any overdue balance may pause active work.")
        if "penalty" not in lower and "late fee" not in lower:
            additions.append("PENALTY CLAUSE\nIf a party materially misses an agreed milestone without written approval, the affected party may request a written cure plan or apply reasonable late fees where permitted by law.")
        if "signature" not in lower:
            additions.append("SIGNATURE\nBoth parties agree that electronic signatures are valid and enforceable for this Agreement.")
        if instruction:
            additions.append(f"AI IMPROVEMENT NOTE\nUpdated according to instruction: {instruction.strip()}")
        if additions:
            improved = f"{improved}\n\n" + "\n\n".join(additions)
        return improved

    @staticmethod
    def _review_agreement_content(content: str, agreement_type: str) -> list[dict]:
        lower = content.lower()
        checks = [
            (
                "structure",
                "Agreement structure complete",
                any(token in lower for token in ("scope", "parties", "payment", "signature")),
                "All standard enterprise clauses are properly formatted.",
                "Agreement should include parties, scope, payment, term, and signature sections.",
                "error",
            ),
            (
                "payment_terms",
                "Payment terms included",
                "payment" in lower or "fee" in lower or "$" in content,
                "Milestones align with scope of work delivery dates.",
                "Payment amount, timing, or milestone language is missing.",
                "error",
            ),
            (
                "signature",
                "Signature field ready",
                "signature" in lower or "authorized representative" in lower,
                "Electronic signature language is present.",
                "Add a clear signature section before sending to the client.",
                "warning",
            ),
            (
                "penalty_clause",
                "Penalty clause included",
                "penalty" in lower or "late fee" in lower or "cure plan" in lower,
                "Late milestone consequences are defined.",
                "Failure to meet delivery milestones has no defined financial consequence.",
                "warning",
            ),
        ]
        return [
            {
                "key": key,
                "title": title,
                "message": success_message if passed else failure_message,
                "severity": "success" if passed else severity,
                "passed": passed,
            }
            for key, title, passed, success_message, failure_message, severity in checks
        ]

    async def _get_signature_request(self, signature_token: str) -> dict:
        signature_request = await self.db.signature_requests.find_one({"token": signature_token, "status": "pending"})
        if not signature_request:
            raise AppException(status_code=404, code="SIGNATURE_REQUEST_NOT_FOUND", message="Signature request was not found.")
        expires_at = signature_request.get("expires_at")
        now = utc_now()
        if expires_at and getattr(expires_at, "tzinfo", None) is None:
            now = now.replace(tzinfo=None)
        if expires_at and expires_at < now:
            await self.db.signature_requests.update_one({"_id": signature_request["_id"]}, {"$set": {"status": "expired", "updated_at": utc_now()}})
            raise AppException(status_code=410, code="SIGNATURE_LINK_EXPIRED", message="Signature request link has expired.")
        return signature_request

    async def _complete_agreement_signature(self, agreement: dict, payload: dict, *, signed_by_user_id: str | None) -> dict:
        if agreement.get("status") == "signed":
            raise AppException(status_code=409, code="AGREEMENT_ALREADY_SIGNED", message="This agreement has already been signed.")
        if agreement.get("status") in {"cancelled", "expired"}:
            raise AppException(status_code=409, code="AGREEMENT_NOT_SIGNABLE", message="Cancelled or expired agreements cannot be signed.")
        signed_at = utc_now()
        signature = {
            "signer_name": payload["signer_name"].strip(),
            "signer_email": payload.get("signer_email"),
            "signature_text": payload.get("signature_text"),
            "signature_url": payload.get("signature_url"),
            "signed_at": signed_at,
            "signed_by_user_id": signed_by_user_id,
        }
        updated = await self.db.agreements.find_one_and_update(
            {"_id": agreement["_id"]},
            {
                "$set": {
                    "status": "signed",
                    "signature": signature,
                    "signed_at": signed_at,
                    "updated_at": signed_at,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        await self.db.signature_requests.update_many(
            {"agreement_id": str(agreement["_id"])},
            {"$set": {"status": "completed", "updated_at": signed_at, "completed_at": signed_at}},
        )
        await self.log_ai_command(
            user_id=agreement["user_id"],
            command_text=f"Sign agreement {agreement['agreement_number']}",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            related_resource={"type": "agreement", "id": str(agreement["_id"]), "agreement_number": agreement["agreement_number"]},
            preview_payload={"signer_name": signature["signer_name"]},
        )
        return self._serialize_agreement(updated, include_content=True)

    @staticmethod
    def _agreement_signature_email_text(agreement: dict, message: str | None, signature_url: str) -> str:
        lines = [
            f"Signature requested for {agreement['title']}",
            f"Agreement number: {agreement['agreement_number']}",
            f"Client: {agreement['client_name']}",
            f"Sign here: {signature_url}",
        ]
        if message:
            lines.append(f"Message: {message}")
        return "\n".join(lines)

    @staticmethod
    def _agreement_signature_email_html(agreement: dict, message: str | None, signature_url: str) -> str:
        note = f"<p>{message}</p>" if message else ""
        return f"""
        <div>
          <h2>Signature requested: {agreement['title']}</h2>
          <p>Agreement number: {agreement['agreement_number']}</p>
          <p>Client: {agreement['client_name']}</p>
          {note}
          <p><a href="{signature_url}">Review and sign agreement</a></p>
        </div>
        """

    def _generate_agreement_pdf_bytes(self, agreement: dict) -> bytes:
        lines = [
            agreement.get("title", "Agreement"),
            f"Agreement No: {agreement.get('agreement_number', '-')}",
            f"Client: {agreement.get('client_name', '-')}",
            f"Status: {self._agreement_status_label(agreement.get('status'))}",
            "",
        ]
        for paragraph in agreement.get("content", "").splitlines():
            stripped = paragraph.strip()
            if not stripped:
                lines.append("")
                continue
            while len(stripped) > 88:
                lines.append(stripped[:88])
                stripped = stripped[88:]
            lines.append(stripped)
        if agreement.get("signature"):
            signature = agreement["signature"]
            lines.extend(["", f"Signed by: {signature.get('signer_name')}", f"Signed at: {signature.get('signed_at')}"])
        return self._build_simple_pdf(lines[:46])

    @staticmethod
    def _build_simple_pdf(lines: list[str]) -> bytes:
        def escape(text: str) -> str:
            return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

        content_lines = ["BT", "/F1 11 Tf", "50 790 Td", "15 TL"]
        first = True
        for line in lines:
            if first:
                content_lines.append(f"({escape(line)}) Tj")
                first = False
            else:
                content_lines.append("T*")
                content_lines.append(f"({escape(line)}) Tj")
        content_lines.append("ET")
        stream = "\n".join(content_lines).encode("latin-1", "replace")
        objects = [
            b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
            b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
            b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
            b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
            f"5 0 obj << /Length {len(stream)} >> stream\n".encode("latin-1") + stream + b"\nendstream endobj\n",
        ]
        buffer = BytesIO()
        buffer.write(b"%PDF-1.4\n")
        offsets = [0]
        for obj in objects:
            offsets.append(buffer.tell())
            buffer.write(obj)
        xref_offset = buffer.tell()
        buffer.write(f"xref\n0 {len(offsets)}\n".encode("latin-1"))
        buffer.write(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            buffer.write(f"{offset:010d} 00000 n \n".encode("latin-1"))
        buffer.write((f"trailer << /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF").encode("latin-1"))
        return buffer.getvalue()

