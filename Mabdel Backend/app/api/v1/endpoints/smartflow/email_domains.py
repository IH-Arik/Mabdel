from __future__ import annotations

from fastapi import Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_mongo_database, require_permission
from app.schemas.smartflow import (
    EmailDomainRequest,
    EmailDomainSettingsUpdateRequest,
)
from app.services.email_domain import EmailDomainService
from app.utils.responses import success_response

from ._router import router


def get_email_domain_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> EmailDomainService:
    return EmailDomainService(db)


@router.get("/email-domain")
async def get_email_domain(
    current_user: dict = Depends(require_permission("integrations", "view")),
    service: EmailDomainService = Depends(get_email_domain_service),
) -> dict:
    record = await service.get_domain_for_user(current_user)
    return success_response(
        data=service.serialize(record),
        message="Business email domain fetched successfully.",
    )


@router.get("/email-domain/availability")
async def check_email_domain_availability(
    business_name: str = Query(min_length=1, max_length=120),
    current_user: dict = Depends(require_permission("integrations", "manage")),
    service: EmailDomainService = Depends(get_email_domain_service),
) -> dict:
    data = await service.check_availability(business_name)
    return success_response(data=data, message="Availability checked successfully.")


@router.post("/email-domain", status_code=status.HTTP_201_CREATED)
async def request_email_domain(
    payload: EmailDomainRequest,
    current_user: dict = Depends(require_permission("integrations", "manage")),
    service: EmailDomainService = Depends(get_email_domain_service),
) -> dict:
    data = await service.request_domain(
        current_user,
        business_name=payload.business_name,
        custom_domain=payload.custom_domain,
        from_name=payload.from_name,
        default_prefix=payload.default_prefix,
    )
    return success_response(data=data, message="Business email domain created successfully.")


@router.post("/email-domain/verify")
async def verify_email_domain(
    current_user: dict = Depends(require_permission("integrations", "manage")),
    service: EmailDomainService = Depends(get_email_domain_service),
) -> dict:
    data = await service.refresh_domain(current_user)
    return success_response(data=data, message="Business email domain status refreshed successfully.")


@router.patch("/email-domain")
async def update_email_domain(
    payload: EmailDomainSettingsUpdateRequest,
    current_user: dict = Depends(require_permission("integrations", "manage")),
    service: EmailDomainService = Depends(get_email_domain_service),
) -> dict:
    data = await service.update_domain_settings(
        current_user,
        from_name=payload.from_name,
        default_prefix=payload.default_prefix,
    )
    return success_response(data=data, message="Business email domain updated successfully.")


@router.delete("/email-domain", status_code=status.HTTP_200_OK)
async def delete_email_domain(
    current_user: dict = Depends(require_permission("integrations", "manage")),
    service: EmailDomainService = Depends(get_email_domain_service),
) -> dict:
    await service.delete_domain(current_user)
    return success_response(data=None, message="Business email domain removed successfully.")
