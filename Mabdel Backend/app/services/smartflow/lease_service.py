from __future__ import annotations

from datetime import date
from math import ceil

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.utils.helpers import utc_now

from ._base import SmartFlowBase
from .agreement_service import AgreementService


class LeaseService(SmartFlowBase):
    def __init__(self, db: AsyncIOMotorDatabase, agreement_service: AgreementService | None = None) -> None:
        super().__init__(db)
        self.agreement_service = agreement_service or AgreementService(db)

    def lease_metadata(self) -> dict:
        return {
            "property_types": [
                {"key": "apartment", "label": "Apartment"},
                {"key": "house", "label": "House"},
                {"key": "office_space", "label": "Office Space"},
                {"key": "shop", "label": "Shop"},
                {"key": "warehouse", "label": "Warehouse"},
                {"key": "land", "label": "Land"},
                {"key": "other", "label": "Other"},
            ],
            "statuses": [
                {"key": "draft", "label": "Draft"},
                {"key": "active", "label": "Active"},
                {"key": "pending_signature", "label": "Pending Signature"},
                {"key": "expired", "label": "Expired"},
                {"key": "cancelled", "label": "Cancelled"},
            ],
            "filters": [
                {"key": "all", "label": "All"},
                {"key": "active", "label": "Active"},
                {"key": "pending_signature", "label": "Pending Signature"},
                {"key": "expired", "label": "Expired"},
            ],
            "rent_due_days": [{"key": day, "label": self._ordinal_day(day)} for day in range(1, 32)],
            "signature_fields": [
                {"key": "tenant_signature", "label": "Tenant Signature", "enabled": True},
                {"key": "landlord_signature", "label": "Landlord Signature", "enabled": True},
            ],
            "currency": {"default": "USD", "supported": ["USD", "GBP", "EUR", "BDT"]},
        }

    async def list_leases(
        self,
        user_id: str,
        page: int,
        page_size: int,
        search: str | None,
        status: str | None,
    ) -> dict:
        await self._expire_stale_leases(user_id)
        filters = self._lease_list_filters(user_id, search, status)
        total = await self.db.agreements.count_documents(filters)
        cursor = self.db.agreements.find(filters).sort("updated_at", -1).skip((page - 1) * page_size).limit(page_size)
        items = [self._serialize_lease(item, include_content=False) for item in await cursor.to_list(length=page_size)]
        all_leases = await self.db.agreements.find({"user_id": user_id, "agreement_type": "lease"}).to_list(length=1000)
        return {
            "items": items,
            "summary": self._lease_summary(all_leases),
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": ceil(total / page_size) if page_size else 1,
            },
        }

    async def get_lease(self, user_id: str, lease_id: str) -> dict:
        lease = await self._get_owned_lease(user_id, lease_id)
        lease = await self._refresh_lease_status(lease)
        return self._serialize_lease(lease, include_content=True)

    async def create_lease(self, user_id: str, payload: dict) -> dict:
        details = self._normalize_lease_details(payload)
        content = (payload.get("content") or self._generate_lease_content({**payload, **details})).strip()
        now = utc_now()
        metadata = dict(payload.get("metadata") or {})
        metadata["lease"] = details
        document = {
            "user_id": user_id,
            "agreement_number": await self._next_lease_number(),
            "title": (payload.get("title") or self._infer_lease_title(details)).strip(),
            "client_name": details["tenant_name"],
            "client_email": payload.get("tenant_email"),
            "client_phone": payload.get("tenant_phone"),
            "agreement_type": "lease",
            "priority": "standard",
            "start_date": details.get("start_date"),
            "end_date": details.get("end_date"),
            "content": content,
            "status": self._agreement_status_from_lease_status(payload.get("status", "draft")),
            "smart_fields": self._lease_smart_fields(details),
            "metadata": metadata,
            "ai_review": self._review_lease_content(content, details),
            "sent_at": None,
            "signed_at": None,
            "expired_at": None,
            "signature_request_token": None,
            "signature_request_expires_at": None,
            "signature": None,
            "revision": 1,
            "created_at": now,
            "updated_at": now,
        }
        document["status"] = self._derive_agreement_status(document)
        result = await self.db.agreements.insert_one(document)
        document["_id"] = result.inserted_id
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Create lease {document['agreement_number']} for {document['client_name']}",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            related_resource={"type": "lease", "id": str(document["_id"]), "lease_number": document["agreement_number"]},
            preview_payload={"title": document["title"], "status": self._derive_lease_status(document)},
        )
        return self._serialize_lease(document, include_content=True)

    async def update_lease(self, user_id: str, lease_id: str, updates: dict) -> dict:
        lease = await self._get_owned_lease(user_id, lease_id)
        if not updates:
            return self._serialize_lease(lease, include_content=True)
        regenerate_content = bool(updates.pop("regenerate_content", False))
        current_details = self._lease_details_from_agreement(lease)
        next_details = self._normalize_lease_details(updates, existing=current_details)
        metadata = dict(lease.get("metadata") or {})
        if updates.get("metadata"):
            metadata.update(updates["metadata"])
        metadata["lease"] = next_details
        clean_updates: dict = {
            "metadata": metadata,
            "client_name": next_details["tenant_name"],
            "client_email": updates.get("tenant_email", lease.get("client_email")),
            "client_phone": updates.get("tenant_phone", lease.get("client_phone")),
            "start_date": next_details.get("start_date"),
            "end_date": next_details.get("end_date"),
            "smart_fields": self._lease_smart_fields(next_details),
        }
        if "title" in updates:
            clean_updates["title"] = updates["title"].strip()
        if "status" in updates:
            clean_updates["status"] = self._agreement_status_from_lease_status(updates["status"])
        if "content" in updates:
            clean_updates["content"] = updates["content"].strip()
        elif regenerate_content:
            clean_updates["content"] = self._generate_lease_content({**updates, **next_details})
        if "content" in clean_updates:
            clean_updates["ai_review"] = self._review_lease_content(clean_updates["content"], next_details)
        else:
            clean_updates["ai_review"] = self._review_lease_content(lease.get("content", ""), next_details)
        merged = {**lease, **clean_updates}
        self._validate_agreement_dates(merged)
        clean_updates["status"] = clean_updates.get("status") or self._derive_agreement_status(merged)
        clean_updates["updated_at"] = utc_now()
        updated = await self.db.agreements.find_one_and_update(
            {"_id": lease["_id"]},
            {"$set": clean_updates},
            return_document=ReturnDocument.AFTER,
        )
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Update lease {updated['agreement_number']}",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            related_resource={"type": "lease", "id": str(updated["_id"]), "lease_number": updated["agreement_number"]},
            preview_payload={"title": updated["title"], "status": self._derive_lease_status(updated)},
        )
        return self._serialize_lease(updated, include_content=True)

    async def delete_lease(self, user_id: str, lease_id: str) -> None:
        lease = await self._get_owned_lease(user_id, lease_id)
        await self.agreement_service.delete_agreement(user_id, str(lease["_id"]))

    async def generate_lease_draft(self, user_id: str, payload: dict) -> dict:
        details = self._normalize_lease_details(payload)
        content = self._generate_lease_content({**payload, **details})
        draft = {
            "title": payload.get("title") or self._infer_lease_title(details),
            "lease_number": None,
            "tenant_name": details["tenant_name"],
            "property_address": details["property_address"],
            "property_type": details["property_type"],
            "property_type_label": self._lease_property_type_label(details["property_type"]),
            "monthly_rent_cents": details["monthly_rent_cents"],
            "monthly_rent_label": self._money_label(details["monthly_rent_cents"], details["currency"], suffix="/mo"),
            "security_deposit_cents": details["security_deposit_cents"],
            "currency": details["currency"],
            "rent_due_day": details["rent_due_day"],
            "duration_months": self._lease_duration_months(details.get("start_date"), details.get("end_date")),
            "duration_label": self._lease_duration_label(details.get("start_date"), details.get("end_date")),
            "signature_fields": details["signature_fields"],
            "content": content,
            "ai_review": self._review_lease_content(content, details),
            "lease": details,
        }
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Generate lease draft: {payload.get('prompt', '')[:160]}",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            preview_payload={"title": draft["title"], "tenant_name": draft["tenant_name"]},
        )
        return draft

    async def enhance_lease_terms(self, user_id: str, payload: dict) -> dict:
        content = payload.get("content")
        enhanced_terms = self._enhance_lease_terms_text(payload.get("custom_terms"), payload.get("focus", "balanced"))
        enhanced_content = None
        if content:
            enhanced_content = self._merge_lease_enhanced_terms(content, enhanced_terms)
        review_content = enhanced_content or enhanced_terms
        review = self._review_lease_content(review_content, self._normalize_lease_details({}))
        await self.log_ai_command(
            user_id=user_id,
            command_text="Enhance lease terms with AI",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            preview_payload={"review_items": len(review)},
        )
        return {"custom_terms": enhanced_terms, "content": enhanced_content, "ai_review": review}

    async def enhance_saved_lease_terms(self, user_id: str, lease_id: str, payload: dict) -> dict:
        lease = await self._get_owned_lease(user_id, lease_id)
        details = self._lease_details_from_agreement(lease)
        enhanced_terms = self._enhance_lease_terms_text(payload.get("custom_terms") or details.get("custom_terms"), payload.get("focus", "balanced"))
        updated_details = {**details, "custom_terms": enhanced_terms}
        content = self._merge_lease_enhanced_terms(payload.get("content") or lease.get("content", ""), enhanced_terms)
        metadata = dict(lease.get("metadata") or {})
        metadata["lease"] = updated_details
        review = self._review_lease_content(content, updated_details)
        updated = await self.db.agreements.find_one_and_update(
            {"_id": lease["_id"]},
            {"$set": {"content": content, "metadata": metadata, "ai_review": review, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Enhance lease {lease['agreement_number']} terms",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            related_resource={"type": "lease", "id": str(lease["_id"]), "lease_number": lease["agreement_number"]},
            preview_payload={"title": lease["title"]},
        )
        return self._serialize_lease(updated, include_content=True)

    async def review_lease_draft(self, user_id: str, payload: dict) -> dict:
        details = self._normalize_lease_details(payload)
        findings = self._review_lease_content(payload["content"], details)
        await self.log_ai_command(
            user_id=user_id,
            command_text="Review lease draft",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            preview_payload={"passed": sum(1 for item in findings if item["passed"]), "total": len(findings)},
        )
        return {"ai_review": findings}

    async def review_lease(self, user_id: str, lease_id: str) -> dict:
        lease = await self._get_owned_lease(user_id, lease_id)
        details = self._lease_details_from_agreement(lease)
        findings = self._review_lease_content(lease.get("content", ""), details)
        await self.db.agreements.update_one({"_id": lease["_id"]}, {"$set": {"ai_review": findings, "updated_at": utc_now()}})
        return {"lease_id": str(lease["_id"]), "ai_review": findings}

    async def send_lease_for_signature(self, user_id: str, lease_id: str, payload: dict) -> dict:
        lease = await self._get_owned_lease(user_id, lease_id)
        signature = await self.agreement_service.send_agreement_for_signature(user_id, str(lease["_id"]), payload)
        updated = await self.db.agreements.find_one({"_id": lease["_id"]})
        token = (updated or {}).get("signature_request_token")
        if token:
            signature["signature_request_url"] = self._lease_signature_url(token)
        return {**signature, "lease": self._serialize_lease(updated, include_content=False)}

    async def sign_lease(self, user_id: str, lease_id: str, payload: dict) -> dict:
        lease = await self._get_owned_lease(user_id, lease_id)
        await self._complete_agreement_signature(lease, payload, signed_by_user_id=user_id)
        updated = await self.db.agreements.find_one({"_id": lease["_id"]})
        return self._serialize_lease(updated, include_content=True)

    async def get_public_signing_lease(self, signature_token: str) -> dict:
        signature_request = await self._get_signature_request(signature_token)
        lease = await self.db.agreements.find_one({"_id": ObjectId(signature_request["agreement_id"]), "agreement_type": "lease"})
        if not lease:
            raise AppException(status_code=404, code="LEASE_NOT_FOUND", message="Requested lease was not found.")
        return self._serialize_lease(lease, include_content=True)

    async def sign_public_lease(self, signature_token: str, payload: dict) -> dict:
        signature_request = await self._get_signature_request(signature_token)
        lease = await self.db.agreements.find_one({"_id": ObjectId(signature_request["agreement_id"]), "agreement_type": "lease"})
        if not lease:
            raise AppException(status_code=404, code="LEASE_NOT_FOUND", message="Requested lease was not found.")
        await self._complete_agreement_signature(lease, payload, signed_by_user_id=None)
        updated = await self.db.agreements.find_one({"_id": lease["_id"]})
        return self._serialize_lease(updated, include_content=True)

    async def renew_lease(self, user_id: str, lease_id: str, payload: dict) -> dict:
        lease = await self._get_owned_lease(user_id, lease_id)
        details = self._lease_details_from_agreement(lease)
        if payload.get("monthly_rent_cents") is not None or payload.get("monthly_rent") is not None:
            details["monthly_rent_cents"] = self._amount_to_cents(payload.get("monthly_rent_cents"), payload.get("monthly_rent"))
        details["start_date"] = self._agreement_date_to_iso(payload.get("start_date") or date.today())
        details["end_date"] = self._agreement_date_to_iso(payload.get("end_date") or details.get("end_date"))
        metadata = dict(lease.get("metadata") or {})
        metadata["lease"] = details
        updates = {
            "status": "draft",
            "start_date": details["start_date"],
            "end_date": details["end_date"],
            "metadata": metadata,
            "expired_at": None,
            "revision": int(lease.get("revision", 1)) + 1,
            "updated_at": utc_now(),
        }
        if payload.get("reset_signature", True):
            updates.update(
                {
                    "sent_at": None,
                    "signed_at": None,
                    "signature": None,
                    "signature_request_token": None,
                    "signature_request_expires_at": None,
                }
            )
            await self.db.signature_requests.delete_many({"agreement_id": str(lease["_id"]), "user_id": user_id})
        merged = {**lease, **updates}
        self._validate_agreement_dates(merged)
        updated = await self.db.agreements.find_one_and_update(
            {"_id": lease["_id"]},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Renew lease {lease['agreement_number']}",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            related_resource={"type": "lease", "id": str(lease["_id"]), "lease_number": lease["agreement_number"]},
            preview_payload={"revision": updates["revision"]},
        )
        return self._serialize_lease(updated, include_content=True)

    async def generate_lease_pdf(self, user_id: str, lease_id: str) -> bytes:
        lease = await self._get_owned_lease(user_id, lease_id)
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Download lease {lease['agreement_number']} PDF",
            command_type="agreement",
            status="exported",
            is_replayable=True,
            related_resource={"type": "lease", "id": str(lease["_id"]), "lease_number": lease["agreement_number"]},
            preview_payload={"format": "pdf"},
        )
        return self._generate_agreement_pdf_bytes(lease)

    async def generate_public_lease_pdf(self, signature_token: str) -> bytes:
        signature_request = await self._get_signature_request(signature_token)
        lease = await self.db.agreements.find_one({"_id": ObjectId(signature_request["agreement_id"]), "agreement_type": "lease"})
        if not lease:
            raise AppException(status_code=404, code="LEASE_NOT_FOUND", message="Requested lease was not found.")
        return self._generate_agreement_pdf_bytes(lease)
