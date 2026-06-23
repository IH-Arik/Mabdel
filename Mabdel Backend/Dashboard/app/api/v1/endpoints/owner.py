"""
Owner-specific endpoints.
Owners can manage their team (supervisors and staff) and set restrictions.
"""
from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from Dashboard.app.core.exceptions import AppException
from Dashboard.app.dependencies import get_current_user, get_mongo_database, require_role

router = APIRouter()

OWNER_ALLOWED_ROLES = {"super_admin", "admin", "owner"}
ASSIGNABLE_ROLES = {"supervisor", "staff"}


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

    # Count team members assigned by this owner
    supervisor_count = await db.rbac_user_roles.count_documents(
        {"assigned_by": uid, "role_slug": "supervisor"}
    )
    staff_count = await db.rbac_user_roles.count_documents(
        {"assigned_by": uid, "role_slug": "staff"}
    )

    return {
        "success": True,
        "data": {
            "id": uid,
            "email": current_user.get("email"),
            "name": current_user.get("full_name") or current_user.get("name") or "Owner",
            "role": role,
            "team_stats": {
                "supervisors": supervisor_count,
                "staff": staff_count,
                "total": supervisor_count + staff_count,
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
            message=f"Owners can only assign: {', '.join(sorted(ASSIGNABLE_ROLES))}.",
        )

    # Verify target user exists
    target_oid = ObjectId(target_user_id) if ObjectId.is_valid(target_user_id) else target_user_id
    target_user = await db.users.find_one({"_id": target_oid})
    if not target_user:
        raise AppException(status_code=404, code="USER_NOT_FOUND", message="User not found.")

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

    # Store permission restrictions if provided
    allowed_permissions = body.get("allowed_permissions")
    if isinstance(allowed_permissions, list):
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

    # Also get all available permissions grouped by module
    all_perms = await db.rbac_permissions.find({}).sort("module", 1).to_list(None)
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

    return {
        "success": True,
        "data": {
            "user_id": user_id,
            "allowed_permissions": restriction.get("allowed_permissions", []) if restriction else None,
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
