from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.exceptions import AppException
from app.services.media_storage_service import MediaStorageService
from app.utils.helpers import utc_now


class DocuSignAgreementService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.media = MediaStorageService()

    def is_configured(self) -> bool:
        return bool(settings.DOCUSIGN_CLIENT_ID and settings.DOCUSIGN_CLIENT_SECRET)

    def redirect_uri(self) -> str:
        return settings.DOCUSIGN_REDIRECT_URI or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/agreements/signature-providers/docusign/oauth/callback"

    def return_url(self) -> str:
        return settings.DOCUSIGN_RETURN_URL or f"{settings.PUBLIC_BACKEND_URL}/api/v1/smartflow/agreements"

    def auth_server(self) -> str:
        return settings.DOCUSIGN_AUTH_SERVER.rstrip("/")

    def _token_url(self) -> str:
        return f"{self.auth_server()}/oauth/token"

    def _userinfo_url(self) -> str:
        return f"{self.auth_server()}/oauth/userinfo"

    async def get_status(self, user_id: str) -> dict:
        connection = await self.db.agreement_provider_connections.find_one({"user_id": user_id, "provider": "docusign"})
        if not self.is_configured():
            return {
                "provider": "docusign",
                "connected": False,
                "connection_status": "misconfigured",
                "account_id": None,
                "account_name": None,
                "base_uri": None,
                "auth_url": None,
                "last_error": "DocuSign credentials are not configured on the backend.",
                "connected_at": None,
            }
        if not connection:
            return {
                "provider": "docusign",
                "connected": False,
                "connection_status": "disconnected",
                "account_id": None,
                "account_name": None,
                "base_uri": None,
                "auth_url": None,
                "last_error": None,
                "connected_at": None,
            }
        return {
            "provider": "docusign",
            "connected": connection.get("status") == "connected",
            "connection_status": connection.get("status") or "disconnected",
            "account_id": connection.get("account_id"),
            "account_name": connection.get("account_name"),
            "base_uri": connection.get("base_uri"),
            "auth_url": None,
            "last_error": connection.get("last_error"),
            "connected_at": connection.get("connected_at"),
        }

    async def start_oauth(self, user_id: str) -> dict:
        if not self.is_configured():
            raise AppException(status_code=503, code="DOCUSIGN_NOT_CONFIGURED", message="DocuSign is not configured on the backend.")
        state = secrets.token_urlsafe(24)
        expires_at = utc_now() + timedelta(minutes=10)
        await self.db.oauth_states.insert_one(
            {
                "user_id": user_id,
                "platform": "docusign_agreements",
                "provider": "docusign",
                "state": state,
                "expires_at": expires_at,
                "created_at": utc_now(),
            }
        )
        params = {
            "response_type": "code",
            "scope": "signature extended",
            "client_id": settings.DOCUSIGN_CLIENT_ID,
            "redirect_uri": self.redirect_uri(),
            "state": state,
        }
        return {
            "provider": "docusign",
            "auth_url": f"{self.auth_server()}/oauth/auth?{urlencode(params)}",
            "state": state,
            "expires_at": expires_at,
        }

    async def complete_oauth(self, code: str, state: str) -> dict:
        if not self.is_configured():
            raise AppException(status_code=503, code="DOCUSIGN_NOT_CONFIGURED", message="DocuSign is not configured on the backend.")
        state_doc = await self.db.oauth_states.find_one({"state": state, "provider": "docusign"})
        if not state_doc or state_doc.get("expires_at") < utc_now():
            raise AppException(status_code=400, code="DOCUSIGN_OAUTH_STATE_INVALID", message="DocuSign OAuth state is invalid or expired.")

        token_data = await self._exchange_authorization_code(code)
        account_context = await self._fetch_userinfo(token_data["access_token"])
        account = self._pick_account(account_context.get("accounts") or [])
        if not account:
            raise AppException(status_code=502, code="DOCUSIGN_ACCOUNT_MISSING", message="DocuSign did not return an account to use.")

        now = utc_now()
        await self.db.agreement_provider_connections.find_one_and_update(
            {"user_id": state_doc["user_id"], "provider": "docusign"},
            {
                "$set": {
                    "user_id": state_doc["user_id"],
                    "provider": "docusign",
                    "status": "connected",
                    "account_id": account.get("account_id"),
                    "account_name": account.get("account_name") or account.get("account_name_display") or account.get("account_id"),
                    "base_uri": str(account.get("base_uri") or "").rstrip("/"),
                    "auth_server": self.auth_server(),
                    "redirect_uri": self.redirect_uri(),
                    "environment": settings.DOCUSIGN_ENVIRONMENT,
                    "access_token_encrypted": encrypt_value(token_data["access_token"]),
                    "refresh_token_encrypted": encrypt_value(token_data["refresh_token"]) if token_data.get("refresh_token") else None,
                    "access_token_expires_at": now + timedelta(seconds=int(token_data.get("expires_in") or 3600)),
                    "granted_scopes": token_data.get("scope"),
                    "last_error": None,
                    "connected_at": now,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        await self.db.oauth_states.delete_one({"_id": state_doc["_id"]})
        return await self.get_status(state_doc["user_id"])

    async def get_access_token(self, user_id: str) -> tuple[str, dict]:
        connection = await self.ensure_connection(user_id)
        encrypted = connection.get("access_token_encrypted")
        if not encrypted:
            raise AppException(status_code=401, code="DOCUSIGN_ACCESS_TOKEN_MISSING", message="DocuSign access token is missing. Reconnect the account.")
        return decrypt_value(encrypted), connection

    async def ensure_connection(self, user_id: str) -> dict:
        if not self.is_configured():
            raise AppException(status_code=503, code="DOCUSIGN_NOT_CONFIGURED", message="DocuSign is not configured on the backend.")
        connection = await self.db.agreement_provider_connections.find_one({"user_id": user_id, "provider": "docusign"})
        if not connection or connection.get("status") not in {"connected", "needs_reauth"}:
            raise AppException(status_code=409, code="DOCUSIGN_NOT_CONNECTED", message="Connect DocuSign before sending agreements with DocuSign.")
        expires_at = connection.get("access_token_expires_at")
        if expires_at and expires_at <= utc_now() + timedelta(seconds=60):
            return await self._refresh_connection(connection)
        return connection

    async def create_envelope(self, *, user_id: str, agreement: dict, pdf_bytes: bytes, payload: dict) -> dict:
        access_token, connection = await self.get_access_token(user_id)
        signers = self._build_signers(agreement, payload)
        envelope_definition = {
            "emailSubject": f"Signature requested: {agreement['title']}",
            "emailBlurb": payload.get("message") or f"Please sign agreement {agreement['agreement_number']}.",
            "documents": [
                {
                    "documentBase64": base64.b64encode(pdf_bytes).decode("ascii"),
                    "name": f"{agreement['agreement_number']}.pdf",
                    "fileExtension": "pdf",
                    "documentId": "1",
                }
            ],
            "recipients": {"signers": signers},
            "status": "sent",
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{connection['base_uri']}/restapi/v2.1/accounts/{connection['account_id']}/envelopes",
                headers=self._auth_headers(access_token),
                json=envelope_definition,
            )
        if response.status_code >= 400:
            await self._mark_connection_error(connection["_id"], f"DocuSign envelope create failed ({response.status_code}).")
            raise AppException(
                status_code=502,
                code="DOCUSIGN_ENVELOPE_CREATE_FAILED",
                message="DocuSign could not create the envelope.",
                details={"provider_status": response.status_code, "response": response.text[:500]},
            )
        data = response.json()
        envelope_id = data.get("envelopeId")
        if not envelope_id:
            raise AppException(status_code=502, code="DOCUSIGN_ENVELOPE_ID_MISSING", message="DocuSign did not return an envelope ID.")

        result: dict[str, Any] = {
            "signature_provider": "docusign",
            "provider_status": data.get("status") or "sent",
            "envelope_id": envelope_id,
            "account_id": connection["account_id"],
            "base_uri": connection["base_uri"],
            "recipients": [
                {
                    "name": signer["name"],
                    "email": signer["email"],
                    "recipient_id": signer["recipientId"],
                    "routing_order": signer["routingOrder"],
                    "client_user_id": signer.get("clientUserId"),
                }
                for signer in signers
            ],
            "sent_at": utc_now(),
            "connected_account_name": connection.get("account_name"),
            "last_error": None,
            "status_updated_at": utc_now(),
        }

        if payload.get("embedded_signing"):
            signing_url = await self.create_recipient_view(
                access_token=access_token,
                connection=connection,
                envelope_id=envelope_id,
                signer=signers[0],
                return_url=payload.get("return_url") or self.return_url(),
            )
            result["recipient_view_url"] = signing_url

        return result

    async def create_recipient_view(self, *, access_token: str, connection: dict, envelope_id: str, signer: dict, return_url: str) -> str:
        payload = {
            "authenticationMethod": "none",
            "clientUserId": signer["clientUserId"],
            "email": signer["email"],
            "userName": signer["name"],
            "recipientId": signer["recipientId"],
            "returnUrl": return_url,
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{connection['base_uri']}/restapi/v2.1/accounts/{connection['account_id']}/envelopes/{envelope_id}/views/recipient",
                headers=self._auth_headers(access_token),
                json=payload,
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="DOCUSIGN_RECIPIENT_VIEW_FAILED",
                message="DocuSign could not create the embedded signing view.",
                details={"provider_status": response.status_code, "response": response.text[:500]},
            )
        return response.json().get("url") or ""

    async def refresh_agreement(self, user_id: str, agreement: dict) -> dict:
        docusign = agreement.get("docusign") or {}
        envelope_id = docusign.get("envelope_id")
        if not envelope_id:
            return agreement
        access_token, connection = await self.get_access_token(user_id)
        envelope = await self._fetch_envelope(access_token, connection, envelope_id)
        recipients = await self._fetch_recipients(access_token, connection, envelope_id)
        updates = self._map_envelope_to_updates(envelope, recipients)
        updated = await self.db.agreements.find_one_and_update(
            {"_id": agreement["_id"]},
            {
                "$set": {
                    "status": updates["agreement_status"],
                    "updated_at": utc_now(),
                    "signed_at": updates.get("signed_at"),
                    "docusign.provider_status": updates["provider_status"],
                    "docusign.recipients": updates["recipients"],
                    "docusign.status_updated_at": utc_now(),
                    "docusign.last_error": None,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        latest = updated or agreement
        if updates["agreement_status"] == "signed":
            await self._ensure_completed_documents(access_token, connection, latest, envelope_id)
            refreshed = await self.db.agreements.find_one({"_id": agreement["_id"]})
            return refreshed or latest
        return latest

    async def handle_webhook(self, raw_body: bytes, payload: dict) -> dict:
        self.validate_connect_hmac(raw_body, payload)
        envelope_id = self._extract_envelope_id(payload)
        if not envelope_id:
            raise AppException(status_code=400, code="DOCUSIGN_WEBHOOK_ENVELOPE_MISSING", message="DocuSign webhook did not include an envelope ID.")
        agreement = await self.db.agreements.find_one({"docusign.envelope_id": envelope_id})
        if not agreement:
            return {"processed": False, "reason": "envelope_not_tracked", "envelope_id": envelope_id}
        event_id = self._event_id(payload, envelope_id)
        existing = await self.db.processed_webhooks.find_one({"platform": "docusign", "event_id": event_id})
        if existing:
            return {"processed": False, "reason": "duplicate_event", "envelope_id": envelope_id}
        await self.db.processed_webhooks.insert_one(
            {
                "platform": "docusign",
                "event_id": event_id,
                "user_id": agreement["user_id"],
                "raw_payload": payload,
                "created_at": utc_now(),
            }
        )
        refreshed = await self.refresh_agreement(agreement["user_id"], agreement)
        provider_status = ((refreshed.get("docusign") or {}).get("provider_status")) if refreshed else None
        await self.db.agreement_provider_events.insert_one(
            {
                "user_id": agreement["user_id"],
                "agreement_id": str(agreement["_id"]),
                "provider": "docusign",
                "envelope_id": envelope_id,
                "event_type": self._extract_event_type(payload, provider_status),
                "payload": payload,
                "created_at": utc_now(),
            }
        )
        return {"processed": True, "envelope_id": envelope_id, "provider_status": provider_status}

    async def download_signed_pdf(self, user_id: str, agreement: dict) -> tuple[bytes, str]:
        docusign = agreement.get("docusign") or {}
        if docusign.get("signed_pdf_storage_path"):
            path = docusign["signed_pdf_storage_path"]
            return open(path, "rb").read(), f'{agreement["agreement_number"]}-signed.pdf'
        if docusign.get("envelope_id"):
            access_token, connection = await self.get_access_token(user_id)
            await self._ensure_completed_documents(access_token, connection, agreement, docusign["envelope_id"])
            refreshed = await self.db.agreements.find_one({"_id": agreement["_id"]})
            if refreshed and (refreshed.get("docusign") or {}).get("signed_pdf_storage_path"):
                path = refreshed["docusign"]["signed_pdf_storage_path"]
                return open(path, "rb").read(), f'{agreement["agreement_number"]}-signed.pdf'
        raise AppException(status_code=404, code="DOCUSIGN_SIGNED_PDF_NOT_FOUND", message="Signed DocuSign PDF is not available yet.")

    async def download_certificate(self, user_id: str, agreement: dict) -> tuple[bytes, str]:
        docusign = agreement.get("docusign") or {}
        if docusign.get("certificate_storage_path"):
            path = docusign["certificate_storage_path"]
            return open(path, "rb").read(), f'{agreement["agreement_number"]}-certificate.pdf'
        if docusign.get("envelope_id"):
            access_token, connection = await self.get_access_token(user_id)
            await self._ensure_completed_documents(access_token, connection, agreement, docusign["envelope_id"])
            refreshed = await self.db.agreements.find_one({"_id": agreement["_id"]})
            if refreshed and (refreshed.get("docusign") or {}).get("certificate_storage_path"):
                path = refreshed["docusign"]["certificate_storage_path"]
                return open(path, "rb").read(), f'{agreement["agreement_number"]}-certificate.pdf'
        raise AppException(status_code=404, code="DOCUSIGN_CERTIFICATE_NOT_FOUND", message="DocuSign completion certificate is not available yet.")

    async def _exchange_authorization_code(self, code: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self._token_url(),
                data={"grant_type": "authorization_code", "code": code, "redirect_uri": self.redirect_uri()},
                headers={"Accept": "application/json", "Authorization": self._basic_auth_header()},
            )
        if response.status_code >= 400:
            raise AppException(
                status_code=502,
                code="DOCUSIGN_TOKEN_EXCHANGE_FAILED",
                message="DocuSign token exchange failed.",
                details={"provider_status": response.status_code, "response": response.text[:500]},
            )
        return response.json()

    async def _refresh_connection(self, connection: dict) -> dict:
        refresh_token_encrypted = connection.get("refresh_token_encrypted")
        if not refresh_token_encrypted:
            await self._mark_connection_error(connection["_id"], "DocuSign refresh token is missing. Reconnect the account.", status="needs_reauth")
            raise AppException(status_code=401, code="DOCUSIGN_REFRESH_TOKEN_MISSING", message="Reconnect DocuSign to continue.")
        refresh_token = decrypt_value(refresh_token_encrypted)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self._token_url(),
                data={"grant_type": "refresh_token", "refresh_token": refresh_token},
                headers={"Accept": "application/json", "Authorization": self._basic_auth_header()},
            )
        if response.status_code >= 400:
            await self._mark_connection_error(connection["_id"], "DocuSign refresh token was rejected. Reconnect the account.", status="needs_reauth")
            raise AppException(status_code=401, code="DOCUSIGN_TOKEN_REFRESH_FAILED", message="DocuSign access expired. Reconnect the account.")
        token_data = response.json()
        updated = await self.db.agreement_provider_connections.find_one_and_update(
            {"_id": connection["_id"]},
            {
                "$set": {
                    "status": "connected",
                    "access_token_encrypted": encrypt_value(token_data["access_token"]),
                    "refresh_token_encrypted": encrypt_value(token_data["refresh_token"]) if token_data.get("refresh_token") else connection.get("refresh_token_encrypted"),
                    "access_token_expires_at": utc_now() + timedelta(seconds=int(token_data.get("expires_in") or 3600)),
                    "granted_scopes": token_data.get("scope"),
                    "last_error": None,
                    "updated_at": utc_now(),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return updated or connection

    async def _fetch_userinfo(self, access_token: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(self._userinfo_url(), headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"})
        if response.status_code >= 400:
            raise AppException(status_code=502, code="DOCUSIGN_USERINFO_FAILED", message="DocuSign account details could not be loaded.")
        return response.json()

    def _pick_account(self, accounts: list[dict]) -> dict | None:
        if settings.DOCUSIGN_ACCOUNT_ID:
            matched = next((item for item in accounts if item.get("account_id") == settings.DOCUSIGN_ACCOUNT_ID), None)
            if matched:
                return matched
        default = next((item for item in accounts if item.get("is_default")), None)
        return default or (accounts[0] if accounts else None)

    def _build_signers(self, agreement: dict, payload: dict) -> list[dict]:
        supplied = payload.get("signers") or []
        if supplied:
            signers = []
            for index, item in enumerate(supplied, start=1):
                name = str(item.get("name") or "").strip()
                email = str(item.get("email") or "").strip()
                if not name or not email:
                    raise AppException(status_code=422, code="DOCUSIGN_SIGNER_INVALID", message="Each DocuSign signer must include a name and email.")
                routing_order = int(item.get("signing_order") or index)
                signers.append(self._make_signer(name=name, email=email, recipient_id=index, routing_order=routing_order, embedded=bool(payload.get("embedded_signing") and index == 1)))
            return signers
        name = str(payload.get("signer_name") or payload.get("recipient_name") or agreement.get("client_name") or "").strip()
        email = str(payload.get("signer_email") or payload.get("recipient_email") or agreement.get("client_email") or "").strip()
        if not name or not email:
            raise AppException(status_code=422, code="DOCUSIGN_RECIPIENT_REQUIRED", message="Signer name and signer email are required for DocuSign.")
        return [self._make_signer(name=name, email=email, recipient_id=1, routing_order=int(payload.get("signing_order") or 1), embedded=bool(payload.get("embedded_signing")))]

    def _make_signer(self, *, name: str, email: str, recipient_id: int, routing_order: int, embedded: bool) -> dict:
        signer: dict[str, Any] = {
            "name": name,
            "email": email,
            "recipientId": str(recipient_id),
            "routingOrder": str(routing_order),
            "tabs": {
                "signHereTabs": [{"documentId": "1", "pageNumber": "1", "xPosition": "420", "yPosition": str(650 + (recipient_id - 1) * 70)}],
                "dateSignedTabs": [{"documentId": "1", "pageNumber": "1", "xPosition": "420", "yPosition": str(685 + (recipient_id - 1) * 70)}],
                "nameTabs": [{"documentId": "1", "pageNumber": "1", "xPosition": "60", "yPosition": str(650 + (recipient_id - 1) * 70), "value": name, "locked": "true"}],
            },
        }
        if embedded:
            signer["clientUserId"] = f"mabdel-{recipient_id}"
        return signer

    async def _fetch_envelope(self, access_token: str, connection: dict, envelope_id: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{connection['base_uri']}/restapi/v2.1/accounts/{connection['account_id']}/envelopes/{envelope_id}",
                headers=self._auth_headers(access_token),
            )
        if response.status_code >= 400:
            raise AppException(status_code=502, code="DOCUSIGN_ENVELOPE_FETCH_FAILED", message="DocuSign envelope status could not be loaded.")
        return response.json()

    async def _fetch_recipients(self, access_token: str, connection: dict, envelope_id: str) -> list[dict]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{connection['base_uri']}/restapi/v2.1/accounts/{connection['account_id']}/envelopes/{envelope_id}/recipients",
                headers=self._auth_headers(access_token),
            )
        if response.status_code >= 400:
            return []
        return response.json().get("signers") or []

    def _map_envelope_to_updates(self, envelope: dict, recipients: list[dict]) -> dict:
        provider_status = str(envelope.get("status") or "").lower()
        if provider_status == "completed":
            agreement_status = "signed"
        elif provider_status in {"declined", "voided"}:
            agreement_status = "cancelled"
        elif provider_status == "expired":
            agreement_status = "expired"
        else:
            agreement_status = "pending_signature"
        return {
            "provider_status": provider_status or "sent",
            "agreement_status": agreement_status,
            "signed_at": utc_now() if agreement_status == "signed" else None,
            "recipients": [
                {
                    "recipient_id": item.get("recipientId"),
                    "name": item.get("name"),
                    "email": item.get("email"),
                    "status": item.get("status"),
                    "delivered_date_time": item.get("deliveredDateTime"),
                    "signed_date_time": item.get("signedDateTime"),
                    "declined_date_time": item.get("declinedDateTime"),
                }
                for item in recipients
            ],
        }

    async def _ensure_completed_documents(self, access_token: str, connection: dict, agreement: dict, envelope_id: str) -> None:
        docusign = agreement.get("docusign") or {}
        if docusign.get("signed_pdf_storage_path") and docusign.get("certificate_storage_path"):
            return
        async with httpx.AsyncClient(timeout=60.0) as client:
            envelope_res = await client.get(
                f"{connection['base_uri']}/restapi/v2.1/accounts/{connection['account_id']}/envelopes/{envelope_id}",
                headers=self._auth_headers(access_token),
            )
            if envelope_res.status_code >= 400:
                raise AppException(status_code=502, code="DOCUSIGN_ENVELOPE_FETCH_FAILED", message="DocuSign envelope status could not be loaded.")
            if str(envelope_res.json().get("status") or "").lower() != "completed":
                return
            docs_res = await client.get(
                f"{connection['base_uri']}/restapi/v2.1/accounts/{connection['account_id']}/envelopes/{envelope_id}/documents/combined",
                headers=self._auth_headers(access_token),
            )
            cert_res = await client.get(
                f"{connection['base_uri']}/restapi/v2.1/accounts/{connection['account_id']}/envelopes/{envelope_id}/documents/certificate",
                headers=self._auth_headers(access_token),
            )
        if docs_res.status_code >= 400:
            raise AppException(status_code=502, code="DOCUSIGN_SIGNED_PDF_FETCH_FAILED", message="DocuSign signed PDF could not be downloaded.")
        signed_media = self.media.store_file(
            owner_id=agreement["user_id"],
            folder="agreement_signed_pdfs",
            file_bytes=docs_res.content,
            content_type="application/pdf",
            filename=f"{agreement['agreement_number']}-signed.pdf",
            label="Signed agreement PDF",
        )
        update_set: dict[str, Any] = {
            "status": "signed",
            "signed_at": utc_now(),
            "updated_at": utc_now(),
            "docusign.provider_status": "completed",
            "docusign.signed_pdf_public_path": signed_media.public_path,
            "docusign.signed_pdf_storage_path": str(signed_media.storage_path),
            "docusign.last_error": None,
            "docusign.status_updated_at": utc_now(),
        }
        if cert_res.status_code < 400 and cert_res.content:
            cert_media = self.media.store_file(
                owner_id=agreement["user_id"],
                folder="agreement_signed_certificates",
                file_bytes=cert_res.content,
                content_type="application/pdf",
                filename=f"{agreement['agreement_number']}-certificate.pdf",
                label="Completion certificate",
            )
            update_set["docusign.certificate_public_path"] = cert_media.public_path
            update_set["docusign.certificate_storage_path"] = str(cert_media.storage_path)
        await self.db.agreements.update_one({"_id": agreement["_id"]}, {"$set": update_set})

    def validate_connect_hmac(self, raw_body: bytes, payload: dict) -> None:
        secret = settings.DOCUSIGN_CONNECT_SECRET
        if not secret:
            return
        provided = (payload.get("_headers", {}) or {}).get("X-DocuSign-Signature-1")
        if not provided:
            raise AppException(status_code=401, code="DOCUSIGN_WEBHOOK_SIGNATURE_MISSING", message="DocuSign webhook signature is missing.")
        expected = base64.b64encode(hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()).decode("ascii")
        if not hmac.compare_digest(expected, str(provided).strip()):
            raise AppException(status_code=401, code="DOCUSIGN_WEBHOOK_SIGNATURE_INVALID", message="DocuSign webhook signature is invalid.")

    @staticmethod
    def _extract_envelope_id(payload: dict) -> str | None:
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        summary = data.get("envelopeSummary") if isinstance(data.get("envelopeSummary"), dict) else {}
        return payload.get("envelopeId") or data.get("envelopeId") or summary.get("envelopeId")

    @staticmethod
    def _extract_event_type(payload: dict, provider_status: str | None) -> str:
        return str(payload.get("event") or payload.get("eventType") or provider_status or "unknown")

    @staticmethod
    def _event_id(payload: dict, envelope_id: str) -> str:
        seed = payload.get("eventId") or payload.get("configId") or payload.get("retryCount")
        return str(seed or f"{envelope_id}:{json.dumps(payload, sort_keys=True, default=str)}")

    async def _mark_connection_error(self, connection_id: ObjectId, message: str, *, status: str = "error") -> None:
        await self.db.agreement_provider_connections.update_one(
            {"_id": connection_id},
            {"$set": {"status": status, "last_error": message, "updated_at": utc_now()}},
        )

    def _basic_auth_header(self) -> str:
        raw = f"{settings.DOCUSIGN_CLIENT_ID}:{settings.DOCUSIGN_CLIENT_SECRET}".encode("utf-8")
        return "Basic " + base64.b64encode(raw).decode("ascii")

    @staticmethod
    def _auth_headers(access_token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {access_token}", "Accept": "application/json", "Content-Type": "application/json"}
