"""
Subscription & Trial management endpoints.
"""
from __future__ import annotations

import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import AppException
from app.dependencies import get_current_user, get_mongo_database

router = APIRouter(prefix="/subscription", tags=["subscription"])


def _uid(user: dict) -> str:
    return str(user.get("_id") or user.get("id") or "")


def _oid(uid: str):
    return ObjectId(uid) if ObjectId.is_valid(uid) else uid


async def _get_subscription_status(user_doc: dict, db: AsyncIOMotorDatabase) -> dict:
    """
    Returns subscription status for a user.
    For assigned team members (manager/staff/assistant), checks their owner's status.
    """
    role = user_doc.get("role", "user")
    uid = str(user_doc.get("_id") or user_doc.get("id") or "")

    # Assigned members inherit owner's subscription
    if role in ("manager", "staff", "assistant"):
        assignment = await db.rbac_user_roles.find_one({"user_id": uid})
        if assignment:
            owner_doc = await db.users.find_one({"_id": _oid(assignment["assigned_by"])})
            if owner_doc:
                return await _resolve_status(owner_doc, inherited=True)
        # No owner found — treat as no subscription
        return {"status": "none", "inherited": True, "message": "No active company subscription found."}

    return await _resolve_status(user_doc, inherited=False)


async def _resolve_status(user_doc: dict, inherited: bool) -> dict:
    status = user_doc.get("subscription_status", "none")
    trial_ends_at = user_doc.get("trial_ends_at")
    onboarding_complete = user_doc.get("onboarding_complete", False)

    now = datetime.datetime.utcnow()

    if status == "trial":
        if trial_ends_at and now > trial_ends_at:
            # Trial has expired — update in DB
            status = "expired"
        else:
            days_left = max(0, (trial_ends_at - now).days) if trial_ends_at else 0
            return {
                "status": "trial",
                "inherited": inherited,
                "onboarding_complete": onboarding_complete,
                "trial_ends_at": trial_ends_at.isoformat() if trial_ends_at else None,
                "days_left": days_left,
            }

    return {
        "status": status,  # "none" | "trial" | "active" | "expired"
        "inherited": inherited,
        "onboarding_complete": onboarding_complete,
        "trial_ends_at": trial_ends_at.isoformat() if trial_ends_at else None,
        "days_left": None,
    }


# ─── GET /subscription/status ────────────────────────────────────────────────

@router.get("/status")
async def get_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    data = await _get_subscription_status(current_user, db)
    return {"success": True, "data": data}


# ─── POST /subscription/start-trial ─────────────────────────────────────────

@router.post("/start-trial")
async def start_trial(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    uid = _uid(current_user)

    existing = current_user.get("subscription_status", "none")
    if existing in ("trial", "active"):
        raise AppException(
            status_code=400,
            code="ALREADY_ACTIVE",
            message="You already have an active subscription or trial.",
        )

    now = datetime.datetime.utcnow()
    trial_ends = now + datetime.timedelta(days=7)

    await db.users.update_one(
        {"_id": _oid(uid)},
        {
            "$set": {
                "subscription_status": "trial",
                "trial_started_at": now,
                "trial_ends_at": trial_ends,
                "onboarding_complete": True,
                "role": "owner",
                "primary_role": "owner",
                "updated_at": now,
            }
        },
    )

    return {
        "success": True,
        "message": "7-day free trial started successfully.",
        "data": {
            "status": "trial",
            "trial_started_at": now.isoformat(),
            "trial_ends_at": trial_ends.isoformat(),
            "days_left": 7,
        },
    }


# ─── POST /subscription/complete-onboarding ──────────────────────────────────
# Called when user clicks "Explore" (free/limited mode)

@router.post("/complete-onboarding")
async def complete_onboarding(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    uid = _uid(current_user)
    await db.users.update_one(
        {"_id": _oid(uid)},
        {"$set": {"onboarding_complete": True, "updated_at": datetime.datetime.utcnow()}},
    )
    return {"success": True, "message": "Onboarding marked complete."}


# ─── POST /subscription/activate ─────────────────────────────────────────────
# Placeholder for real payment integration

@router.post("/activate")
async def activate_subscription(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    uid = _uid(current_user)

    now = datetime.datetime.utcnow()
    await db.users.update_one(
        {"_id": _oid(uid)},
        {
            "$set": {
                "subscription_status": "active",
                "subscription_started_at": now,
                "onboarding_complete": True,
                "role": "owner",
                "primary_role": "owner",
                "updated_at": now,
            }
        },
    )

    return {
        "success": True,
        "message": "Subscription activated.",
        "data": {"status": "active"},
    }
