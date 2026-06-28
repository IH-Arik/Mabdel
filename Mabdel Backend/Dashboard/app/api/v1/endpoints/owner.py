"""
Owner-specific endpoints.
Owners can manage their team (manager/staff/assistant) and set restrictions.
"""
from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from Dashboard.app.core.exceptions import AppException
from Dashboard.app.dependencies import get_current_user, get_mongo_database, require_role
from Dashboard.app.repositories.dashboard_repository import DashboardRepository

router = APIRouter()

OWNER_ALLOWED_ROLES = {"super_admin", "admin", "owner"}
ASSIGNABLE_ROLES = {"manager", "staff", "assistant"}
TEAM_MEMBER_ROLES = {"manager", "staff", "assistant"}


def _str_id(doc: dict | None) -> dict | None:
    if not doc:
        return None
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    return out


def _user_id(user: dict) -> str:
    return str(user.get("_id") or user.get("id") or "")


async def _get_rbac(db):
    from app.services.rbac_service import RBACService
    return RBACService(db)


async def _resolve_owner_role(current_user: dict, db: AsyncIOMotorDatabase) -> str:
    """Return the highest RBAC role slug for this user (must be owner/admin/super_admin)."""
    rbac = await _get_rbac(db)
    slugs = await rbac.get_user_role_slugs(_user_id(current_user), current_user.get("role", "user"))
    allowed = slugs & OWNER_ALLOWED_ROLES
    if not allowed:
        raise AppException(status_code=403, code="FORBIDDEN", message="Owner access required.")
    from app.models.rbac_models import ROLE_HIERARCHY
    return max(allowed, key=lambda s: ROLE_HIERARCHY.get(s, 0))


# ─── GET /owner/me ────────────────────────────────────────────────────────────

@router.get("/me")
async def owner_me(
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    uid = _user_id(current_user)
    role = await _resolve_owner_role(current_user, db)

    # Count team members assigned by this owner per role
    manager_count = await db.rbac_user_roles.count_documents(
        {"assigned_by": uid, "role_slug": "manager"}
    )
    staff_count = await db.rbac_user_roles.count_documents(
        {"assigned_by": uid, "role_slug": "staff"}
    )
    assistant_count = await db.rbac_user_roles.count_documents(
        {"assigned_by": uid, "role_slug": "assistant"}
    )

    return {
        "success": True,
        "data": {
            "id": uid,
            "email": current_user.get("email"),
            "name": current_user.get("full_name") or current_user.get("name") or "Owner",
            "role": role,
            "team_stats": {
                "managers": manager_count,
                "staff": staff_count,
                "assistants": assistant_count,
                "total": manager_count + staff_count + assistant_count,
            },
        },
    }


# ─── GET /owner/team ──────────────────────────────────────────────────────────

@router.get("/team")
async def list_team(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    role_filter: str | None = Query(None),
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    uid = _user_id(current_user)
    await _resolve_owner_role(current_user, db)

    query: dict = {"assigned_by": uid}
    if role_filter and role_filter in ASSIGNABLE_ROLES:
        query["role_slug"] = role_filter

    total = await db.rbac_user_roles.count_documents(query)
    skip = (page - 1) * limit
    assignments = await db.rbac_user_roles.find(query).skip(skip).limit(limit).to_list(None)

    members = []
    for a in assignments:
        user_doc = await db.users.find_one({"_id": ObjectId(a["user_id"]) if ObjectId.is_valid(a["user_id"]) else a["user_id"]})
        if not user_doc:
            continue

        # Get restrictions for this user
        restriction = await db.rbac_user_restrictions.find_one(
            {"user_id": a["user_id"], "owner_id": uid}
        )

        members.append({
            "assignment_id": str(a["_id"]),
            "user_id": a["user_id"],
            "email": user_doc.get("email"),
            "name": user_doc.get("full_name") or user_doc.get("name") or "",
            "profile_photo": user_doc.get("profilePhoto") or user_doc.get("profile_photo") or "",
            "role_slug": a.get("role_slug"),
            "assigned_at": a.get("assigned_at"),
            "status": user_doc.get("status", "active"),
            "allowed_permissions": restriction.get("allowed_permissions", []) if restriction else None,
        })

    return {
        "success": True,
        "data": {
            "items": members,
            "total": total,
            "page": page,
            "limit": limit,
        },
    }


# ─── GET /owner/search ────────────────────────────────────────────────────────

@router.get("/search")
async def search_users(
    q: str = Query(..., min_length=2),
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    await _resolve_owner_role(current_user, db)

    results = await db.users.find(
        {
            "$or": [
                {"email": {"$regex": q, "$options": "i"}},
                {"full_name": {"$regex": q, "$options": "i"}},
                {"name": {"$regex": q, "$options": "i"}},
            ]
        },
        {"email": 1, "full_name": 1, "name": 1, "role": 1, "profilePhoto": 1, "profile_photo": 1},
    ).limit(10).to_list(None)

    return {
        "success": True,
        "data": [
            {
                "user_id": str(u["_id"]),
                "email": u.get("email"),
                "name": u.get("full_name") or u.get("name") or "",
                "profile_photo": u.get("profilePhoto") or u.get("profile_photo") or "",
                "current_role": u.get("role", "user"),
            }
            for u in results
        ],
    }


# ─── POST /owner/assign ───────────────────────────────────────────────────────

@router.post("/assign")
async def assign_team_role(
    body: dict = Body(...),
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    uid = _user_id(current_user)
    owner_role = await _resolve_owner_role(current_user, db)

    target_user_id = body.get("user_id", "").strip()
    role_slug = body.get("role_slug", "").strip()

    if not target_user_id or not role_slug:
        raise AppException(status_code=400, code="INVALID_INPUT", message="user_id and role_slug are required.")

    if role_slug not in ASSIGNABLE_ROLES:
        raise AppException(
            status_code=400,
            code="INVALID_ROLE",
            message=f"Owners can only assign: {', '.join(sorted(ASSIGNABLE_ROLES))} roles.",
        )

    # Verify target user exists
    target_oid = ObjectId(target_user_id) if ObjectId.is_valid(target_user_id) else target_user_id
    target_user = await db.users.find_one({"_id": target_oid})
    if not target_user:
        raise AppException(status_code=404, code="USER_NOT_FOUND", message="User not found.")

    # One role per user per owner — revoke any existing role this owner gave them first
    existing = await db.rbac_user_roles.find_one({"user_id": target_user_id, "assigned_by": uid})
    if existing:
        existing_role = existing.get("role_slug")
        if existing_role == role_slug:
            raise AppException(
                status_code=400,
                code="ALREADY_ASSIGNED",
                message=f"This user is already assigned as {role_slug} in your team.",
            )
        # Revoke the old role before assigning the new one
        await db.rbac_user_roles.delete_many({"user_id": target_user_id, "assigned_by": uid})

    rbac = await _get_rbac(db)
    await rbac.assign_role_to_user(
        user_id=target_user_id,
        role_slug=role_slug,
        assigned_by=uid,
        assigned_by_role=owner_role,
    )

    # Update user's role field too
    await db.users.update_one(
        {"_id": target_oid},
        {"$set": {"role": role_slug, "primary_role": role_slug, "updated_at": datetime.utcnow()}},
    )

    # Store permission restrictions — use provided list or auto-populate from role defaults
    allowed_permissions = body.get("allowed_permissions")
    if not isinstance(allowed_permissions, list):
        # Auto-fetch default permissions for this role
        role_doc = await db.rbac_roles.find_one({"slug": role_slug})
        if role_doc and role_doc.get("permission_ids"):
            perm_docs = await db.rbac_permissions.find(
                {"_id": {"$in": [ObjectId(pid) if ObjectId.is_valid(str(pid)) else pid for pid in role_doc["permission_ids"]]}},
                {"module": 1, "action": 1},
            ).to_list(None)
            allowed_permissions = [f"{p['module']}:{p['action']}" for p in perm_docs]
        else:
            allowed_permissions = []

    await db.rbac_user_restrictions.update_one(
        {"user_id": target_user_id, "owner_id": uid},
        {
            "$set": {
                "allowed_permissions": allowed_permissions,
                "role_slug": role_slug,
                "updated_at": datetime.utcnow(),
            },
            "$setOnInsert": {"created_at": datetime.utcnow()},
        },
        upsert=True,
    )

    return {
        "success": True,
        "message": f"User assigned as {role_slug} successfully.",
        "data": {"user_id": target_user_id, "role_slug": role_slug},
    }


# ─── DELETE /owner/revoke ─────────────────────────────────────────────────────

@router.delete("/revoke")
async def revoke_team_role(
    body: dict = Body(...),
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    uid = _user_id(current_user)
    owner_role = await _resolve_owner_role(current_user, db)

    target_user_id = body.get("user_id", "").strip()
    role_slug = body.get("role_slug", "").strip()

    if not target_user_id or not role_slug:
        raise AppException(status_code=400, code="INVALID_INPUT", message="user_id and role_slug are required.")

    rbac = await _get_rbac(db)
    await rbac.revoke_role_from_user(
        user_id=target_user_id,
        role_slug=role_slug,
        revoked_by_role=owner_role,
    )

    # Remove restrictions
    await db.rbac_user_restrictions.delete_many({"user_id": target_user_id, "owner_id": uid})

    # Reset user role if this was their primary role
    target_oid = ObjectId(target_user_id) if ObjectId.is_valid(target_user_id) else target_user_id
    await db.users.update_one(
        {"_id": target_oid, "role": role_slug},
        {"$set": {"role": "user", "primary_role": "user", "updated_at": datetime.utcnow()}},
    )

    return {"success": True, "message": f"Role '{role_slug}' revoked from user."}


# ─── GET /owner/team/{user_id}/permissions ────────────────────────────────────

@router.get("/team/{user_id}/permissions")
async def get_user_permissions(
    user_id: str,
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    uid = _user_id(current_user)
    await _resolve_owner_role(current_user, db)

    restriction = await db.rbac_user_restrictions.find_one(
        {"user_id": user_id, "owner_id": uid}
    )

    # Only expose CRM modules — platform-level perms are not relevant for team members
    CRM_MODULES = {
        "contacts", "messages", "calls", "appointments",
        "invoices", "bulk_messaging", "social_media",
        "ai_tools", "chat_groups", "integrations",
    }

    all_perms = await db.rbac_permissions.find(
        {"module": {"$in": list(CRM_MODULES)}}
    ).sort([("module", 1), ("action", 1)]).to_list(None)

    grouped: dict[str, list] = {}
    for p in all_perms:
        mod = p.get("module", "other")
        grouped.setdefault(mod, []).append({
            "id": str(p["_id"]),
            "module": mod,
            "action": p.get("action"),
            "label": p.get("label"),
            "description": p.get("description", ""),
            "key": f"{mod}:{p.get('action')}",
        })

    crm_keys = {f"{p['module']}:{p['action']}" for p in all_perms}

    # Get the role slug for this member
    assignment = await db.rbac_user_roles.find_one({"user_id": user_id, "assigned_by": uid})
    role_slug = (
        restriction.get("role_slug") if restriction
        else assignment.get("role_slug") if assignment
        else None
    )

    stored = restriction.get("allowed_permissions") if restriction else None

    if isinstance(stored, list):
        # Filter to CRM-only keys
        stored = [k for k in stored if k in crm_keys]
    else:
        # No restriction saved — fall back to role default permissions
        stored = []
        if role_slug:
            role_doc = await db.rbac_roles.find_one({"slug": role_slug})
            if role_doc and role_doc.get("permission_ids"):
                default_perms = await db.rbac_permissions.find(
                    {
                        "_id": {"$in": [
                            ObjectId(pid) if ObjectId.is_valid(str(pid)) else pid
                            for pid in role_doc["permission_ids"]
                        ]},
                        "module": {"$in": list(CRM_MODULES)},
                    },
                    {"module": 1, "action": 1},
                ).to_list(None)
                stored = [f"{p['module']}:{p['action']}" for p in default_perms]

    return {
        "success": True,
        "data": {
            "user_id": user_id,
            "role_slug": role_slug,
            "allowed_permissions": stored,
            "all_permissions": grouped,
        },
    }


# ─── PUT /owner/team/{user_id}/permissions ────────────────────────────────────

@router.put("/team/{user_id}/permissions")
async def set_user_permissions(
    user_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    uid = _user_id(current_user)
    await _resolve_owner_role(current_user, db)

    allowed_permissions = body.get("allowed_permissions")
    if not isinstance(allowed_permissions, list):
        raise AppException(status_code=400, code="INVALID_INPUT", message="allowed_permissions must be an array.")

    # Verify this user is actually assigned by this owner
    assignment = await db.rbac_user_roles.find_one({"user_id": user_id, "assigned_by": uid})
    if not assignment:
        raise AppException(
            status_code=403,
            code="NOT_YOUR_TEAM",
            message="This user is not in your team.",
        )

    await db.rbac_user_restrictions.update_one(
        {"user_id": user_id, "owner_id": uid},
        {
            "$set": {
                "allowed_permissions": allowed_permissions,
                "updated_at": datetime.utcnow(),
            },
            "$setOnInsert": {"created_at": datetime.utcnow()},
        },
        upsert=True,
    )

    return {
        "success": True,
        "message": "Permissions updated.",
        "data": {"user_id": user_id, "allowed_permissions": allowed_permissions},
    }


# ─── GET /owner/modules ───────────────────────────────────────────────────────

@router.get("/modules")
async def list_permission_modules(
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    await _resolve_owner_role(current_user, db)

    all_perms = await db.rbac_permissions.find({}).sort([("module", 1), ("action", 1)]).to_list(None)
    grouped: dict[str, list] = {}
    for p in all_perms:
        mod = p.get("module", "other")
        grouped.setdefault(mod, []).append({
            "id": str(p["_id"]),
            "module": mod,
            "action": p.get("action"),
            "label": p.get("label"),
            "key": f"{mod}:{p.get('action')}",
        })

    return {"success": True, "data": grouped}


# ─── POST /owner/team/{user_id}/ban ──────────────────────────────────────────

@router.post("/team/{user_id}/ban")
async def ban_team_member(
    user_id: str,
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    uid = _user_id(current_user)
    await _resolve_owner_role(current_user, db)

    # Verify this user is in the owner's team
    assignment = await db.rbac_user_roles.find_one({"user_id": user_id, "assigned_by": uid})
    if not assignment:
        raise AppException(status_code=403, code="NOT_YOUR_TEAM", message="This user is not in your team.")

    repo = DashboardRepository(db)
    success = await repo.update_user_status(user_id, "blocked")
    if not success:
        raise AppException(status_code=404, code="USER_NOT_FOUND", message="User not found.")

    return {"success": True, "message": "Team member banned successfully.", "data": {"user_id": user_id, "status": "blocked"}}


# ─── POST /owner/team/{user_id}/unban ────────────────────────────────────────

@router.post("/team/{user_id}/unban")
async def unban_team_member(
    user_id: str,
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    uid = _user_id(current_user)
    await _resolve_owner_role(current_user, db)

    assignment = await db.rbac_user_roles.find_one({"user_id": user_id, "assigned_by": uid})
    if not assignment:
        raise AppException(status_code=403, code="NOT_YOUR_TEAM", message="This user is not in your team.")

    repo = DashboardRepository(db)
    success = await repo.update_user_status(user_id, "active")
    if not success:
        raise AppException(status_code=404, code="USER_NOT_FOUND", message="User not found.")

    return {"success": True, "message": "Team member unbanned successfully.", "data": {"user_id": user_id, "status": "active"}}


# ─── GET /owner/team/dashboard ────────────────────────────────────────────────

@router.get("/team/dashboard")
async def owner_team_dashboard(
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    uid = _user_id(current_user)
    await _resolve_owner_role(current_user, db)

    # Get all team member user_ids assigned by this owner
    assignments = await db.rbac_user_roles.find({"assigned_by": uid}).to_list(None)
    team_ids = [a["user_id"] for a in assignments]

    if not team_ids:
        return {
            "success": True,
            "data": {
                "total_contacts": 0,
                "total_appointments": 0,
                "total_calls": 0,
                "total_invoices": 0,
                "recent_calls": [],
                "recent_invoices": [],
                "recent_contacts": [],
                "recent_appointments": [],
            },
        }

    # Aggregate counts across all team members
    total_contacts = await db.contacts.count_documents({"user_id": {"$in": team_ids}})
    total_appointments = await db.calendar_events.count_documents({"user_id": {"$in": team_ids}})
    total_calls = await db.call_logs.count_documents({"user_id": {"$in": team_ids}})
    total_invoices = await db.invoices.count_documents({"user_id": {"$in": team_ids}})

    # Recent items
    recent_calls = await db.call_logs.find(
        {"user_id": {"$in": team_ids}},
        {"_id": 1, "user_id": 1, "contact_name": 1, "duration": 1, "recording_url": 1, "timestamp": 1, "status": 1},
    ).sort("timestamp", -1).limit(10).to_list(None)

    recent_invoices = await db.invoices.find(
        {"user_id": {"$in": team_ids}},
        {"_id": 1, "user_id": 1, "recipient_name": 1, "total_amount": 1, "status": 1, "created_at": 1},
    ).sort("created_at", -1).limit(10).to_list(None)

    recent_contacts = await db.contacts.find(
        {"user_id": {"$in": team_ids}},
        {"_id": 1, "user_id": 1, "full_name": 1, "email": 1, "phone": 1, "created_at": 1},
    ).sort("created_at", -1).limit(10).to_list(None)

    recent_appointments = await db.calendar_events.find(
        {"user_id": {"$in": team_ids}},
        {"_id": 1, "user_id": 1, "title": 1, "starts_at": 1, "ends_at": 1, "status": 1},
    ).sort("starts_at", -1).limit(10).to_list(None)

    def _fmt(docs: list) -> list:
        out = []
        for d in docs:
            d["_id"] = str(d["_id"])
            out.append(d)
        return out

    return {
        "success": True,
        "data": {
            "total_contacts": total_contacts,
            "total_appointments": total_appointments,
            "total_calls": total_calls,
            "total_invoices": total_invoices,
            "recent_calls": _fmt(recent_calls),
            "recent_invoices": _fmt(recent_invoices),
            "recent_contacts": _fmt(recent_contacts),
            "recent_appointments": _fmt(recent_appointments),
        },
    }


# ─── GET /owner/my-dashboard ─────────────────────────────────────────────────
# Personal CRM summary for manager/staff/assistant (their own data)

@router.get("/my-dashboard")
async def my_dashboard(
    days: int = Query(30, ge=1, le=90),
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner", "manager", "staff", "assistant"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    import datetime as dt

    uid = _user_id(current_user)
    since = dt.datetime.utcnow() - dt.timedelta(days=days)

    # Personal counts
    total_contacts    = await db.contacts.count_documents({"user_id": uid, "created_at": {"$gte": since}})
    total_calls       = await db.call_logs.count_documents({"user_id": uid, "timestamp": {"$gte": since}})
    total_appts       = await db.calendar_events.count_documents({"user_id": uid, "starts_at": {"$gte": since}})
    total_invoices    = await db.invoices.count_documents({"user_id": uid, "created_at": {"$gte": since}})

    # Daily trend (last 14 days for dashboard)
    trend_days = min(days, 14)
    trend_since = dt.datetime.utcnow() - dt.timedelta(days=trend_days)

    async def daily(collection: str, date_field: str) -> dict[str, int]:
        pipeline = [
            {"$match": {"user_id": uid, date_field: {"$gte": trend_since}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": f"${date_field}"}},
                "count": {"$sum": 1},
            }},
        ]
        out: dict[str, int] = {}
        async for doc in db[collection].aggregate(pipeline):
            out[doc["_id"]] = doc["count"]
        return out

    import asyncio as _asyncio
    c_t, ca_t, ap_t, inv_t = await _asyncio.gather(
        daily("contacts", "created_at"),
        daily("call_logs", "timestamp"),
        daily("calendar_events", "starts_at"),
        daily("invoices", "created_at"),
    )

    daily_trend = []
    for i in range(trend_days):
        day = (trend_since + dt.timedelta(days=i + 1)).strftime("%Y-%m-%d")
        daily_trend.append({
            "date": day,
            "contacts": c_t.get(day, 0),
            "calls": ca_t.get(day, 0),
            "appointments": ap_t.get(day, 0),
            "invoices": inv_t.get(day, 0),
        })

    def _fmt(docs: list) -> list:
        return [{**{k: str(v) if k == "_id" else v for k, v in d.items()}} for d in docs]

    recent_contacts = _fmt(await db.contacts.find(
        {"user_id": uid},
        {"_id": 1, "full_name": 1, "email": 1, "phone": 1, "created_at": 1},
    ).sort("created_at", -1).limit(5).to_list(None))

    recent_calls = _fmt(await db.call_logs.find(
        {"user_id": uid},
        {"_id": 1, "contact_name": 1, "duration": 1, "status": 1, "timestamp": 1},
    ).sort("timestamp", -1).limit(5).to_list(None))

    recent_appts = _fmt(await db.calendar_events.find(
        {"user_id": uid},
        {"_id": 1, "title": 1, "starts_at": 1, "ends_at": 1, "status": 1},
    ).sort("starts_at", -1).limit(5).to_list(None))

    recent_invoices = _fmt(await db.invoices.find(
        {"user_id": uid},
        {"_id": 1, "recipient_name": 1, "total_amount": 1, "status": 1, "created_at": 1},
    ).sort("created_at", -1).limit(5).to_list(None))

    # Call status breakdown
    call_pipeline = [
        {"$match": {"user_id": uid, "timestamp": {"$gte": since}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    call_breakdown: dict[str, int] = {}
    async for doc in db.call_logs.aggregate(call_pipeline):
        call_breakdown[doc["_id"] or "unknown"] = doc["count"]

    return {
        "success": True,
        "data": {
            "period_days": days,
            "totals": {
                "contacts": total_contacts,
                "calls": total_calls,
                "appointments": total_appts,
                "invoices": total_invoices,
                "total_activity": total_contacts + total_calls + total_appts + total_invoices,
            },
            "daily_trend": daily_trend,
            "call_breakdown": call_breakdown,
            "recent_contacts": recent_contacts,
            "recent_calls": recent_calls,
            "recent_appointments": recent_appts,
            "recent_invoices": recent_invoices,
        },
    }


# ─── GET /owner/team/analysis ─────────────────────────────────────────────────

@router.get("/team/analysis")
async def owner_team_analysis(
    days: int = 30,
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    """
    Returns CRM activity analysis for the owner's team.
    - Per-member breakdown: contacts, calls, appointments, invoices
    - Role distribution: manager / staff / assistant counts
    - Daily trend for the last `days` days (default 30, max 90)
    """
    import datetime as dt

    uid = _user_id(current_user)
    await _resolve_owner_role(current_user, db)

    days = min(max(days, 1), 90)
    since = dt.datetime.utcnow() - dt.timedelta(days=days)

    # ── Team members ─────────────────────────────────────────────────────────
    assignments = await db.rbac_user_roles.find({"assigned_by": uid}).to_list(None)
    if not assignments:
        return {"success": True, "data": {
            "period_days": days,
            "role_distribution": {},
            "totals": {"contacts": 0, "calls": 0, "appointments": 0, "invoices": 0},
            "per_member": [],
            "daily_trend": [],
        }}

    team_ids = [a["user_id"] for a in assignments]

    # Fetch user profiles for names
    users_cursor = db.users.find(
        {"_id": {"$in": [__import__("bson").ObjectId(i) for i in team_ids if len(i) == 24]}},
        {"_id": 1, "name": 1, "email": 1},
    )
    user_map: dict[str, dict] = {}
    async for u in users_cursor:
        user_map[str(u["_id"])] = {"name": u.get("name", "Unknown"), "email": u.get("email", "")}

    # Role distribution
    role_dist: dict[str, int] = {}
    member_roles: dict[str, str] = {}
    for a in assignments:
        role = a.get("role_slug", "unknown")
        role_dist[role] = role_dist.get(role, 0) + 1
        member_roles[a["user_id"]] = role

    # ── Aggregated counts per member ──────────────────────────────────────────
    async def count_per_member(collection: str, date_field: str) -> dict[str, int]:
        pipeline = [
            {"$match": {"user_id": {"$in": team_ids}, date_field: {"$gte": since}}},
            {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        ]
        result = {}
        async for doc in db[collection].aggregate(pipeline):
            result[doc["_id"]] = doc["count"]
        return result

    contacts_map, calls_map, appts_map, invoices_map = await __import__("asyncio").gather(
        count_per_member("contacts", "created_at"),
        count_per_member("call_logs", "timestamp"),
        count_per_member("calendar_events", "starts_at"),
        count_per_member("invoices", "created_at"),
    )

    per_member = []
    for uid_m in team_ids:
        info = user_map.get(uid_m, {"name": "Unknown", "email": ""})
        per_member.append({
            "user_id": uid_m,
            "name": info["name"],
            "email": info["email"],
            "role": member_roles.get(uid_m, "unknown"),
            "contacts": contacts_map.get(uid_m, 0),
            "calls": calls_map.get(uid_m, 0),
            "appointments": appts_map.get(uid_m, 0),
            "invoices": invoices_map.get(uid_m, 0),
            "total_activity": (
                contacts_map.get(uid_m, 0)
                + calls_map.get(uid_m, 0)
                + appts_map.get(uid_m, 0)
                + invoices_map.get(uid_m, 0)
            ),
        })

    per_member.sort(key=lambda x: x["total_activity"], reverse=True)

    totals = {
        "contacts": sum(contacts_map.values()),
        "calls": sum(calls_map.values()),
        "appointments": sum(appts_map.values()),
        "invoices": sum(invoices_map.values()),
    }

    # ── Daily trend ───────────────────────────────────────────────────────────
    async def daily_counts(collection: str, date_field: str) -> dict[str, int]:
        pipeline = [
            {"$match": {"user_id": {"$in": team_ids}, date_field: {"$gte": since}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": f"${date_field}"}},
                "count": {"$sum": 1},
            }},
        ]
        result = {}
        async for doc in db[collection].aggregate(pipeline):
            result[doc["_id"]] = doc["count"]
        return result

    c_trend, ca_trend, ap_trend, inv_trend = await __import__("asyncio").gather(
        daily_counts("contacts", "created_at"),
        daily_counts("call_logs", "timestamp"),
        daily_counts("calendar_events", "starts_at"),
        daily_counts("invoices", "created_at"),
    )

    # Build full date range
    daily_trend = []
    for i in range(days):
        day = (since + dt.timedelta(days=i + 1)).strftime("%Y-%m-%d")
        daily_trend.append({
            "date": day,
            "contacts": c_trend.get(day, 0),
            "calls": ca_trend.get(day, 0),
            "appointments": ap_trend.get(day, 0),
            "invoices": inv_trend.get(day, 0),
        })

    return {
        "success": True,
        "data": {
            "period_days": days,
            "role_distribution": role_dist,
            "totals": totals,
            "per_member": per_member,
            "daily_trend": daily_trend,
        },
    }


# ─── GET /owner/team/{user_id}/analysis ──────────────────────────────────────

@router.get("/team/{user_id}/analysis")
async def member_analysis(
    user_id: str,
    days: int = Query(30, ge=1, le=90),
    current_user: dict = Depends(require_role(["super_admin", "admin", "owner"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    """Individual CRM activity analysis for a single team member."""
    import datetime as dt

    uid = _user_id(current_user)
    await _resolve_owner_role(current_user, db)

    # Verify member belongs to this owner
    assignment = await db.rbac_user_roles.find_one({"user_id": user_id, "assigned_by": uid})
    if not assignment:
        raise AppException(status_code=403, code="NOT_YOUR_TEAM", message="This user is not in your team.")

    since = dt.datetime.utcnow() - dt.timedelta(days=days)

    # Member profile
    member_doc = None
    if len(user_id) == 24:
        member_doc = await db.users.find_one(
            {"_id": ObjectId(user_id)},
            {"_id": 1, "name": 1, "full_name": 1, "email": 1, "phone": 1, "avatar": 1, "status": 1, "created_at": 1},
        )
    member_info = {
        "user_id": user_id,
        "name": (member_doc or {}).get("full_name") or (member_doc or {}).get("name") or "Unknown",
        "email": (member_doc or {}).get("email", ""),
        "phone": (member_doc or {}).get("phone", ""),
        "avatar": (member_doc or {}).get("avatar", ""),
        "status": (member_doc or {}).get("status", "active"),
        "role": assignment.get("role_slug", "unknown"),
        "assigned_at": str(assignment.get("assigned_at", "")),
    }

    # ── Totals ────────────────────────────────────────────────────────────────
    total_contacts = await db.contacts.count_documents({"user_id": user_id, "created_at": {"$gte": since}})
    total_calls    = await db.call_logs.count_documents({"user_id": user_id, "timestamp": {"$gte": since}})
    total_appts    = await db.calendar_events.count_documents({"user_id": user_id, "starts_at": {"$gte": since}})
    total_invoices = await db.invoices.count_documents({"user_id": user_id, "created_at": {"$gte": since}})

    # ── Daily trend ───────────────────────────────────────────────────────────
    async def daily(collection: str, date_field: str) -> dict[str, int]:
        pipeline = [
            {"$match": {"user_id": user_id, date_field: {"$gte": since}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": f"${date_field}"}},
                "count": {"$sum": 1},
            }},
        ]
        out: dict[str, int] = {}
        async for doc in db[collection].aggregate(pipeline):
            out[doc["_id"]] = doc["count"]
        return out

    import asyncio as _asyncio
    c_t, ca_t, ap_t, inv_t = await _asyncio.gather(
        daily("contacts",      "created_at"),
        daily("call_logs",     "timestamp"),
        daily("calendar_events", "starts_at"),
        daily("invoices",      "created_at"),
    )

    daily_trend = []
    for i in range(days):
        day = (since + dt.timedelta(days=i + 1)).strftime("%Y-%m-%d")
        daily_trend.append({
            "date": day,
            "contacts":     c_t.get(day, 0),
            "calls":        ca_t.get(day, 0),
            "appointments": ap_t.get(day, 0),
            "invoices":     inv_t.get(day, 0),
        })

    # ── Recent activity ───────────────────────────────────────────────────────
    def _fmt(docs: list) -> list:
        return [{**{k: str(v) if k == "_id" else v for k, v in d.items()}} for d in docs]

    recent_contacts = _fmt(await db.contacts.find(
        {"user_id": user_id},
        {"_id": 1, "full_name": 1, "email": 1, "phone": 1, "created_at": 1},
    ).sort("created_at", -1).limit(5).to_list(None))

    recent_calls = _fmt(await db.call_logs.find(
        {"user_id": user_id},
        {"_id": 1, "contact_name": 1, "duration": 1, "status": 1, "timestamp": 1},
    ).sort("timestamp", -1).limit(5).to_list(None))

    recent_appts = _fmt(await db.calendar_events.find(
        {"user_id": user_id},
        {"_id": 1, "title": 1, "starts_at": 1, "status": 1},
    ).sort("starts_at", -1).limit(5).to_list(None))

    recent_invoices = _fmt(await db.invoices.find(
        {"user_id": user_id},
        {"_id": 1, "recipient_name": 1, "total_amount": 1, "status": 1, "created_at": 1},
    ).sort("created_at", -1).limit(5).to_list(None))

    # ── Call stats breakdown ──────────────────────────────────────────────────
    call_status_pipeline = [
        {"$match": {"user_id": user_id, "timestamp": {"$gte": since}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    call_breakdown: dict[str, int] = {}
    async for doc in db.call_logs.aggregate(call_status_pipeline):
        call_breakdown[doc["_id"] or "unknown"] = doc["count"]

    # ── Invoice status breakdown ──────────────────────────────────────────────
    inv_status_pipeline = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": since}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    invoice_breakdown: dict[str, int] = {}
    async for doc in db.invoices.aggregate(inv_status_pipeline):
        invoice_breakdown[doc["_id"] or "unknown"] = doc["count"]

    return {
        "success": True,
        "data": {
            "member": member_info,
            "period_days": days,
            "totals": {
                "contacts":     total_contacts,
                "calls":        total_calls,
                "appointments": total_appts,
                "invoices":     total_invoices,
                "total_activity": total_contacts + total_calls + total_appts + total_invoices,
            },
            "daily_trend": daily_trend,
            "call_breakdown":    call_breakdown,
            "invoice_breakdown": invoice_breakdown,
            "recent_contacts":   recent_contacts,
            "recent_calls":      recent_calls,
            "recent_appointments": recent_appts,
            "recent_invoices":   recent_invoices,
        },
    }
