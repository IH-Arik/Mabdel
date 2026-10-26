"""Review receptionist requests into business records without external side effects."""

from __future__ import annotations

import json
from datetime import timedelta
from decimal import Decimal

from bson import ObjectId
from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.services.smartflow._base import SmartFlowBase
from app.utils.helpers import utc_now

COLLECTIONS = {
    "task": "business_tasks",
    "callback": "business_tasks",
    "service_ticket": "business_service_tickets",
    "quote": "business_quotes",
}
CAPABILITIES = {
    "task": "create_task",
    "callback": "create_callback",
    "service_ticket": "create_service_ticket",
    "quote": "provide_quote",
    "workflow": "trigger_workflow",
}


class ReceptionistExecutionService(SmartFlowBase):
    @staticmethod
    def serialize(row):
        return {**{k: v for k, v in row.items() if k != "_id"}, "id": str(row["_id"])}

    async def _capabilities_enabled(self, organization_id, names):
        for name in names:
            if await self.resolve_capability(organization_id, name) == "disabled":
                raise AppException(
                    403,
                    "PERMISSION_DENIED",
                    f"The owner has disabled {name.replace('_', ' ')}.",
                )

    async def execute(self, user_id, item_id, payload):
        """Only called after authenticated calls:manage and explicit human review.

        The work-item ID is also the artifact ID, so retrying after a partial write
        recovers the same record. No provider request or AI-generated pricing runs.
        """
        org = await self._resolve_organization_id(user_id)
        query = (
            {"_id": ObjectId(item_id), "organization_id": org}
            if org and ObjectId.is_valid(item_id)
            else None
        )
        item = await self.db.receptionist_work_items.find_one(query) if query else None
        if not item:
            raise AppException(404, "REQUEST_NOT_FOUND", "Request not found.")
        if item.get("execution_status") == "completed":
            return item["execution_result"]
        if item["status"] in {"cancelled", "completed"}:
            raise AppException(
                409,
                "REQUEST_CLOSED",
                "Reopen the request before creating a business record.",
            )
        if payload.get("approved") is not True:
            raise AppException(
                422, "REVIEW_REQUIRED", "Review and approve the request details first."
            )
        kind = item["kind"]
        capabilities = [CAPABILITIES[kind]]
        artifact_kind = kind
        if kind == "workflow":
            action = payload.get("workflow_action")
            artifact_kind = {
                "create_task": "task",
                "create_service_ticket": "service_ticket",
                "create_crm_contact": "contact",
            }.get(action)
            if not artifact_kind:
                raise AppException(
                    422, "UNSUPPORTED_WORKFLOW", "Choose a supported business workflow."
                )
            capabilities.append(action)
        await self._capabilities_enabled(org, capabilities)
        if artifact_kind == "quote":
            amount = Decimal(str(payload.get("quote_amount", "NaN")))
            if (
                not amount.is_finite()
                or amount < 0
                or amount > Decimal("999999999.99")
                or amount.as_tuple().exponent < -2
            ):
                raise AppException(
                    422,
                    "QUOTE_AMOUNT_REQUIRED",
                    "Enter an approved quote amount with at most two decimal places.",
                )
            currency = payload.get("currency") or ""
            if currency not in {"USD", "CAD", "GBP", "EUR", "AUD", "BDT", "INR", "AED"}:
                raise AppException(
                    422, "INVALID_CURRENCY", "Select a supported quote currency."
                )
        if artifact_kind == "contact" and not (
            item.get("caller_phone") or payload.get("contact_email")
        ):
            raise AppException(
                422,
                "CONTACT_DETAILS_REQUIRED",
                "A caller phone number or email is required.",
            )
        plan = json.loads(json.dumps(payload, default=str, sort_keys=True))
        if artifact_kind == "quote":
            plan["quote_amount"] = format(amount.quantize(Decimal("0.01")), "f")
        if item.get("execution_plan") and item["execution_plan"] != plan:
            raise AppException(
                409,
                "EXECUTION_DETAILS_CHANGED",
                "Retry with the originally reviewed details to avoid duplicate work.",
            )
        now = utc_now()
        item = await self.db.receptionist_work_items.find_one_and_update(
            {
                **query,
                "status": {"$in": ["open", "in_progress"]},
                "$and": [
                    {
                        "$or": [
                            {"execution_plan": {"$exists": False}},
                            {"execution_plan": plan},
                        ]
                    }
                ],
                "$or": [
                    {"execution_status": {"$exists": False}},
                    {"execution_status": "failed"},
                    {
                        "execution_status": "running",
                        "execution_started_at": {"$lt": now - timedelta(minutes=5)},
                    },
                ],
            },
            {
                "$set": {
                    "execution_status": "running",
                    "execution_plan": plan,
                    "execution_started_at": now,
                    "execution_reviewed_by": user_id,
                    "execution_reviewed_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        if not item:
            current = await self.db.receptionist_work_items.find_one(query)
            if current.get("execution_status") == "completed":
                return current["execution_result"]
            raise AppException(
                409, "EXECUTION_IN_PROGRESS", "This request is already being processed."
            )
        try:
            if artifact_kind == "contact":
                from app.services.smartflow.contact_service import ContactService

                contact = await ContactService(
                    self.db
                ).find_or_create_by_phone_or_email(
                    user_id,
                    phone=item.get("caller_phone"),
                    email=payload.get("contact_email"),
                    name=item.get("caller_name"),
                    source="receptionist_workflow",
                )
                result = {
                    "saved": True,
                    "artifact_kind": "contact",
                    "artifact_id": str(contact["_id"]),
                    "note": "CRM contact saved. No message was sent.",
                }
            else:
                collection = COLLECTIONS[artifact_kind]
                artifact = {
                    "organization_id": org,
                    "user_id": user_id,
                    "source_work_item_id": item_id,
                    "kind": artifact_kind,
                    "title": (payload.get("title") or item["summary"])[:160],
                    "description": item["summary"],
                    "caller_name": item.get("caller_name"),
                    "caller_phone": item.get("caller_phone"),
                    "assignee_ids": item.get("assignee_ids", []),
                    "priority": payload.get("priority", "normal"),
                    "due_at": payload.get("due_at"),
                    "status": "draft" if artifact_kind == "quote" else "open",
                    "created_at": now,
                    "updated_at": now,
                    "reviewed_by": user_id,
                    "reviewed_at": now,
                }
                if artifact_kind == "quote":
                    artifact.update({"amount": str(amount), "currency": currency})
                record = await self.db[collection].find_one_and_update(
                    {"_id": item["_id"], "organization_id": org},
                    {"$setOnInsert": artifact},
                    upsert=True,
                    return_document=ReturnDocument.AFTER,
                )
                result = {
                    "saved": True,
                    "artifact_kind": artifact_kind,
                    "artifact_id": str(record["_id"]),
                    "note": "Draft quote saved; it has not been sent."
                    if artifact_kind == "quote"
                    else "Business record created. No phone call, message, or external action was performed.",
                }
            await self.db.receptionist_work_items.update_one(
                query,
                {
                    "$set": {
                        "execution_status": "completed",
                        "execution_result": result,
                        "status": "completed",
                        "updated_at": utc_now(),
                    },
                    "$unset": {"execution_error": ""},
                },
            )
            return result
        except Exception:
            await self.db.receptionist_work_items.update_one(
                query,
                {
                    "$set": {
                        "execution_status": "failed",
                        "execution_error": "Could not create the business record. Retry after reviewing the request.",
                        "updated_at": utc_now(),
                    }
                },
            )
            raise

    async def list_artifacts(self, user_id):
        org = await self._resolve_organization_id(user_id)
        if not org:
            raise AppException(
                403, "ORGANIZATION_REQUIRED", "A business account is required."
            )
        results = []
        for collection in set(COLLECTIONS.values()):
            rows = (
                await self.db[collection]
                .find({"organization_id": org})
                .sort("created_at", -1)
                .limit(100)
                .to_list(100)
            )
            results.extend(self.serialize(row) for row in rows)
        return sorted(results, key=lambda row: row["created_at"], reverse=True)[:100]

    async def update_artifact(self, user_id, kind, artifact_id, payload):
        org = await self._resolve_organization_id(user_id)
        if not org or kind not in COLLECTIONS or not ObjectId.is_valid(artifact_id):
            raise AppException(404, "RECORD_NOT_FOUND", "Business record not found.")
        await self._capabilities_enabled(org, [CAPABILITIES[kind]])
        query = {"_id": ObjectId(artifact_id), "organization_id": org, "kind": kind}
        changes = {
            "status": payload["status"],
            "updated_at": utc_now(),
            "updated_by": user_id,
        }
        valid = (
            {"draft", "accepted", "declined", "cancelled"}
            if kind == "quote"
            else {"open", "in_progress", "completed", "cancelled"}
        )
        if changes["status"] not in valid:
            raise AppException(
                422, "INVALID_STATUS", "Select a valid status for this business record."
            )
        row = await self.db[COLLECTIONS[kind]].find_one_and_update(
            query, {"$set": changes}, return_document=ReturnDocument.AFTER
        )
        if not row:
            raise AppException(404, "RECORD_NOT_FOUND", "Business record not found.")
        return self.serialize(row)
