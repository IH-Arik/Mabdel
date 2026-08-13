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
                    "total_tokens": {
                        "$sum": {
                            "$cond": [
                                {"$gt": ["$tokens_used", 0]},
                                "$tokens_used",
                                185
                            ]
                        }
                    }
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

        # 4. Daily Usage Trend (last 7 days)
        trend_start = utc_now() - timedelta(days=6)
        trend_pipeline = [
            {"$match": {**filters, "timestamp": {"$gte": trend_start}}},
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                    "requests": {"$sum": 1},
                    "tokens": {
                        "$sum": {
                            "$cond": [
                                {"$gt": ["$tokens_used", 0]},
                                "$tokens_used",
                                185
                            ]
                        }
                    },
                }
            },
            {"$sort": {"_id": 1}},
        ]
        trend_rows = await self.db.ai_logs.aggregate(trend_pipeline).to_list(length=31)
        usage_trend = [
            {"date": row["_id"], "requests": row["requests"], "tokens": row.get("tokens", 0)}
            for row in trend_rows
        ]

        if not result:
            return {
                "total": 0, "success_rate": 100.0, "avg_time": 0.0, "total_tokens": 0,
                "task_distribution": [], "error_breakdown": [], "usage_trend": usage_trend
            }

        return {
            "total": result[0]["total"],
            "success_rate": (result[0]["success"] / result[0]["total"]) * 100,
            "avg_time": result[0].get("avg_time", 0.0),
            "total_tokens": result[0].get("total_tokens", 0),
            "task_distribution": task_distribution,
            "error_breakdown": error_breakdown,
            "usage_trend": usage_trend
        }

    async def get_recent_ai_logs(self, limit: int = 50, organization_id: str | None = None) -> list[dict[str, Any]]:
        filters = {"organization_id": organization_id} if organization_id else {}
        return await self.db.ai_logs.find(filters).sort("timestamp", -1).limit(limit).to_list(length=limit)

    async def get_user_reports_paginated(
        self, limit: int = 10, offset: int = 0, organization_id: str | None = None
    ) -> tuple[list[dict[str, Any]], int]:
        filters = {"organization_id": organization_id} if organization_id else {}
        total = await self.db.user_reports.count_documents(filters)
        cursor = self.db.user_reports.find(filters).sort("created_at", -1).skip(offset).limit(limit)
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
        pipeline = [
            {"$match": {"status": {"$ne": "closed"}}},
            {"$addFields": {"user_id_obj": {"$toObjectId": "$user_id"}}},
            {
                "$lookup": {
                    "from": "support_messages",
                    "let": {"sid": {"$toString": "$_id"}},
                    "pipeline": [
                        {"$match": {"$expr": {"$eq": ["$session_id", "$$sid"]}}},
                        {"$sort": {"created_at": -1}},
                        {"$limit": 1}
                    ],
                    "as": "last_msg"
                }
            },
            {"$unwind": {"path": "$last_msg", "preserveNullAndEmptyArrays": True}},
            {"$sort": {"updated_at": -1}},
            {"$limit": 100}
        ]
        
        sessions = await self.db.support_sessions.aggregate(pipeline).to_list(length=100)
        user_ids = list(set([s["user_id"] for s in sessions if s.get("user_id")]))
        users = await self.db.users.find({"_id": {"$in": [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]}}).to_list(length=100)
        user_map = {str(u["_id"]): u for u in users}

        formatted_chats = []
        for s in sessions:
            user_details = user_map.get(s.get("user_id"), {})
            last_msg = s.get("last_msg", {})
            
            chat = {
                "_id": s["_id"],
                "user_name": user_details.get("full_name", "Unknown User"),
                "avatar_url": user_details.get("avatar_url"),
                "last_message": last_msg.get("content", s.get("topic", "")),
                "last_timestamp": last_msg.get("created_at", s.get("updated_at")),
                "unread_count": 0
            }
            formatted_chats.append(chat)
            
        return formatted_chats

    async def get_chat_messages(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        # user_id here is actually the session_id coming from the admin route
        messages = await self.db.support_messages.find(
            {"session_id": user_id}
        ).sort("created_at", 1).to_list(length=limit)
        
        formatted_messages = []
        for m in messages:
            is_support = m.get("sender_type") == "support"
            formatted_messages.append({
                "_id": m["_id"],
                "sender_id": "admin" if is_support else m.get("user_id"),
                "receiver_id": m.get("user_id") if is_support else "admin",
                "message": m.get("content"),
                "image_url": m.get("attachment_url"),
                "timestamp": m.get("created_at"),
            })
        return formatted_messages

    async def save_message(self, message_dict: dict[str, Any]):
        from app.core.exceptions import AppException
        from bson import ObjectId
        
        session_id = message_dict["receiver_id"]
        
        if not ObjectId.is_valid(session_id):
            raise AppException(status_code=400, code="INVALID_ID", message="Invalid session ID.")
            
        session = await self.db.support_sessions.find_one({"_id": ObjectId(session_id)})
        if not session:
            raise AppException(status_code=404, code="NOT_FOUND", message="Session not found.")
            
        msg = {
            "session_id": session_id,
            "user_id": session["user_id"],
            "sender_type": "support",
            "sender_name": "Support Agent",
            "sender_avatar_url": None,
            "content": message_dict.get("message", ""),
            "attachment_url": message_dict.get("image_url"),
            "created_at": message_dict.get("timestamp")
        }
        await self.db.support_messages.insert_one(msg)
        
        await self.db.support_sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"updated_at": message_dict.get("timestamp")}}
        )

