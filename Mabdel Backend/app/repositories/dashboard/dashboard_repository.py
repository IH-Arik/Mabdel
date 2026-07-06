from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.exceptions import AppException
from app.utils.helpers import utc_now


def _object_id(value: str, code: str = "INVALID_ID") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise AppException(status_code=400, code=code, message="Invalid MongoDB object id.")
    return ObjectId(value)


class DashboardRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    async def get_user_counts(self, organization_id: str | None = None) -> dict[str, int]:
        filters = {}
        if organization_id:
            filters["organization_id"] = organization_id
        
        total_users = await self.db.users.count_documents(filters)
        active_24h = await self.db.users.count_documents({
            **filters,
            "updated_at": {"$gte": datetime.utcnow() - timedelta(days=1)}
        })
        return {
            "total": total_users,
            "active_24h": active_24h
        }

    async def get_growth_data(self, collection_name: str, days: int = 30, organization_id: str | None = None) -> list[dict[str, Any]]:
        pipeline = [
            {"$match": {"created_at": {"$gte": datetime.utcnow() - timedelta(days=days)}}},
        ]
        if organization_id:
            pipeline[0]["$match"]["organization_id"] = organization_id
            
        pipeline.extend([
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"_id": 1}}
        ])
        return await self.db[collection_name].aggregate(pipeline).to_list(length=days)

    async def get_ai_usage_stats(self, organization_id: str | None = None) -> dict[str, Any]:
        filters = {}
        if organization_id:
            filters["user_id"] = {"$in": await self._get_org_user_ids(organization_id)}
            
        pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": "$command_type",
                    "count": {"$sum": 1},
                    "success_count": {
                        "$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}
                    }
                }
            }
        ]
        results = await self.db.ai_command_history.aggregate(pipeline).to_list(length=100)
        return {item["_id"]: {"total": item["count"], "success": item["success_count"]} for item in results}

    async def get_revenue_stats(self, organization_id: str | None = None) -> dict[str, Any]:
        # Assuming invoices have 'total_amount' and 'status'
        filters = {"status": "paid"}
        if organization_id:
            filters["organization_id"] = organization_id
            
        pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": None,
                    "total_revenue": {"$sum": "$total_amount"},
                    "count": {"$sum": 1}
                }
            }
        ]
        result = await self.db.invoices.aggregate(pipeline).to_list(length=1)
        return result[0] if result else {"total_revenue": 0, "count": 0}

    async def _get_org_user_ids(self, organization_id: str) -> list[str]:
        cursor = self.db.users.find({"organization_id": organization_id}, {"_id": 1})
        users = await cursor.to_list(length=1000)
        return [str(u["_id"]) for u in users]

    async def get_users_paginated(
        self, organization_id: str | None = None, limit: int = 10, offset: int = 0, search: str | None = None, status: str | None = None
    ) -> tuple[list[dict[str, Any]], int]:
        filters = {}
        if organization_id:
            filters["organization_id"] = organization_id
        
        if status:
            filters["status"] = status
            
        if search:
            filters["$or"] = [
                {"full_name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}}
            ]
            
        total = await self.db.users.count_documents(filters)
        cursor = self.db.users.find(filters).sort("created_at", -1).skip(offset).limit(limit)
        items = await cursor.to_list(length=limit)
        return items, total

    async def update_user_status(self, user_id: str, status: str) -> bool:
        result = await self.db.users.update_one(
            {"_id": _object_id(user_id, "INVALID_USER_ID")},
            {"$set": {"status": status, "updated_at": utc_now()}}
        )
        return result.modified_count > 0

    async def get_earnings_stats(self, organization_id: str | None = None) -> dict[str, float]:
        now = datetime.utcnow()
        start_of_day = datetime(now.year, now.month, now.day)
        start_of_month = datetime(now.year, now.month, 1)

        filters = {"status": "paid"}
        if organization_id:
            filters["organization_id"] = organization_id

        # Aggregation for Today, This Month, Total
        pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": "$total_amount"},
                    "today": {
                        "$sum": {"$cond": [{"$gte": ["$created_at", start_of_day]}, "$total_amount", 0]}
                    },
                    "this_month": {
                        "$sum": {"$cond": [{"$gte": ["$created_at", start_of_month]}, "$total_amount", 0]}
                    }
                }
            }
        ]
        result = await self.db.invoices.aggregate(pipeline).to_list(length=1)
        if not result:
            return {"today": 0.0, "this_month": 0.0, "total": 0.0}
        
        return {
            "today": result[0]["today"] / 100,  # Convert cents to dollars
            "this_month": result[0]["this_month"] / 100,
            "total": result[0]["total"] / 100
        }

    async def get_transactions_paginated(
        self, organization_id: str | None = None, limit: int = 10, offset: int = 0
    ) -> tuple[list[dict[str, Any]], int]:
        filters = {"status": "paid"}
        if organization_id:
            filters["organization_id"] = organization_id

        total = await self.db.invoices.count_documents(filters)
        cursor = self.db.invoices.find(filters).sort("created_at", -1).skip(offset).limit(limit)
        items = await cursor.to_list(length=limit)
        return items, total

    async def get_transaction_by_id(self, trx_id: str) -> dict[str, Any] | None:
        # Check both internal ID and Trx ID (if different)
        return await self.db.invoices.find_one({
            "$or": [
                {"_id": ObjectId(trx_id) if ObjectId.is_valid(trx_id) else None},
                {"transaction_id": trx_id}
            ]
        })

    async def get_plans(self) -> list[dict[str, Any]]:
        return await self.db.plans.find({"is_active": True}).to_list(length=100)

    async def create_plan(self, data: dict[str, Any]) -> str:
        result = await self.db.plans.insert_one(data)
        return str(result.inserted_id)

    async def process_stripe_payment(self, payload: dict[str, Any]):
        """
        Handle Stripe successful payment and update internal records.
        """
        # 1. Create Invoice/Transaction record
        invoice_data = {
            "transaction_id": payload["id"],
            "user_id": payload["metadata"].get("user_id"),
            "user_name": payload["customer_details"].get("name"),
            "user_email": payload["customer_details"].get("email"),
            "total_amount": payload["amount_total"],
            "plan_name": payload["metadata"].get("plan_name", "Subscription"),
            "status": "paid",
            "created_at": datetime.utcnow()
        }
        await self.db.invoices.insert_one(invoice_data)

        # 2. Update User subscription status
        if invoice_data["user_id"]:
            await self.db.users.update_one(
                {"_id": ObjectId(invoice_data["user_id"])},
                {"$set": {
                    "is_subscribed": True,
                    "plan_name": invoice_data["plan_name"],
                    "subscription_expiry": datetime.utcnow() + timedelta(days=30) # Example
                }}
            )

            # 3. Sync with client app's subscriptions collection
            plan_code = invoice_data["plan_name"].lower()
            if plan_code not in ["free", "pro", "business"]:
                plan_code = "pro"
            await self.db.subscriptions.update_one(
                {"user_id": invoice_data["user_id"]},
                {"$set": {
                    "user_id": invoice_data["user_id"],
                    "plan_code": plan_code,
                    "status": "active",
                    "started_at": datetime.utcnow(),
                    "renews_at": datetime.utcnow() + timedelta(days=30),
                    "updated_at": datetime.utcnow()
                }},
                upsert=True
            )

    async def get_ai_performance_stats(self, organization_id: str | None = None) -> dict[str, Any]:
        filters = {}
        if organization_id:
            filters["organization_id"] = organization_id
            
        # 1. Main Stats
        pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "success": {"$sum": {"$cond": [{"$eq": ["$status", "success"]}, 1, 0]}},
                    "avg_time": {"$avg": "$response_time"},
                    "total_tokens": {"$sum": "$tokens_used"}
                }
            }
        ]
        result = await self.db.ai_logs.aggregate(pipeline).to_list(length=1)
        
        # 2. Task Distribution (Pie Chart)
        task_pipeline = [
            {"$match": filters},
            {"$group": {"_id": "$action", "count": {"$sum": 1}}},
            {"$project": {"task": "$_id", "count": 1, "_id": 0}}
        ]
        task_distribution = await self.db.ai_logs.aggregate(task_pipeline).to_list(length=100)

        # 3. Error Breakdown
        error_pipeline = [
            {"$match": {**filters, "status": "failed"}},
            {"$group": {"_id": "$error_type", "count": {"$sum": 1}}},
            {"$project": {"error": "$_id", "count": 1, "_id": 0}}
        ]
        error_breakdown = await self.db.ai_logs.aggregate(error_pipeline).to_list(length=100)

        if not result:
            return {
                "total": 0, "success_rate": 100.0, "avg_time": 0.0, "total_tokens": 0,
                "task_distribution": [], "error_breakdown": []
            }
        
        return {
            "total": result[0]["total"],
            "success_rate": (result[0]["success"] / result[0]["total"]) * 100,
            "avg_time": result[0].get("avg_time", 0.0),
            "total_tokens": result[0].get("total_tokens", 0),
            "task_distribution": task_distribution,
            "error_breakdown": error_breakdown
        }

    async def get_recent_ai_logs(self, limit: int = 50) -> list[dict[str, Any]]:
        return await self.db.ai_logs.find().sort("timestamp", -1).limit(limit).to_list(length=limit)

    async def get_user_reports_paginated(
        self, limit: int = 10, offset: int = 0
    ) -> tuple[list[dict[str, Any]], int]:
        total = await self.db.user_reports.count_documents({})
        cursor = self.db.user_reports.find().sort("created_at", -1).skip(offset).limit(limit)
        items = await cursor.to_list(length=limit)
        return items, total

    async def update_user_profile(self, user_id: str, data: dict[str, Any]) -> bool:
        result = await self.db.users.update_one(
            {"_id": _object_id(user_id, "INVALID_USER_ID")},
            {"$set": {**data, "updated_at": utc_now()}}
        )
        return result.modified_count > 0

    async def update_user_password(self, user_id: str, hashed_password: str) -> bool:
        result = await self.db.users.update_one(
            {"_id": _object_id(user_id, "INVALID_USER_ID")},
            {"$set": {"hashed_password": hashed_password, "password_hash": hashed_password, "updated_at": utc_now()}}
        )
        return result.modified_count > 0

    async def save_otp(self, email: str, otp: str):
        from datetime import timedelta
        expire_at = utc_now() + timedelta(minutes=10)
        await self.db.otps.update_one(
            {"email": email},
            {"$set": {"otp": otp, "expire_at": expire_at}},
            upsert=True
        )

    async def verify_otp(self, email: str, otp: str) -> bool:
        record = await self.db.otps.find_one({"email": email, "otp": otp})
        if not record:
            return False
        if record["expire_at"] < utc_now():
            return False
        return True

    async def get_settings_content(self, content_type: str) -> str:
        doc = await self.db.settings.find_one({"type": content_type})
        return doc.get("content", f"Please add content for {content_type} in the database.") if doc else ""

    async def update_settings_content(self, content_type: str, content: str) -> bool:
        result = await self.db.settings.update_one(
            {"type": content_type},
            {"$set": {"content": content, "updated_at": utc_now()}},
            upsert=True
        )
        return result.modified_count > 0 or result.upserted_id is not None

    async def get_all_chats(self) -> list[dict[str, Any]]:
        # This can be improved with $lookup and $group in a real production environment
        return await self.db.conversations.find().sort("last_timestamp", -1).to_list(length=100)

    async def get_chat_messages(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        return await self.db.messages.find(
            {"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]}
        ).sort("timestamp", 1).to_list(length=limit)

    async def save_message(self, message_dict: dict[str, Any]):
        await self.db.messages.insert_one(message_dict)
        # Also update last message in conversation
        await self.db.conversations.update_one(
            {"user_id": message_dict["receiver_id"]},
            {"$set": {
                "last_message": message_dict.get("message", "[Image]"),
                "last_timestamp": message_dict["timestamp"]
            }},
            upsert=True
        )

