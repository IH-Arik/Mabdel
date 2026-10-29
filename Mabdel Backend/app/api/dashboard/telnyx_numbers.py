from __future__ import annotations

import asyncio
from functools import partial

from fastapi import APIRouter, Body, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.exceptions import AppException
from app.dependencies import get_mongo_database, require_role
from app.repositories.rbac_repository import RBACRepository
from app.services.telnyx_provisioning_service import TelnyxProvisioningService, _release_sync_strict
from app.utils.helpers import utc_now

router = APIRouter(prefix="/admin/telnyx-numbers", tags=["Telnyx Numbers (Admin)"])


def _actor_id(current_user: dict) -> str:
    return str(current_user.get("_id") or current_user.get("id") or current_user.get("user_id") or "")


async def _resolve_number_or_404(db: AsyncIOMotorDatabase, phone_number_id: str) -> dict:
    """Finds the Telnyx-account listing item for this /phone_numbers resource id.
    The path parameter is always this id (never the number-order id some org
    records stored instead), so this is the one source of truth for the real
    phone number string."""
    numbers = await TelnyxProvisioningService(db).list_all_numbers()
    match = next((n for n in numbers if n["phone_number_id"] == phone_number_id), None)
    if not match:
        raise AppException(
            status_code=404,
            code="TELNYX_NUMBER_NOT_FOUND",
            message="No Telnyx number with that id was found on the account.",
        )
    return match


def _guard_platform_number(match: dict) -> None:
    if match.get("platform"):
        raise AppException(
            status_code=409,
            code="TELNYX_PLATFORM_NUMBER_PROTECTED",
            message="This is the shared platform fallback number and cannot be released or reassigned.",
        )


async def _find_owning_org(db: AsyncIOMotorDatabase, phone_number_id: str, phone_number: str) -> dict | None:
    return await db.organizations.find_one(
        {"$or": [{"telnyx_phone_number_id": phone_number_id}, {"telnyx_phone_number": phone_number}]}
    )


@router.get("")
async def list_telnyx_numbers(
    current_user: dict = Depends(require_role(["super_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    service = TelnyxProvisioningService(db)
    numbers = await service.list_all_numbers()
    data = []
    for number in numbers:
        usage = await service.get_number_usage(number["phone_number"])
        data.append({**number, "usage": usage})
    return {"success": True, "data": data}


@router.delete("/{phone_number_id}")
async def release_telnyx_number(
    phone_number_id: str,
    current_user: dict = Depends(require_role(["super_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    match = await _resolve_number_or_404(db, phone_number_id)
    _guard_platform_number(match)

    org = await _find_owning_org(db, phone_number_id, match["phone_number"])
    organization_id = org.get("organization_id") if org else None

    # Delete on Telnyx first, strictly: a failure here must propagate as an
    # error, not be swallowed into a false "released" success.
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, partial(_release_sync_strict, phone_number_id))
    except Exception as exc:
        raise AppException(
            status_code=502,
            code="TELNYX_RELEASE_FAILED",
            message=f"Failed to release the number on Telnyx: {exc}",
        ) from exc

    if org:
        await db.organizations.update_one(
            {"organization_id": organization_id},
            {
                "$unset": {
                    "telnyx_phone_number": "",
                    "telnyx_phone_number_id": "",
                    "telnyx_number_order_id": "",
                },
                "$set": {"telnyx_setup_status": "not_provisioned", "updated_at": utc_now()},
            },
        )

    await RBACRepository(db).write_audit_log(
        {
            "actor_id": _actor_id(current_user),
            "action": "telnyx_number_released",
            "target": phone_number_id,
            "organization_id": organization_id,
        }
    )
    return {"success": True}


@router.patch("/{phone_number_id}/assign")
async def assign_telnyx_number(
    phone_number_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(require_role(["super_admin", "admin"])),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    target_organization_id = body["organization_id"]

    match = await _resolve_number_or_404(db, phone_number_id)
    _guard_platform_number(match)
    phone_number = match["phone_number"]

    existing_org = await _find_owning_org(db, phone_number_id, phone_number)
    if existing_org and existing_org.get("organization_id") != target_organization_id:
        raise AppException(
            status_code=409,
            code="TELNYX_NUMBER_ALREADY_ASSIGNED",
            message="This number is already assigned to another organization.",
        )

    target_org = await db.organizations.find_one({"organization_id": target_organization_id})
    if not target_org:
        raise AppException(
            status_code=404,
            code="ORGANIZATION_NOT_FOUND",
            message="No organization with that id was found.",
        )

    current_number = target_org.get("telnyx_phone_number")
    if current_number and current_number != phone_number:
        raise AppException(
            status_code=409,
            code="TELNYX_ORGANIZATION_ALREADY_HAS_NUMBER",
            message="This organization already has a different number assigned. Release it first.",
        )

    await db.organizations.update_one(
        {"organization_id": target_organization_id},
        {
            "$set": {
                "telnyx_phone_number": phone_number,
                "telnyx_phone_number_id": phone_number_id,
                "telnyx_setup_status": "active",
                "updated_at": utc_now(),
            },
        },
    )

    await RBACRepository(db).write_audit_log(
        {
            "actor_id": _actor_id(current_user),
            "action": "telnyx_number_assigned",
            "target": phone_number_id,
            "organization_id": target_organization_id,
        }
    )
    return {"success": True}
