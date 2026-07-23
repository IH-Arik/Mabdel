from __future__ import annotations

import json

from fastapi import Depends, Header, Query, Request, Response, status
from fastapi.responses import HTMLResponse

from app.core.exceptions import AppException
from app.dependencies import require_permission
from app.schemas.smartflow import (
    AgreementCreateRequest,
    AgreementGenerateRequest,
    AgreementImproveRequest,
    AgreementRenewRequest,
    AgreementReviewRequest,
    AgreementSendSignatureRequest,
    AgreementSignRequest,
    AgreementUpdateRequest,
)
from app.services.smartflow_service import SmartFlowService
from app.utils.responses import success_response

from ._deps import get_smartflow_service
from ._router import router


@router.get("/agreements/metadata")
async def get_agreement_metadata(
    current_user: dict = Depends(require_permission("agreements", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    return success_response(data=service.agreement_metadata(), message="Agreement metadata fetched successfully.")


@router.get("/agreements/types")
async def get_agreement_types(
    current_user: dict = Depends(require_permission("agreements", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    return success_response(data=service.agreement_metadata()["types"], message="Agreement types fetched successfully.")


@router.get("/agreements/priorities")
async def get_agreement_priorities(
    current_user: dict = Depends(require_permission("agreements", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    return success_response(data=service.agreement_metadata()["priorities"], message="Agreement priorities fetched successfully.")


@router.post("/agreements/generate")
async def generate_agreement_draft(
    payload: AgreementGenerateRequest,
    current_user: dict = Depends(require_permission("agreements", "create")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.generate_agreement_draft(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Agreement draft generated successfully.")


@router.post("/agreements/improve")
async def improve_agreement_draft(
    payload: AgreementImproveRequest,
    current_user: dict = Depends(require_permission("agreements", "create")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.improve_agreement_draft(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Agreement draft improved successfully.")


@router.post("/agreements/review")
async def review_agreement_draft(
    payload: AgreementReviewRequest,
    current_user: dict = Depends(require_permission("agreements", "create")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.review_agreement_draft(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Agreement draft reviewed successfully.")


@router.get("/agreements/signing/{signature_token}")
async def get_public_signing_agreement(
    signature_token: str,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_public_signing_agreement(signature_token)
    return success_response(data=data, message="Signing agreement fetched successfully.")

@router.get("/agreements/signing/{signature_token}/pdf")
async def get_public_signing_agreement_pdf(
    signature_token: str,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Response:
    agreement = await service.get_public_signing_agreement(signature_token)
    pdf_bytes = await service.generate_public_agreement_pdf(signature_token)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{agreement["agreement_number"]}.pdf"'}
    )


@router.post("/agreements/signing/{signature_token}")
async def sign_public_agreement(
    signature_token: str,
    payload: AgreementSignRequest,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.sign_public_agreement(signature_token, payload.model_dump())
    return success_response(data=data, message="Agreement signed successfully.")


@router.get("/agreements/signature-providers/docusign/status")
async def get_docusign_status(
    current_user: dict = Depends(require_permission("agreements", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_docusign_status(str(current_user["_id"]))
    return success_response(data=data, message="DocuSign status fetched successfully.")


@router.get("/agreements/signature-providers/docusign/oauth/start")
async def start_docusign_oauth(
    current_user: dict = Depends(require_permission("agreements", "edit")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.start_docusign_oauth(str(current_user["_id"]))
    return success_response(data=data, message="DocuSign OAuth started successfully.")


@router.get("/agreements/signature-providers/docusign/oauth/callback", response_model=None)
async def complete_docusign_oauth(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    service: SmartFlowService = Depends(get_smartflow_service),
) -> HTMLResponse:
    if error:
        html = """
        <html><body style="font-family:Arial,sans-serif;background:#0b1220;color:#fff;padding:24px;">
        <h2>DocuSign connection was not completed.</h2>
        <p>You can close this window and try again.</p>
        <script>
          if (window.opener) { window.opener.postMessage({ type: 'mabdel-docusign-oauth', status: 'error' }, '*'); }
          window.close();
        </script>
        </body></html>
        """
        return HTMLResponse(content=html, status_code=200)
    if not code or not state:
        raise AppException(status_code=400, code="DOCUSIGN_OAUTH_CALLBACK_INVALID", message="DocuSign OAuth callback is missing required parameters.")
    await service.complete_docusign_oauth(code, state)
    html = """
    <html><body style="font-family:Arial,sans-serif;background:#0b1220;color:#fff;padding:24px;">
    <h2>DocuSign connected.</h2>
    <p>You can close this window.</p>
    <script>
      if (window.opener) { window.opener.postMessage({ type: 'mabdel-docusign-oauth', status: 'success' }, '*'); }
      window.close();
    </script>
    </body></html>
    """
    return HTMLResponse(content=html, status_code=200)


@router.post("/agreements/signature-providers/docusign/webhook")
async def handle_docusign_webhook(
    request: Request,
    x_docusign_signature_1: str | None = Header(default=None, alias="X-DocuSign-Signature-1"),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body)
    except Exception as exc:
        raise AppException(status_code=400, code="DOCUSIGN_WEBHOOK_PAYLOAD_INVALID", message="DocuSign webhook payload must be valid JSON.") from exc
    if not isinstance(payload, dict):
        raise AppException(status_code=400, code="DOCUSIGN_WEBHOOK_PAYLOAD_INVALID", message="DocuSign webhook payload must be a JSON object.")
    payload["_headers"] = {"X-DocuSign-Signature-1": x_docusign_signature_1}
    data = await service.handle_docusign_webhook(raw_body, payload)
    return success_response(data=data, message="DocuSign webhook processed successfully.")


@router.get("/agreements")
async def list_agreements(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    agreement_type: str | None = None,
    current_user: dict = Depends(require_permission("agreements", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.list_agreements(str(current_user["_id"]), page, page_size, search, status_filter, agreement_type)
    return success_response(data=data, message="Agreements fetched successfully.")


@router.post("/agreements", status_code=status.HTTP_201_CREATED)
async def create_agreement(
    payload: AgreementCreateRequest,
    current_user: dict = Depends(require_permission("agreements", "create")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.create_agreement(str(current_user["_id"]), payload.model_dump())
    return success_response(data=data, message="Agreement created successfully.")


@router.get("/agreements/{agreement_id}")
async def get_agreement(
    agreement_id: str,
    current_user: dict = Depends(require_permission("agreements", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.get_agreement(str(current_user["_id"]), agreement_id)
    return success_response(data=data, message="Agreement fetched successfully.")


@router.patch("/agreements/{agreement_id}")
async def update_agreement(
    agreement_id: str,
    payload: AgreementUpdateRequest,
    current_user: dict = Depends(require_permission("agreements", "edit")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.update_agreement(str(current_user["_id"]), agreement_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Agreement updated successfully.")


@router.delete("/agreements/{agreement_id}")
async def delete_agreement(
    agreement_id: str,
    current_user: dict = Depends(require_permission("agreements", "delete")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    await service.delete_agreement(str(current_user["_id"]), agreement_id)
    return success_response(data={"deleted": True, "agreement_id": agreement_id}, message="Agreement deleted successfully.")


@router.post("/agreements/{agreement_id}/improve")
async def improve_agreement(
    agreement_id: str,
    payload: AgreementImproveRequest,
    current_user: dict = Depends(require_permission("agreements", "edit")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.improve_agreement(str(current_user["_id"]), agreement_id, payload.model_dump())
    return success_response(data=data, message="Agreement improved successfully.")


@router.post("/agreements/{agreement_id}/review")
async def review_agreement(
    agreement_id: str,
    current_user: dict = Depends(require_permission("agreements", "edit")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.review_agreement(str(current_user["_id"]), agreement_id)
    return success_response(data=data, message="Agreement reviewed successfully.")


@router.post("/agreements/{agreement_id}/send-signature")
async def send_agreement_for_signature(
    agreement_id: str,
    payload: AgreementSendSignatureRequest,
    current_user: dict = Depends(require_permission("agreements", "edit")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.send_agreement_for_signature(str(current_user["_id"]), agreement_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Agreement sent for signature successfully.")


@router.post("/agreements/{agreement_id}/sign")
async def sign_agreement(
    agreement_id: str,
    payload: AgreementSignRequest,
    current_user: dict = Depends(require_permission("agreements", "edit")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.sign_agreement(str(current_user["_id"]), agreement_id, payload.model_dump())
    return success_response(data=data, message="Agreement signed successfully.")


@router.post("/agreements/{agreement_id}/renew")
async def renew_agreement(
    agreement_id: str,
    payload: AgreementRenewRequest,
    current_user: dict = Depends(require_permission("agreements", "edit")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> dict:
    data = await service.renew_agreement(str(current_user["_id"]), agreement_id, payload.model_dump(exclude_unset=True))
    return success_response(data=data, message="Agreement renewed successfully.")


@router.get("/agreements/{agreement_id}/pdf")
async def download_agreement_pdf(
    agreement_id: str,
    current_user: dict = Depends(require_permission("agreements", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Response:
    agreement = await service.get_agreement(str(current_user["_id"]), agreement_id)
    pdf_bytes = await service.generate_agreement_pdf(str(current_user["_id"]), agreement_id)
    filename = f'{agreement["agreement_number"]}.pdf'
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/agreements/{agreement_id}/signed-pdf")
async def download_signed_agreement_pdf(
    agreement_id: str,
    current_user: dict = Depends(require_permission("agreements", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Response:
    pdf_bytes, filename = await service.download_signed_agreement_pdf(str(current_user["_id"]), agreement_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/agreements/{agreement_id}/completion-certificate")
async def download_agreement_completion_certificate(
    agreement_id: str,
    current_user: dict = Depends(require_permission("agreements", "view")),
    service: SmartFlowService = Depends(get_smartflow_service),
) -> Response:
    pdf_bytes, filename = await service.download_agreement_completion_certificate(str(current_user["_id"]), agreement_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
