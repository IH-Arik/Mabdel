from __future__ import annotations

from fastapi import Depends, Query, Response, status

from app.dependencies import get_current_user
from app.schemas.smartflow import (
    AgreementSendSignatureRequest,
    AgreementSignRequest,
    LeaseCreateRequest,
    LeaseEnhanceTermsRequest,
    LeaseGenerateRequest,
    LeaseRenewRequest,
    LeaseReviewRequest,
    LeaseUpdateRequest,
)
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.get("/leases/metadata")
async def get_lease_metadata(
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    return success_response(data=service.lease_metadata(), message="Lease metadata fetched successfully.")


@router.post("/leases/generate")
async def generate_lease_draft(
    payload: LeaseGenerateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.generate_lease_draft(str(current_user["_id"]), payload.model_dump(exclude_none=True))
    return success_response(data=data, message="Lease draft generated successfully.")


@router.post("/leases/enhance-terms")
async def enhance_lease_terms(
    payload: LeaseEnhanceTermsRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.enhance_lease_terms(str(current_user["_id"]), payload.model_dump(exclude_none=True))
    return success_response(data=data, message="Lease terms enhanced successfully.")


@router.post("/leases/review")
async def review_lease_draft(
    payload: LeaseReviewRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.review_lease_draft(str(current_user["_id"]), payload.model_dump(exclude_none=True))
    return success_response(data=data, message="Lease draft reviewed successfully.")


@router.get("/leases/signing/{signature_token}")
async def get_public_signing_lease(
    signature_token: str,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_public_signing_lease(signature_token)
    return success_response(data=data, message="Signing lease fetched successfully.")

@router.get("/leases/signing/{signature_token}/pdf")
async def get_public_signing_lease_pdf(
    signature_token: str,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Response:
    pdf_bytes = await service.generate_public_lease_pdf(signature_token)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="lease.pdf"'}
    )


@router.post("/leases/signing/{signature_token}")
async def sign_public_lease(
    signature_token: str,
    payload: AgreementSignRequest,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.sign_public_lease(signature_token, payload.model_dump())
    return success_response(data=data, message="Lease signed successfully.")


@router.get("/leases")
async def list_leases(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_leases(str(current_user["_id"]), page, page_size, search, status_filter)
    return success_response(data=data, message="Leases fetched successfully.")


@router.post("/leases", status_code=status.HTTP_201_CREATED)
async def create_lease(
    payload: LeaseCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_lease(str(current_user["_id"]), payload.model_dump(exclude_none=True))
    return success_response(data=data, message="Lease created successfully.")


@router.get("/leases/{lease_id}")
async def get_lease(
    lease_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_lease(str(current_user["_id"]), lease_id)
    return success_response(data=data, message="Lease fetched successfully.")


@router.patch("/leases/{lease_id}")
async def update_lease(
    lease_id: str,
    payload: LeaseUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_lease(str(current_user["_id"]), lease_id, payload.model_dump(exclude_unset=True, exclude_none=True))
    return success_response(data=data, message="Lease updated successfully.")


@router.delete("/leases/{lease_id}")
async def delete_lease(
    lease_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_lease(str(current_user["_id"]), lease_id)
    return success_response(data={"deleted": True, "lease_id": lease_id}, message="Lease deleted successfully.")


@router.post("/leases/{lease_id}/review")
async def review_lease(
    lease_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.review_lease(str(current_user["_id"]), lease_id)
    return success_response(data=data, message="Lease reviewed successfully.")


@router.post("/leases/{lease_id}/enhance-terms")
async def enhance_saved_lease_terms(
    lease_id: str,
    payload: LeaseEnhanceTermsRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.enhance_saved_lease_terms(str(current_user["_id"]), lease_id, payload.model_dump(exclude_none=True))
    return success_response(data=data, message="Lease terms enhanced successfully.")


@router.post("/leases/{lease_id}/send-signature")
async def send_lease_for_signature(
    lease_id: str,
    payload: AgreementSendSignatureRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.send_lease_for_signature(str(current_user["_id"]), lease_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Lease sent for signature successfully.")


@router.post("/leases/{lease_id}/sign")
async def sign_lease(
    lease_id: str,
    payload: AgreementSignRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.sign_lease(str(current_user["_id"]), lease_id, payload.model_dump())
    return success_response(data=data, message="Lease signed successfully.")


@router.post("/leases/{lease_id}/renew")
async def renew_lease(
    lease_id: str,
    payload: LeaseRenewRequest,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.renew_lease(str(current_user["_id"]), lease_id, payload.model_dump(exclude_unset=True, exclude_none=True))
    return success_response(data=data, message="Lease renewed successfully.")


@router.get("/leases/{lease_id}/pdf")
async def download_lease_pdf(
    lease_id: str,
    current_user: dict = Depends(get_current_user),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Response:
    pdf_bytes = await service.generate_lease_pdf(str(current_user["_id"]), lease_id)
    filename = f"lease-{lease_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
