from __future__ import annotations

import asyncio
from functools import partial

from fastapi import APIRouter, Body, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import AppException
from app.dependencies import get_mongo_database, require_role
from app.repositories.rbac_repository import RBACRepository
from app.services.telnyx_provisioning_service import TelnyxProvisioningService, _release_sync
from app.utils.helpers import utc_now

router = APIRouter(prefix="/admin/telnyx-numbers", tags=["Telnyx Numbers (Admin)"])


def _actor_id(current_user: dict) -> str:
    return str(current_user.get("_id") or current_user.get("id") or current_user.get("user_id") or "")


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
    org = await db.organizations.find_one({"telnyx_phone_number_id": phone_number_id})
    organization_id = org.get("organization_id") if org else None

    if org:
        # release_organization does the Telnyx-side release AND the full field cleanup
        # (including telnyx_number_order_id) - reuse it rather than duplicating it here.
        await TelnyxProvisioningService(db).release_organization(organization_id)
    else:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, partial(_release_sync, phone_number_id))

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

    existing_org = await db.organizations.find_one({"telnyx_phone_number_id": phone_number_id})
    if existing_org and existing_org.get("organization_id") != target_organization_id:
        raise AppException(
            status_code=409,
            code="TELNYX_NUMBER_ALREADY_ASSIGNED",
            message="This number is already assigned to another organization.",
        )

    if existing_org:
        phone_number = existing_org.get("telnyx_phone_number")
    else:
        # Orphaned number: resolve its real phone number string from the Telnyx account
        # listing rather than guessing from an undocumented body field.
        numbers = await TelnyxProvisioningService(db).list_all_numbers()
        match = next((n for n in numbers if n["phone_number_id"] == phone_number_id), None)
        if not match:
            raise AppException(
                status_code=404,
                code="TELNYX_NUMBER_NOT_FOUND",
                message="No Telnyx number with that id was found on the account.",
            )
        phone_number = match["phone_number"]

    await db.organizations.update_one(
        {"organization_id": target_organization_id},
        {
            "$set": {
                "telnyx_phone_number": phone_number,
                "telnyx_phone_number_id": phone_number_id,
                "telnyx_setup_status": "active",
                "updated_at": utc_now(),
            },
            "$setOnInsert": {"organization_id": target_organization_id, "created_at": utc_now()},
        },
        upsert=True,
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
