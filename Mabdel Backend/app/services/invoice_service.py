from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO
import secrets

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.core.config import settings
from app.core.exceptions import AppException
from app.schemas.invoice import (
    InvoiceCreateRequest,
    InvoiceDeleteResponse,
    InvoiceLineItemResponse,
    InvoiceListItemResponse,
    InvoiceListResponse,
    InvoiceReminderRequest,
    InvoiceResponse,
    InvoiceSendRequest,
    InvoiceShareRequest,
    InvoiceShareResponse,
    InvoiceStatusUpdateRequest,
    InvoiceSummaryResponse,
    InvoiceTimelineEventResponse,
    InvoiceUpdateRequest,
)
from app.schemas.pagination import PaginationMeta
from app.services.email_service import EmailService


class InvoiceService:
    def __init__(self, db: AsyncIOMotorDatabase, email_service: EmailService | None = None) -> None:
        self.db = db
        self.email_service = email_service or EmailService()

    async def create_invoice(self, payload: InvoiceCreateRequest, owner_user_id: str) -> InvoiceResponse:
        issue_date = payload.issue_date or date.today()
        due_date = payload.due_date or (issue_date + timedelta(days=14))
        if due_date < issue_date:
            raise AppException(status_code=400, code="INVALID_DUE_DATE", message="Due date cannot be earlier than issue date.")

        subtotal, tax_amount, total_amount = self._compute_totals(payload.items, payload.tax_rate)
        invoice_seq = await self._next_sequence("invoice_sequence")
        invoice_number = self._invoice_number(invoice_seq, issue_date)
        now = self._utc_now()
        items = [self._item_to_document(item, idx) for idx, item in enumerate(payload.items)]
        invoice = {
            "owner_user_id": owner_user_id,
            "invoice_seq": invoice_seq,
            "invoice_number": invoice_number,
            "client_name": payload.client_name.strip(),
            "client_email": str(payload.client_email) if payload.client_email else None,
            "billing_address": payload.billing_address.strip() if payload.billing_address else None,
            "currency": payload.currency.upper(),
            "issue_date": issue_date.isoformat(),
            "due_date": due_date.isoformat(),
            "subtotal": subtotal,
            "tax_rate": round(float(payload.tax_rate), 2),
            "tax_amount": tax_amount,
            "total_amount": total_amount,
            "notes": payload.notes.strip() if payload.notes else None,
            "status": "draft",
            "sent_at": None,
            "viewed_at": None,
            "paid_at": None,
            "items": items,
            "timeline": [],
            "created_at": now,
            "updated_at": now,
        }
        self._append_event(invoice, "created", "Invoice created", "System generated")
        result = await self.db.invoices.insert_one(invoice)
        invoice["_id"] = result.inserted_id
        await self._log_history(
            owner_user_id,
            command_text=f"Create invoice for {invoice['currency']} {invoice['total_amount']:.2f}",
            status="completed",
            invoice=invoice,
            preview_payload={"total_amount": invoice["total_amount"], "client_name": invoice["client_name"]},
        )
        return self._serialize_invoice(invoice)

    async def list_invoices(
        self,
        owner_user_id: str,
        *,
        page: int,
        page_size: int,
        search: str | None = None,
        status: str | None = None,
    ) -> InvoiceListResponse:
        all_invoices = await self.db.invoices.find({"owner_user_id": owner_user_id}).sort("created_at", -1).to_list(length=1000)
        filtered = [invoice for invoice in all_invoices if self._matches_search(invoice, search) and self._matches_status(invoice, status)]
        total = len(filtered)
        slice_start = (page - 1) * page_size
        items = [self._serialize_list_item(invoice) for invoice in filtered[slice_start : slice_start + page_size]]
        summary = self._build_summary(all_invoices)
        return InvoiceListResponse(items=items, pagination=PaginationMeta(page=page, page_size=page_size, total=total), summary=summary)

    async def get_invoice(self, owner_user_id: str, invoice_id: str) -> InvoiceResponse:
        invoice = await self._load_invoice(owner_user_id, invoice_id)
        return self._serialize_invoice(invoice)

    async def update_invoice(self, owner_user_id: str, invoice_id: str, payload: InvoiceUpdateRequest) -> InvoiceResponse:
        invoice = await self._load_invoice(owner_user_id, invoice_id)
        self._ensure_editable(invoice)
        fields = payload.model_fields_set

        if "client_name" in fields and payload.client_name is not None:
            invoice["client_name"] = payload.client_name.strip()
        if "client_email" in fields:
            invoice["client_email"] = str(payload.client_email) if payload.client_email else None
        if "billing_address" in fields:
            invoice["billing_address"] = payload.billing_address.strip() if payload.billing_address else None
        if "currency" in fields and payload.currency is not None:
            invoice["currency"] = payload.currency.upper()
        if "issue_date" in fields and payload.issue_date is not None:
            invoice["issue_date"] = payload.issue_date.isoformat()
        if "due_date" in fields and payload.due_date is not None:
            invoice["due_date"] = payload.due_date.isoformat()
        if date.fromisoformat(invoice["due_date"]) < date.fromisoformat(invoice["issue_date"]):
            raise AppException(status_code=400, code="INVALID_DUE_DATE", message="Due date cannot be earlier than issue date.")
        if "tax_rate" in fields and payload.tax_rate is not None:
            invoice["tax_rate"] = round(float(payload.tax_rate), 2)
        if "notes" in fields:
            invoice["notes"] = payload.notes.strip() if payload.notes else None
        if "items" in fields and payload.items is not None:
            invoice["items"] = [self._item_to_document(item, idx) for idx, item in enumerate(payload.items)]

        subtotal, tax_amount, total_amount = self._compute_totals(invoice["items"], invoice.get("tax_rate", 0))
        invoice["subtotal"] = subtotal
        invoice["tax_amount"] = tax_amount
        invoice["total_amount"] = total_amount
        if "status" in fields and payload.status is not None:
            self._set_status(invoice, payload.status, "Invoice updated by operator")
        self._append_event(invoice, "updated", "Invoice updated", "Invoice details changed")
        invoice["updated_at"] = self._utc_now()
        await self.db.invoices.replace_one({"_id": invoice["_id"]}, invoice)
        await self._log_history(
            owner_user_id,
            command_text=f"Update invoice {invoice['invoice_number']}",
            status="completed",
            invoice=invoice,
        )
        return self._serialize_invoice(invoice)

    async def delete_invoice(self, owner_user_id: str, invoice_id: str) -> InvoiceDeleteResponse:
        invoice = await self._load_invoice(owner_user_id, invoice_id)
        await self.db.invoices.delete_one({"_id": invoice["_id"]})
        await self._log_history(
            owner_user_id,
            command_text=f"Delete invoice {invoice['invoice_number']}",
            status="archived",
            invoice=invoice,
        )
        return InvoiceDeleteResponse(invoice_id=int(invoice["invoice_seq"]), deleted=True)

    async def send_invoice(self, owner_user_id: str, invoice_id: str, payload: InvoiceSendRequest) -> InvoiceResponse:
        invoice = await self._load_invoice(owner_user_id, invoice_id)
        recipient = str(payload.recipient_email) if payload.recipient_email else invoice.get("client_email")
        if payload.channel == "email" and not recipient:
            raise AppException(status_code=400, code="CLIENT_EMAIL_REQUIRED", message="Recipient email is required to send the invoice.")
        if payload.channel == "email":
            await self.email_service.send_invoice_email(
                email=recipient,
                subject=f"Invoice {invoice['invoice_number']} from Mabdel AI",
                text=self._invoice_email_text(invoice, payload.message),
                html=self._invoice_email_html(invoice, payload.message),
            )
        if not invoice.get("share_token"):
            invoice["share_token"] = secrets.token_urlsafe(18)
        invoice["sent_at"] = self._utc_now()
        invoice["status"] = "sent"
        self._append_event(invoice, "sent", "Sent to client", payload.message or "Invoice sent to client", channel=payload.channel)
        invoice["updated_at"] = self._utc_now()
        await self.db.invoices.replace_one({"_id": invoice["_id"]}, invoice)
        await self._log_history(
            owner_user_id,
            command_text=f"Send invoice {invoice['invoice_number']} to {invoice['client_name']}",
            status="delivered",
            invoice=invoice,
            preview_payload={"channel": payload.channel, "recipient_email": recipient},
        )
        return self._serialize_invoice(invoice)

    async def share_invoice(self, owner_user_id: str, invoice_id: str, payload: InvoiceShareRequest) -> InvoiceShareResponse:
        invoice = await self._load_invoice(owner_user_id, invoice_id)
        if not invoice.get("share_token"):
            invoice["share_token"] = secrets.token_urlsafe(18)
        share_url = self._share_url(invoice)
        if payload.channel == "email":
            recipient = str(payload.recipient_email) if payload.recipient_email else invoice.get("client_email")
            if not recipient:
                raise AppException(status_code=400, code="CLIENT_EMAIL_REQUIRED", message="Recipient email is required to share the invoice by email.")
            await self.email_service.send_invoice_email(
                email=recipient,
                subject=f"Shared invoice {invoice['invoice_number']}",
                text=self._invoice_email_text(invoice, payload.message, share_url=share_url),
                html=self._invoice_email_html(invoice, payload.message, share_url=share_url),
            )
        if invoice.get("sent_at") is None:
            invoice["sent_at"] = self._utc_now()
        if invoice.get("status") == "draft":
            invoice["status"] = "sent"
        self._append_event(invoice, "shared", "Invoice shared", payload.message or "Invoice shared with client", channel=payload.channel)
        invoice["updated_at"] = self._utc_now()
        await self.db.invoices.replace_one({"_id": invoice["_id"]}, invoice)
        await self._log_history(
            owner_user_id,
            command_text=f"Share invoice {invoice['invoice_number']}",
            status="delivered",
            invoice=invoice,
            preview_payload={"channel": payload.channel, "share_url": share_url},
        )
        return InvoiceShareResponse(
            invoice_id=invoice["invoice_seq"],
            channel=payload.channel,
            recipient_email=(str(payload.recipient_email) if payload.recipient_email else invoice.get("client_email")),
            share_url=share_url,
            status=self._display_status(invoice),
        )

    async def send_reminder(self, owner_user_id: str, invoice_id: str, payload: InvoiceReminderRequest) -> InvoiceResponse:
        invoice = await self._load_invoice(owner_user_id, invoice_id)
        recipient = str(payload.recipient_email) if payload.recipient_email else invoice.get("client_email")
        if payload.channel == "email" and not recipient:
            raise AppException(status_code=400, code="CLIENT_EMAIL_REQUIRED", message="Recipient email is required to send a reminder.")
        if payload.channel == "email":
            await self.email_service.send_invoice_email(
                email=recipient,
                subject=f"Reminder: Invoice {invoice['invoice_number']} is due",
                text=self._invoice_reminder_text(invoice, payload.message),
                html=self._invoice_reminder_html(invoice, payload.message),
            )
        if invoice.get("sent_at") is None:
            invoice["sent_at"] = self._utc_now()
        if invoice.get("status") == "draft":
            invoice["status"] = "sent"
        self._append_event(invoice, "reminder_sent", "Reminder sent", payload.message or "Payment reminder sent", channel=payload.channel)
        invoice["updated_at"] = self._utc_now()
        await self.db.invoices.replace_one({"_id": invoice["_id"]}, invoice)
        await self._log_history(
            owner_user_id,
            command_text=f"Send reminder for invoice {invoice['invoice_number']}",
            status="delivered",
            invoice=invoice,
            preview_payload={"channel": payload.channel, "recipient_email": recipient},
        )
        return self._serialize_invoice(invoice)

    async def update_invoice_status(self, owner_user_id: str, invoice_id: str, payload: InvoiceStatusUpdateRequest) -> InvoiceResponse:
        invoice = await self._load_invoice(owner_user_id, invoice_id)
        self._set_status(invoice, payload.status, payload.note)
        invoice["updated_at"] = self._utc_now()
        await self.db.invoices.replace_one({"_id": invoice["_id"]}, invoice)
        await self._log_history(
            owner_user_id,
            command_text=f"Mark invoice {invoice['invoice_number']} as {payload.status}",
            status="completed",
            invoice=invoice,
            preview_payload={"status": payload.status, "note": payload.note},
        )
        return self._serialize_invoice(invoice)

    async def list_timeline(self, owner_user_id: str, invoice_id: str) -> list[InvoiceTimelineEventResponse]:
        invoice = await self._load_invoice(owner_user_id, invoice_id)
        return [self._serialize_event(event) for event in invoice.get("timeline", [])]

    async def generate_pdf(self, owner_user_id: str, invoice_id: str) -> bytes:
        invoice = await self._load_invoice(owner_user_id, invoice_id)
        await self._log_history(
            owner_user_id,
            command_text=f"Export invoice {invoice['invoice_number']} as PDF",
            status="exported",
            invoice=invoice,
            preview_payload={"format": "pdf"},
        )
        return self._generate_pdf_bytes(invoice)

    async def generate_shared_pdf(self, share_token: str) -> bytes:
        invoice = await self.db.invoices.find_one({"share_token": share_token})
        if not invoice:
            raise AppException(status_code=404, code="INVOICE_NOT_FOUND", message="Shared invoice was not found.")
        return self._generate_pdf_bytes(invoice)

    async def _load_invoice(self, owner_user_id: str, invoice_id: str) -> dict:
        if not ObjectId.is_valid(invoice_id):
            raise AppException(status_code=404, code="INVOICE_NOT_FOUND", message="Invoice was not found.")
        invoice = await self.db.invoices.find_one({"_id": ObjectId(invoice_id), "owner_user_id": owner_user_id})
        if not invoice:
            raise AppException(status_code=404, code="INVOICE_NOT_FOUND", message="Invoice was not found.")
        return invoice

    async def _next_sequence(self, key: str) -> int:
        result = await self.db.counters.find_one_and_update(
            {"_id": key},
            {"$inc": {"value": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        value = (result or {}).get("value")
        if value is None:
            doc = await self.db.counters.find_one({"_id": key})
            return int((doc or {}).get("value", 1))
        return int(value)

    @staticmethod
    def _invoice_number(invoice_seq: int, issue_date: date) -> str:
        return f"INV-{issue_date.year}-{invoice_seq:04d}"

    def _item_to_document(self, item, idx: int) -> dict:
        quantity = float(item.quantity if hasattr(item, "quantity") else item["quantity"])
        unit_price = round(float(item.unit_price if hasattr(item, "unit_price") else item["unit_price"]), 2)
        return {
            "id": idx + 1,
            "description": (item.description if hasattr(item, "description") else item["description"]).strip(),
            "details": (item.details if hasattr(item, "details") else item.get("details")) or None,
            "quantity": quantity,
            "unit_price": unit_price,
            "line_total": round(quantity * unit_price, 2),
            "sort_order": idx,
        }

    @staticmethod
    def _compute_totals(items: list, tax_rate: float) -> tuple[float, float, float]:
        subtotal = sum(
            Decimal(str(item.quantity if hasattr(item, "quantity") else item["quantity"]))
            * Decimal(str(item.unit_price if hasattr(item, "unit_price") else item["unit_price"]))
            for item in items
        )
        subtotal = subtotal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        tax_amount = (subtotal * Decimal(str(tax_rate)) / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_amount = (subtotal + tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return float(subtotal), float(tax_amount), float(total_amount)

    def _serialize_invoice(self, invoice: dict) -> InvoiceResponse:
        return InvoiceResponse(
            id=str(invoice["_id"]),
            invoice_number=invoice["invoice_number"],
            client_name=invoice["client_name"],
            client_email=invoice.get("client_email"),
            billing_address=invoice.get("billing_address"),
            currency=invoice["currency"],
            issue_date=date.fromisoformat(invoice["issue_date"]),
            due_date=date.fromisoformat(invoice["due_date"]),
            subtotal=round(invoice["subtotal"], 2),
            tax_rate=round(invoice.get("tax_rate", 0), 2),
            tax_amount=round(invoice["tax_amount"], 2),
            total_amount=round(invoice["total_amount"], 2),
            notes=invoice.get("notes"),
            status=self._display_status(invoice),
            sent_at=invoice.get("sent_at"),
            viewed_at=invoice.get("viewed_at"),
            paid_at=invoice.get("paid_at"),
            share_url=self._share_url(invoice) if invoice.get("share_token") else None,
            total_items=len(invoice.get("items", [])),
            items=[self._serialize_item(item) for item in invoice.get("items", [])],
            timeline=[self._serialize_event(event) for event in invoice.get("timeline", [])],
            created_at=invoice["created_at"],
            updated_at=invoice["updated_at"],
        )

    def _serialize_list_item(self, invoice: dict) -> InvoiceListItemResponse:
        return InvoiceListItemResponse(
            id=str(invoice["_id"]),
            invoice_number=invoice["invoice_number"],
            client_name=invoice["client_name"],
            client_email=invoice.get("client_email"),
            currency=invoice["currency"],
            due_date=date.fromisoformat(invoice["due_date"]),
            total_amount=round(invoice["total_amount"], 2),
            status=self._display_status(invoice),
            issue_date=date.fromisoformat(invoice["issue_date"]),
            sent_at=invoice.get("sent_at"),
        )

    @staticmethod
    def _serialize_item(item: dict) -> InvoiceLineItemResponse:
        return InvoiceLineItemResponse(
            id=item["id"],
            description=item["description"],
            details=item.get("details"),
            quantity=item["quantity"],
            unit_price=round(item["unit_price"], 2),
            line_total=round(item["line_total"], 2),
            sort_order=item["sort_order"],
        )

    @staticmethod
    def _serialize_event(event: dict) -> InvoiceTimelineEventResponse:
        return InvoiceTimelineEventResponse(
            id=event["id"],
            event_type=event["event_type"],
            title=event["title"],
            description=event.get("description"),
            channel=event.get("channel"),
            created_at=event["created_at"],
        )

    def _build_summary(self, invoices: list[dict]) -> InvoiceSummaryResponse:
        statuses = [self._display_status(item) for item in invoices]
        outstanding_statuses = {"sent", "viewed", "overdue"}
        total_outstanding = round(sum(item["total_amount"] for item in invoices if self._display_status(item) in outstanding_statuses), 2)
        return InvoiceSummaryResponse(
            total_outstanding=total_outstanding,
            total_invoices=len(invoices),
            sent_invoices=sum(1 for status in statuses if status in {"sent", "viewed", "overdue", "paid"}),
            overdue_invoices=sum(1 for status in statuses if status == "overdue"),
            draft_invoices=sum(1 for status in statuses if status == "draft"),
        )

    @staticmethod
    def _matches_search(invoice: dict, search: str | None) -> bool:
        if not search:
            return True
        normalized = search.strip().lower()
        haystacks = [
            invoice.get("client_name", ""),
            invoice.get("invoice_number", ""),
            invoice.get("client_email", "") or "",
        ]
        return any(normalized in value.lower() for value in haystacks)

    def _matches_status(self, invoice: dict, status: str | None) -> bool:
        if not status:
            return True
        return self._display_status(invoice) == status

    @staticmethod
    def _ensure_editable(invoice: dict) -> None:
        if invoice.get("status") in {"paid", "cancelled"}:
            raise AppException(status_code=409, code="INVOICE_LOCKED", message="Paid or cancelled invoices cannot be edited.")

    def _set_status(self, invoice: dict, status: str, note: str | None = None) -> None:
        invoice["status"] = status
        now = self._utc_now()
        if status == "viewed":
            invoice["viewed_at"] = now
            invoice["sent_at"] = invoice.get("sent_at") or now
        elif status == "paid":
            invoice["paid_at"] = now
            invoice["sent_at"] = invoice.get("sent_at") or now
        elif status == "sent":
            invoice["sent_at"] = invoice.get("sent_at") or now
        self._append_event(invoice, status, self._status_title(status), note or self._status_description(status))

    @staticmethod
    def _status_title(status: str) -> str:
        return {
            "viewed": "Invoice viewed",
            "paid": "Invoice paid",
            "cancelled": "Invoice cancelled",
            "sent": "Sent to client",
        }.get(status, "Invoice updated")

    @staticmethod
    def _status_description(status: str) -> str:
        return {
            "viewed": "Client viewed the invoice",
            "paid": "Payment was received",
            "cancelled": "Invoice was cancelled",
            "sent": "Invoice sent to client",
        }.get(status, "Invoice status updated")

    def _display_status(self, invoice: dict) -> str:
        if invoice.get("status") in {"paid", "cancelled"}:
            return invoice["status"]
        if date.fromisoformat(invoice["due_date"]) < date.today():
            return "overdue"
        if invoice.get("viewed_at") is not None:
            return "viewed"
        if invoice.get("sent_at") is not None or invoice.get("status") == "sent":
            return "sent"
        return "draft"

    def _append_event(self, invoice: dict, event_type: str, title: str, description: str | None = None, channel: str | None = None) -> None:
        timeline = invoice.setdefault("timeline", [])
        timeline.append(
            {
                "id": len(timeline) + 1,
                "event_type": event_type,
                "title": title,
                "description": description,
                "channel": channel,
                "created_at": self._utc_now(),
            }
        )

    def _share_url(self, invoice: dict) -> str:
        return f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}/api/v1/invoices/shared/{invoice['share_token']}/pdf"

    async def _log_history(
        self,
        owner_user_id: str,
        *,
        command_text: str,
        status: str,
        invoice: dict,
        preview_payload: dict | None = None,
    ) -> None:
        await self.db.ai_command_history.insert_one(
            {
                "user_id": owner_user_id,
                "command_text": command_text,
                "command_type": "invoice",
                "status": status,
                "timestamp": self._utc_now(),
                "is_replayable": True,
                "related_resource": {
                    "type": "invoice",
                    "id": str(invoice["_id"]),
                    "invoice_number": invoice["invoice_number"],
                    "status": self._display_status(invoice),
                },
                "preview_payload": preview_payload,
            }
        )

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.now(UTC)

    @staticmethod
    def _invoice_email_text(invoice: dict, message: str | None, *, share_url: str | None = None) -> str:
        lines = [
            f"Invoice {invoice['invoice_number']}",
            f"Client: {invoice['client_name']}",
            f"Due date: {invoice['due_date']}",
            f"Total due: {invoice['currency']} {invoice['total_amount']:.2f}",
        ]
        if share_url:
            lines.append(f"View invoice: {share_url}")
        if message:
            lines.extend(["", message.strip()])
        return "\n".join(lines)

    @staticmethod
    def _invoice_email_html(invoice: dict, message: str | None, *, share_url: str | None = None) -> str:
        share_link = f'<p><a href="{share_url}">View invoice</a></p>' if share_url else ""
        note = f"<p>{message.strip()}</p>" if message else ""
        return f"""
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 16px;">
          <h2 style="margin-bottom: 8px;">Invoice {invoice['invoice_number']}</h2>
          <p style="margin: 0 0 12px 0;">Client: {invoice['client_name']}</p>
          <p style="margin: 0 0 12px 0;">Due date: {invoice['due_date']}</p>
          <p style="margin: 0 0 12px 0;">Total due: {invoice['currency']} {invoice['total_amount']:.2f}</p>
          {share_link}
          {note}
        </div>
        """

    @staticmethod
    def _invoice_reminder_text(invoice: dict, message: str | None) -> str:
        base = (
            f"Reminder for invoice {invoice['invoice_number']}\n"
            f"Client: {invoice['client_name']}\n"
            f"Due date: {invoice['due_date']}\n"
            f"Outstanding amount: {invoice['currency']} {invoice['total_amount']:.2f}"
        )
        return f"{base}\n\n{message.strip()}" if message else base

    @staticmethod
    def _invoice_reminder_html(invoice: dict, message: str | None) -> str:
        note = f"<p>{message.strip()}</p>" if message else ""
        return f"""
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 16px;">
          <h2 style="margin-bottom: 8px;">Reminder: Invoice {invoice['invoice_number']}</h2>
          <p style="margin: 0 0 12px 0;">Client: {invoice['client_name']}</p>
          <p style="margin: 0 0 12px 0;">Due date: {invoice['due_date']}</p>
          <p style="margin: 0 0 12px 0;">Outstanding amount: {invoice['currency']} {invoice['total_amount']:.2f}</p>
          {note}
        </div>
        """

    def _generate_pdf_bytes(self, invoice: dict) -> bytes:
        lines = [
            f"Invoice {invoice['invoice_number']}",
            f"Client: {invoice['client_name']}",
            f"Email: {invoice.get('client_email') or '-'}",
            f"Issue Date: {invoice['issue_date']}",
            f"Due Date: {invoice['due_date']}",
            "",
        ]
        for item in invoice.get("items", []):
            lines.append(f"{item['description']} | Qty {item['quantity']:g} | {invoice['currency']} {item['line_total']:.2f}")
            if item.get("details"):
                lines.append(f"  {item['details']}")
        lines.extend(
            [
                "",
                f"Subtotal: {invoice['currency']} {invoice['subtotal']:.2f}",
                f"Tax ({invoice.get('tax_rate', 0):.2f}%): {invoice['currency']} {invoice['tax_amount']:.2f}",
                f"Total: {invoice['currency']} {invoice['total_amount']:.2f}",
            ]
        )
        return self._build_simple_pdf(lines)

    @staticmethod
    def _build_simple_pdf(lines: list[str]) -> bytes:
        def escape(text: str) -> str:
            return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

        content_lines = ["BT", "/F1 12 Tf", "50 780 Td", "16 TL"]
        first = True
        for line in lines:
            if first:
                content_lines.append(f"({escape(line)}) Tj")
                first = False
            else:
                content_lines.append("T*")
                content_lines.append(f"({escape(line)}) Tj")
        content_lines.append("ET")
        stream = "\n".join(content_lines).encode("latin-1", "replace")

        objects = [
            b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
            b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
            b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
            b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
            f"5 0 obj << /Length {len(stream)} >> stream\n".encode("latin-1") + stream + b"\nendstream endobj\n",
        ]

        buffer = BytesIO()
        buffer.write(b"%PDF-1.4\n")
        offsets = [0]
        for obj in objects:
            offsets.append(buffer.tell())
            buffer.write(obj)
        xref_offset = buffer.tell()
        buffer.write(f"xref\n0 {len(offsets)}\n".encode("latin-1"))
        buffer.write(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            buffer.write(f"{offset:010d} 00000 n \n".encode("latin-1"))
        buffer.write((f"trailer << /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF").encode("latin-1"))
        return buffer.getvalue()
