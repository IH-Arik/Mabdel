from __future__ import annotations

import asyncio
from datetime import date

from app.schemas.invoice import InvoiceCreateRequest, InvoiceLineItem
from app.services.invoice_service import InvoiceService


def test_invoice_service_calculates_totals_and_generates_number(mock_db) -> None:
    payload = InvoiceCreateRequest(
        client_name="ACME",
        issue_date=date(2099, 5, 1),
        due_date=date(2099, 5, 15),
        tax_rate=10,
        items=[InvoiceLineItem(description="Design", quantity=2, unit_price=50)],
    )

    result = asyncio.run(InvoiceService(mock_db).create_invoice(payload, owner_user_id="user-1"))

    assert result.invoice_number.startswith("INV-2099-")
    assert result.subtotal == 100
    assert result.tax_amount == 10
    assert result.total_amount == 110
    assert result.total_items == 1
    assert result.status == "draft"
