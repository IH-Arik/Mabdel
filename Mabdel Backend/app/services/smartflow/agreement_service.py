from __future__ import annotations

import secrets
from datetime import date, timedelta
from math import ceil

from bson import ObjectId
from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.services.email_service import EmailService
from app.services.smartflow.docusign_agreement_service import DocuSignAgreementService
from app.utils.helpers import utc_now

from ._base import SmartFlowBase


class AgreementService(SmartFlowBase):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.docusign_service = DocuSignAgreementService(db)

    async def list_agreements(
        self,
        user_id: str,
        page: int,
        page_size: int,
        search: str | None,
        status: str | None,
        agreement_type: str | None,
    ) -> dict:
        await self._expire_stale_agreements(user_id)
        team_ids = await self._resolve_team_user_ids(user_id)
        filters: dict = {"user_id": {"$in": team_ids}}
        if status and status != "all":
            filters["status"] = status
        if agreement_type:
            filters["agreement_type"] = agreement_type
        if search:
            filters["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"client_name": {"$regex": search, "$options": "i"}},
                {"client_email": {"$regex": search, "$options": "i"}},
                {"agreement_number": {"$regex": search, "$options": "i"}},
            ]

        total = await self.db.agreements.count_documents(filters)
        cursor = self.db.agreements.find(filters).sort("updated_at", -1).skip((page - 1) * page_size).limit(page_size)
        items = [self._serialize_agreement(item, include_content=False) for item in await cursor.to_list(length=page_size)]
        all_agreements = await self.db.agreements.find({"user_id": {"$in": team_ids}}).to_list(length=1000)
        return {
            "items": items,
            "summary": self._agreement_summary(all_agreements),
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": ceil(total / page_size) if page_size else 1,
            },
        }

    async def get_agreement(self, user_id: str, agreement_id: str) -> dict:
        agreement = await self._get_team_document(self.db.agreements, user_id, agreement_id, "AGREEMENT_NOT_FOUND")
        if agreement.get("signature_provider") == "docusign" and (agreement.get("docusign") or {}).get("envelope_id"):
            agreement = await self.docusign_service.refresh_agreement(user_id, agreement)
        agreement = await self._refresh_agreement_status(agreement)
        return self._serialize_agreement(agreement, include_content=True)

    async def create_agreement(self, user_id: str, payload: dict) -> dict:
        self._validate_agreement_dates(payload)
        now = utc_now()
        document = {
            "user_id": user_id,
            "agreement_number": await self._next_agreement_number(),
            "title": payload["title"].strip(),
            "client_name": payload["client_name"].strip(),
            "client_email": payload.get("client_email"),
            "client_phone": payload.get("client_phone"),
            "agreement_type": payload.get("agreement_type", "contract"),
            "priority": payload.get("priority", "standard"),
            "start_date": self._agreement_date_to_iso(payload.get("start_date")),
            "end_date": self._agreement_date_to_iso(payload.get("end_date")),
            "content": payload["content"].strip(),
            "status": payload.get("status", "draft"),
            "smart_fields": self._normalize_agreement_smart_fields(payload.get("smart_fields")),
            "metadata": payload.get("metadata") or {},
            "ai_review": self._review_agreement_content(payload["content"], payload.get("agreement_type", "contract")),
            "sent_at": None,
            "signed_at": None,
            "expired_at": None,
            "signature_request_token": None,
            "signature_request_expires_at": None,
            "signature": None,
            "signature_provider": "native",
            "docusign": {},
            "revision": 1,
            "created_at": now,
            "updated_at": now,
        }
        document["status"] = self._derive_agreement_status(document)
        result = await self.db.agreements.insert_one(document)
        document["_id"] = result.inserted_id
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Create agreement {document['agreement_number']} for {document['client_name']}",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            related_resource={"type": "agreement", "id": str(document["_id"]), "agreement_number": document["agreement_number"]},
            preview_payload={"title": document["title"], "status": document["status"]},
        )
        return self._serialize_agreement(document, include_content=True)

    async def update_agreement(self, user_id: str, agreement_id: str, updates: dict) -> dict:
        agreement = await self._get_team_document(self.db.agreements, user_id, agreement_id, "AGREEMENT_NOT_FOUND")
        clean_updates = {key: value for key, value in updates.items() if value is not None}
        if not clean_updates:
            return self._serialize_agreement(agreement, include_content=True)
        merged = {**agreement, **clean_updates}
        self._validate_agreement_dates(merged)
        if "title" in clean_updates:
            clean_updates["title"] = clean_updates["title"].strip()
        if "client_name" in clean_updates:
            clean_updates["client_name"] = clean_updates["client_name"].strip()
        if "content" in clean_updates:
            clean_updates["content"] = clean_updates["content"].strip()
            clean_updates["ai_review"] = self._review_agreement_content(clean_updates["content"], merged.get("agreement_type", "contract"))
        if "smart_fields" in clean_updates:
            clean_updates["smart_fields"] = self._normalize_agreement_smart_fields(clean_updates["smart_fields"])
        if "start_date" in clean_updates:
            clean_updates["start_date"] = self._agreement_date_to_iso(clean_updates["start_date"])
        if "end_date" in clean_updates:
            clean_updates["end_date"] = self._agreement_date_to_iso(clean_updates["end_date"])
        merged = {**agreement, **clean_updates}
        clean_updates["status"] = clean_updates.get("status") or self._derive_agreement_status(merged)
        clean_updates["updated_at"] = utc_now()
        updated = await self.db.agreements.find_one_and_update(
            {"_id": agreement["_id"]},
            {"$set": clean_updates},
            return_document=ReturnDocument.AFTER,
        )
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Update agreement {updated['agreement_number']}",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            related_resource={"type": "agreement", "id": str(updated["_id"]), "agreement_number": updated["agreement_number"]},
            preview_payload={"title": updated["title"], "status": updated["status"]},
        )
        return self._serialize_agreement(updated, include_content=True)

    async def delete_agreement(self, user_id: str, agreement_id: str) -> None:
        agreement = await self._get_team_document(self.db.agreements, user_id, agreement_id, "AGREEMENT_NOT_FOUND")
        await self.db.agreements.delete_one({"_id": agreement["_id"]})
        await self.db.signature_requests.delete_many({"agreement_id": str(agreement["_id"]), "user_id": user_id})
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Delete agreement {agreement['agreement_number']}",
            command_type="agreement",
            status="archived",
            is_replayable=True,
            related_resource={"type": "agreement", "id": str(agreement["_id"]), "agreement_number": agreement["agreement_number"]},
            preview_payload={"title": agreement["title"]},
        )

    async def generate_agreement_draft(self, user_id: str, payload: dict) -> dict:
        content = self._generate_agreement_content(payload)
        draft = {
            "title": payload.get("title") or self._infer_agreement_title(payload.get("prompt", ""), payload.get("agreement_type", "contract")),
            "client_name": payload.get("client_name") or "Client",
            "agreement_type": payload.get("agreement_type", "contract"),
            "priority": payload.get("priority", "standard"),
            "content": content,
            "smart_fields": self._normalize_agreement_smart_fields(payload.get("smart_fields")),
            "ai_review": self._review_agreement_content(content, payload.get("agreement_type", "contract")),
        }
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Generate agreement draft: {payload.get('prompt', '')[:160]}",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            preview_payload={"title": draft["title"], "client_name": draft["client_name"]},
        )
        return draft

    async def improve_agreement_draft(self, user_id: str, payload: dict) -> dict:
        improved_content = self._improve_agreement_content(payload["content"], payload.get("instruction"))
        review = self._review_agreement_content(improved_content, "contract")
        await self.log_ai_command(
            user_id=user_id,
            command_text="Improve agreement draft",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            preview_payload={"review_items": len(review)},
        )
        return {"content": improved_content, "ai_review": review}

    async def improve_agreement(self, user_id: str, agreement_id: str, payload: dict) -> dict:
        agreement = await self._get_team_document(self.db.agreements, user_id, agreement_id, "AGREEMENT_NOT_FOUND")
        base_content = payload.get("content") or agreement.get("content", "")
        improved_content = self._improve_agreement_content(base_content, payload.get("instruction"))
        updated = await self.db.agreements.find_one_and_update(
            {"_id": agreement["_id"]},
            {
                "$set": {
                    "content": improved_content,
                    "ai_review": self._review_agreement_content(improved_content, agreement.get("agreement_type", "contract")),
                    "updated_at": utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Improve agreement {agreement['agreement_number']} with AI",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            related_resource={"type": "agreement", "id": str(agreement["_id"]), "agreement_number": agreement["agreement_number"]},
            preview_payload={"title": agreement["title"]},
        )
        return self._serialize_agreement(updated, include_content=True)

    async def review_agreement_draft(self, user_id: str, payload: dict) -> dict:
        findings = self._review_agreement_content(payload["content"], payload.get("agreement_type", "contract"))
        await self.log_ai_command(
            user_id=user_id,
            command_text="Review agreement draft",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            preview_payload={"passed": sum(1 for item in findings if item["passed"]), "total": len(findings)},
        )
        return {"ai_review": findings}

    async def review_agreement(self, user_id: str, agreement_id: str) -> dict:
        agreement = await self._get_team_document(self.db.agreements, user_id, agreement_id, "AGREEMENT_NOT_FOUND")
        findings = self._review_agreement_content(agreement.get("content", ""), agreement.get("agreement_type", "contract"))
        await self.db.agreements.update_one({"_id": agreement["_id"]}, {"$set": {"ai_review": findings, "updated_at": utc_now()}})
        return {"agreement_id": str(agreement["_id"]), "ai_review": findings}

    async def send_agreement_for_signature(self, user_id: str, agreement_id: str, payload: dict) -> dict:
        agreement = await self._get_team_document(self.db.agreements, user_id, agreement_id, "AGREEMENT_NOT_FOUND")
        if agreement.get("status") == "signed":
            raise AppException(status_code=409, code="AGREEMENT_ALREADY_SIGNED", message="Signed agreements cannot be sent for signature again.")
        provider = payload.get("provider") or "native"
        if provider == "docusign":
            pdf_bytes = self._generate_agreement_pdf_bytes(agreement)
            envelope = await self.docusign_service.create_envelope(
                user_id=user_id,
                agreement=agreement,
                pdf_bytes=pdf_bytes,
                payload=payload,
            )
            updated = await self.db.agreements.find_one_and_update(
                {"_id": agreement["_id"]},
                {
                    "$set": {
                        "status": "pending_signature",
                        "signature_provider": "docusign",
                        "signature_request_token": None,
                        "signature_request_expires_at": None,
                        "signature": None,
                        "sent_at": envelope["sent_at"],
                        "updated_at": utc_now(),
                        "docusign": envelope,
                    }
                },
                return_document=ReturnDocument.AFTER,
            )
            await self.log_ai_command(
                user_id=user_id,
                command_text=f"Send agreement {agreement['agreement_number']} with DocuSign",
                command_type="agreement",
                status="delivered",
                is_replayable=True,
                related_resource={"type": "agreement", "id": str(agreement["_id"]), "agreement_number": agreement["agreement_number"]},
                preview_payload={"provider": "docusign", "envelope_id": envelope["envelope_id"]},
            )
            return {
                "agreement_id": str(agreement["_id"]),
                "status": updated["status"],
                "channel": payload.get("channel", "email"),
                "provider": "docusign",
                "recipient_name": (envelope.get("recipients") or [{}])[0].get("name") if envelope.get("recipients") else None,
                "recipient_email": (envelope.get("recipients") or [{}])[0].get("email") if envelope.get("recipients") else None,
                "signature_request_url": envelope.get("recipient_view_url"),
                "provider_status": envelope.get("provider_status"),
                "provider_envelope_id": envelope.get("envelope_id"),
                "expires_at": None,
            }
        recipient_email = payload.get("recipient_email") or agreement.get("client_email")
        if payload.get("channel") == "email" and not recipient_email:
            raise AppException(status_code=400, code="RECIPIENT_EMAIL_REQUIRED", message="Recipient email is required to send an agreement by email.")
        token = agreement.get("signature_request_token") or secrets.token_urlsafe(24)
        expires_at = utc_now() + timedelta(days=30)
        signature_request = {
            "user_id": user_id,
            "agreement_id": str(agreement["_id"]),
            "token": token,
            "status": "pending",
            "channel": payload.get("channel", "link"),
            "recipient_name": payload.get("recipient_name") or agreement.get("client_name"),
            "recipient_email": recipient_email,
            "message": payload.get("message"),
            "expires_at": expires_at,
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }
        await self.db.signature_requests.update_one(
            {"agreement_id": str(agreement["_id"]), "user_id": user_id},
            {"$set": signature_request},
            upsert=True,
        )
        updated = await self.db.agreements.find_one_and_update(
            {"_id": agreement["_id"]},
            {
                "$set": {
                    "status": "pending_signature",
                    "signature_provider": "native",
                    "sent_at": utc_now(),
                    "signature_request_token": token,
                    "signature_request_expires_at": expires_at,
                    "docusign": {},
                    "updated_at": utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        signature_url = self._agreement_signature_url(token)
        if payload.get("channel") == "email":
            await EmailService().send_invoice_email(
                email=recipient_email,
                subject=f"Signature requested: {agreement['title']}",
                text=self._agreement_signature_email_text(updated, payload.get("message"), signature_url),
                html=self._agreement_signature_email_html(updated, payload.get("message"), signature_url),
            )
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Send agreement {agreement['agreement_number']} for signature",
            command_type="agreement",
            status="delivered",
            is_replayable=True,
            related_resource={"type": "agreement", "id": str(agreement["_id"]), "agreement_number": agreement["agreement_number"]},
            preview_payload={"signature_request_url": signature_url},
        )
        return {
            "agreement_id": str(agreement["_id"]),
            "status": updated["status"],
            "channel": payload.get("channel", "link"),
            "recipient_name": signature_request["recipient_name"],
            "recipient_email": recipient_email,
            "signature_request_url": signature_url,
            "expires_at": expires_at,
        }

    async def sign_agreement(self, user_id: str, agreement_id: str, payload: dict) -> dict:
        agreement = await self._get_team_document(self.db.agreements, user_id, agreement_id, "AGREEMENT_NOT_FOUND")
        return await self._complete_agreement_signature(agreement, payload, signed_by_user_id=user_id)

    async def get_public_signing_agreement(self, signature_token: str) -> dict:
        signature_request = await self._get_signature_request(signature_token)
        agreement = await self.db.agreements.find_one({"_id": ObjectId(signature_request["agreement_id"])})
        if not agreement:
            raise AppException(status_code=404, code="AGREEMENT_NOT_FOUND", message="Requested agreement was not found.")
        return self._serialize_agreement(agreement, include_content=True)

    async def sign_public_agreement(self, signature_token: str, payload: dict) -> dict:
        signature_request = await self._get_signature_request(signature_token)
        agreement = await self.db.agreements.find_one({"_id": ObjectId(signature_request["agreement_id"])})
        if not agreement:
            raise AppException(status_code=404, code="AGREEMENT_NOT_FOUND", message="Requested agreement was not found.")
        return await self._complete_agreement_signature(agreement, payload, signed_by_user_id=None)

    async def renew_agreement(self, user_id: str, agreement_id: str, payload: dict) -> dict:
        agreement = await self._get_team_document(self.db.agreements, user_id, agreement_id, "AGREEMENT_NOT_FOUND")
        updates = {
            "status": "draft",
            "start_date": self._agreement_date_to_iso(payload.get("start_date") or date.today()),
            "end_date": self._agreement_date_to_iso(payload.get("end_date")),
            "expired_at": None,
            "signature_provider": "native",
            "docusign": {},
            "revision": int(agreement.get("revision", 1)) + 1,
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
            await self.db.signature_requests.delete_many({"agreement_id": str(agreement["_id"]), "user_id": user_id})
        merged = {**agreement, **updates}
        self._validate_agreement_dates(merged)
        updated = await self.db.agreements.find_one_and_update(
            {"_id": agreement["_id"]},
            {"$set": updates},
            return_document=ReturnDocument.AFTER,
        )
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Renew agreement {agreement['agreement_number']}",
            command_type="agreement",
            status="completed",
            is_replayable=True,
            related_resource={"type": "agreement", "id": str(agreement["_id"]), "agreement_number": agreement["agreement_number"]},
            preview_payload={"revision": updates["revision"]},
        )
        return self._serialize_agreement(updated, include_content=True)

    async def generate_agreement_pdf(self, user_id: str, agreement_id: str) -> bytes:
        agreement = await self._get_team_document(self.db.agreements, user_id, agreement_id, "AGREEMENT_NOT_FOUND")
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Download agreement {agreement['agreement_number']} PDF",
            command_type="agreement",
            status="exported",
            is_replayable=True,
            related_resource={"type": "agreement", "id": str(agreement["_id"]), "agreement_number": agreement["agreement_number"]},
            preview_payload={"format": "pdf"},
        )
        return self._generate_agreement_pdf_bytes(agreement)

    async def generate_public_agreement_pdf(self, signature_token: str) -> bytes:
        signature_request = await self._get_signature_request(signature_token)
        agreement = await self.db.agreements.find_one({"_id": ObjectId(signature_request["agreement_id"])})
        if not agreement:
            raise AppException(status_code=404, code="AGREEMENT_NOT_FOUND", message="Requested agreement was not found.")
        return self._generate_agreement_pdf_bytes(agreement)

    async def get_docusign_status(self, user_id: str) -> dict:
        return await self.docusign_service.get_status(user_id)

    async def start_docusign_oauth(self, user_id: str) -> dict:
        return await self.docusign_service.start_oauth(user_id)

    async def complete_docusign_oauth(self, code: str, state: str) -> dict:
        return await self.docusign_service.complete_oauth(code, state)

    async def handle_docusign_webhook(self, raw_body: bytes, payload: dict) -> dict:
        return await self.docusign_service.handle_webhook(raw_body, payload)

    async def download_signed_agreement_pdf(self, user_id: str, agreement_id: str) -> tuple[bytes, str]:
        agreement = await self._get_team_document(self.db.agreements, user_id, agreement_id, "AGREEMENT_NOT_FOUND")
        return await self.docusign_service.download_signed_pdf(user_id, agreement)

    async def download_agreement_completion_certificate(self, user_id: str, agreement_id: str) -> tuple[bytes, str]:
        agreement = await self._get_team_document(self.db.agreements, user_id, agreement_id, "AGREEMENT_NOT_FOUND")
        return await self.docusign_service.download_certificate(user_id, agreement)

    def agreement_metadata(self) -> dict:
        return {
            "types": [
                {"key": "contract", "label": "Contract"},
                {"key": "lease", "label": "Lease"},
                {"key": "legal", "label": "Legal"},
                {"key": "vendor", "label": "Vendor"},
                {"key": "service", "label": "Service Agreement"},
                {"key": "nda", "label": "NDA"},
                {"key": "other", "label": "Other"},
            ],
            "priorities": [
                {"key": "standard", "label": "Standard"},
                {"key": "high", "label": "High"},
                {"key": "urgent", "label": "Urgent"},
            ],
            "statuses": [
                {"key": "draft", "label": "Draft"},
                {"key": "pending_signature", "label": "Pending Signature"},
                {"key": "signed", "label": "Signed"},
                {"key": "expired", "label": "Expired"},
                {"key": "cancelled", "label": "Cancelled"},
            ],
        }
