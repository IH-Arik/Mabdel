from __future__ import annotations

import asyncio
from io import BytesIO
from zipfile import ZipFile

import pytest
from pydantic import ValidationError

from app.core.exceptions import AppException
from app.schemas.smartflow import InsurancePlan
from app.services.smartflow.ai_call_settings_service import AICallSettingsService
from app.services.smartflow.receptionist_documents import extract_document_text
from app.tests.test_ai_call_settings import _owner_with_org


def test_document_extraction_rejects_unsupported_empty_and_oversized_text():
    for name, content in [("test.exe", b"text"), ("empty.txt", b" "), ("huge.txt", b"a" * 12001), ("scan.pdf", b"broken")]:
        with pytest.raises(AppException):
            extract_document_text(name, content)
    assert extract_document_text("policy.txt", b"Only approved facts.") == "Only approved facts."


def test_docx_extracts_paragraphs_without_inventing_text():
    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        archive.writestr("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Office closes at six.</w:t></w:r></w:p></w:body></w:document>')
    assert extract_document_text("hours.docx", buffer.getvalue()) == "Office closes at six."


def test_insurance_validity_rejects_inverted_period():
    with pytest.raises(ValidationError):
        InsurancePlan(id="p", payer="Plan", effective_from="2026-06-01", effective_until="2026-05-01")


def test_document_review_approval_revocation_and_org_isolation(client, mock_db):
    headers, org_id = _owner_with_org(client, mock_db, "docs-owner@example.com")
    other, _ = _owner_with_org(client, mock_db, "docs-other@example.com")
    base = "/api/v1/smartflow/ai-call-settings"
    assert client.patch(base, headers=headers, json={"knowledge_base": "Business facts"}).status_code == 200
    uploaded = client.post(base + "/documents", headers=headers, files={"file": ("hours.txt", b"We close at six.", "text/plain")})
    assert uploaded.status_code == 201, uploaded.text
    document = uploaded.json()["data"]
    path = base + "/documents/" + document["id"]
    assert document["approved"] is False
    service = AICallSettingsService(mock_db)
    assert not asyncio.run(service.get_settings_for_organization(org_id)).get("approved_document_knowledge")
    assert client.get(path, headers=other).status_code == 404
    assert client.patch(path, headers=other, json={"approved": True}).status_code == 404
    assert client.delete(path, headers=other).status_code == 404
    assert client.get(path, headers=headers).json()["data"]["preview"] == "We close at six."
    assert client.patch(path, headers=headers, json={"approved": True}).status_code == 200
    settings = asyncio.run(service.get_settings_for_organization(org_id))
    assert "We close at six." in settings["approved_document_knowledge"]
    assert settings["knowledge_base"] == "Business facts"
    assert client.patch(base, headers=headers, json={"assistant_name": "Sam"}).status_code == 200
    assert client.get(base, headers=headers).json()["data"]["knowledge_documents"][0]["approved"] is True
    assert client.patch(path, headers=headers, json={"approved": False}).status_code == 200
    assert not asyncio.run(service.get_settings_for_organization(org_id)).get("approved_document_knowledge")
    assert client.delete(path, headers=headers).status_code == 200
    assert client.get(base, headers=headers).json()["data"]["knowledge_documents"] == []


def test_insurance_dates_round_trip_and_bad_period_rejected(client, mock_db):
    headers, _ = _owner_with_org(client, mock_db, "insurance-dates@example.com")
    url = "/api/v1/smartflow/ai-call-settings"
    plan = {"id": "p", "payer": "Owner plan", "effective_from": "2025-01-01", "effective_until": "2027-01-01", "last_verified_at": "2025-01-01"}
    response = client.patch(url, headers=headers, json={"insurance_plans": [plan]})
    assert response.status_code == 200, response.text
    assert client.get(url, headers=headers).json()["data"]["insurance_plans"][0]["effective_until"] == "2027-01-01"
    plan["effective_until"] = "2024-01-01"
    assert client.patch(url, headers=headers, json={"insurance_plans": [plan]}).status_code == 422


def test_real_pdf_extracts_text_and_rejects_scanned_only_pages():
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=300)
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 10 200 Td (Approved office hours) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    buffer = BytesIO()
    writer.write(buffer)
    assert "Approved office hours" in extract_document_text("hours.pdf", buffer.getvalue())
    empty = PdfWriter()
    empty.add_blank_page(width=300, height=300)
    buffer = BytesIO()
    empty.write(buffer)
    with pytest.raises(AppException):
        extract_document_text("scan.pdf", buffer.getvalue())


def test_document_search_reads_all_approved_documents_and_excludes_unapproved_other_org(mock_db):
    async def run():
        await mock_db.organizations.insert_one({"organization_id": "knowledge-org", "ai_receptionist_documents": [
            {"id": "first", "filename": "intro.txt", "approved": True, "text": "General opening information. " * 1000},
            {"id": "last", "filename": "policy.txt", "approved": True, "text": "Aquatic therapy costs 75 dollars per session."},
            {"id": "draft", "filename": "draft.txt", "approved": False, "text": "Aquatic therapy costs 1 dollar."},
        ]})
        await mock_db.organizations.insert_one({"organization_id": "other-org", "ai_receptionist_documents": [
            {"id": "other", "filename": "secret.txt", "approved": True, "text": "Aquatic therapy secret discount."},
        ]})
        service = AICallSettingsService(mock_db)
        result = await service.search_approved_documents("knowledge-org", "How much does aquatic therapy cost?")
        assert result["matches"]
        assert {match["document_id"] for match in result["matches"]} == {"last"}
        assert "75 dollars" in result["matches"][0]["text"]
        assert not (await service.search_approved_documents("knowledge-org", "unavailable specialty"))["matches"]
        assert not (await service.search_approved_documents(None, "aquatic"))["matches"]
    asyncio.run(run())
