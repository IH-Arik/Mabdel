from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies import get_current_user, get_mongo_database
from app.schemas.invoice import (
    InvoiceCreateRequest,
    InvoiceReminderRequest,
    InvoiceSendRequest,
    InvoiceShareRequest,
    InvoiceStatusUpdateRequest,
    InvoiceUpdateRequest,
)
from app.services.email_service import EmailService
from app.services.invoice_service import InvoiceService
from app.utils.responses import success_response

router = APIRouter(prefix="/invoices", tags=["Invoices"])


def get_invoice_service(db: AsyncIOMotorDatabase = Depends(get_mongo_database)) -> InvoiceService:
    return InvoiceService(db=db, email_service=EmailService())


@router.get("")
async def list_invoices(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    current_user: dict = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> dict:
    result = await service.list_invoices(str(current_user["_id"]), page=page, page_size=page_size, search=search, status=status_filter)
    return success_response(data=result.model_dump(), message="Invoices fetched successfully.")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: InvoiceCreateRequest,
    current_user: dict = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> dict:
    result = await service.create_invoice(payload, owner_user_id=str(current_user["_id"]))
    return success_response(data=result.model_dump(), message="Invoice created successfully.")


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> dict:
    result = await service.get_invoice(str(current_user["_id"]), invoice_id)
    return success_response(data=result.model_dump(), message="Invoice fetched successfully.")


@router.patch("/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    payload: InvoiceUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> dict:
    result = await service.update_invoice(str(current_user["_id"]), invoice_id, payload)
    return success_response(data=result.model_dump(), message="Invoice updated successfully.")


@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> dict:
    result = await service.delete_invoice(str(current_user["_id"]), invoice_id)
    return success_response(data=result.model_dump(), message="Invoice deleted successfully.")


@router.post("/{invoice_id}/send")
async def send_invoice(
    invoice_id: str,
    payload: InvoiceSendRequest,
    current_user: dict = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> dict:
    result = await service.send_invoice(str(current_user["_id"]), invoice_id, payload)
    return success_response(data=result.model_dump(), message="Invoice sent successfully.")


@router.post("/{invoice_id}/share")
async def share_invoice(
    invoice_id: str,
    payload: InvoiceShareRequest,
    current_user: dict = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> dict:
    result = await service.share_invoice(str(current_user["_id"]), invoice_id, payload)
    return success_response(data=result.model_dump(), message="Invoice shared successfully.")


@router.post("/{invoice_id}/remind")
async def send_invoice_reminder(
    invoice_id: str,
    payload: InvoiceReminderRequest,
    current_user: dict = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> dict:
    result = await service.send_reminder(str(current_user["_id"]), invoice_id, payload)
    return success_response(data=result.model_dump(), message="Invoice reminder sent successfully.")


@router.post("/{invoice_id}/status")
async def update_invoice_status(
    invoice_id: str,
    payload: InvoiceStatusUpdateRequest,
    current_user: dict = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> dict:
    result = await service.update_invoice_status(str(current_user["_id"]), invoice_id, payload)
    return success_response(data=result.model_dump(), message="Invoice status updated successfully.")


@router.get("/{invoice_id}/timeline")
async def get_invoice_timeline(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> dict:
    result = await service.list_timeline(str(current_user["_id"]), invoice_id)
    return success_response(data=[item.model_dump() for item in result], message="Invoice timeline fetched successfully.")


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: str,
    current_user: dict = Depends(get_current_user),
    service: InvoiceService = Depends(get_invoice_service),
) -> Response:
    pdf_bytes = await service.generate_pdf(str(current_user["_id"]), invoice_id)
    filename = f"invoice-{invoice_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/shared/{share_token}/pdf")
async def download_shared_invoice_pdf(
    share_token: str,
    service: InvoiceService = Depends(get_invoice_service),
) -> Response:
    pdf_bytes = await service.generate_shared_pdf(share_token)
    return Response(content=pdf_bytes, media_type="application/pdf")
