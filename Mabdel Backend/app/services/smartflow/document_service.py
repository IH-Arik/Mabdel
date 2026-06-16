from __future__ import annotations

from pymongo import ReturnDocument

from app.utils.helpers import utc_now

from ._base import SmartFlowBase


class DocumentService(SmartFlowBase):
    async def list_documents(self, user_id: str, page: int, page_size: int, search: str | None, doc_type: str | None) -> dict:
        filters = {"user_id": user_id}
        if search:
            filters["name"] = {"$regex": search, "$options": "i"}
        if doc_type:
            filters["type"] = doc_type
        page_result = await self._paginate(self.db.documents, filters, page, page_size, "created_at")
        page_result["items"] = [self._with_preview_url(item) for item in page_result["items"]]
        return page_result

    async def create_document(self, user_id: str, payload: dict) -> dict:
        document = {
            "user_id": user_id,
            **payload,
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }
        result = await self.db.documents.insert_one(document)
        document["_id"] = result.inserted_id
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Create {payload['type']} document {payload['name']}",
            command_type=self._document_command_type(payload["type"]),
            status="completed",
            is_replayable=True,
            related_resource={"type": "document", "id": str(document["_id"]), "document_type": payload["type"]},
            preview_payload={"name": payload["name"], "file_url": payload["file_url"]},
        )
        return self._with_preview_url(self._to_public(document))

    async def update_document(self, user_id: str, document_id: str, updates: dict) -> dict:
        document = await self._get_owned_document(self.db.documents, user_id, document_id, "DOCUMENT_NOT_FOUND")
        clean_updates = {key: value for key, value in updates.items() if value is not None}
        clean_updates["updated_at"] = utc_now()
        updated = await self.db.documents.find_one_and_update(
            {"_id": document["_id"]},
            {"$set": clean_updates},
            return_document=ReturnDocument.AFTER,
        )
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Update {updated['type']} document {updated['name']}",
            command_type=self._document_command_type(updated["type"]),
            status="completed",
            is_replayable=True,
            related_resource={"type": "document", "id": str(updated["_id"]), "document_type": updated["type"]},
            preview_payload={"name": updated["name"], "file_url": updated["file_url"]},
        )
        return self._with_preview_url(self._to_public(updated))

    async def delete_document(self, user_id: str, document_id: str) -> None:
        document = await self._get_owned_document(self.db.documents, user_id, document_id, "DOCUMENT_NOT_FOUND")
        await self.db.documents.delete_one({"_id": document["_id"]})
        await self.log_ai_command(
            user_id=user_id,
            command_text=f"Delete {document['type']} document {document['name']}",
            command_type=self._document_command_type(document["type"]),
            status="archived",
            is_replayable=True,
            related_resource={"type": "document", "id": str(document["_id"]), "document_type": document["type"]},
            preview_payload={"name": document["name"]},
        )
