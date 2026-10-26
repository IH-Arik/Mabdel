"""Bounded, deterministic extraction: document contents are never AI-generated."""

from io import BytesIO
from pathlib import PurePath
from xml.etree import ElementTree
from zipfile import ZipFile

from app.core.exceptions import AppException

MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
MAX_DOCUMENT_CHARACTERS = 12000


def extract_document_text(filename: str, content: bytes) -> str:
    if not content or len(content) > MAX_DOCUMENT_BYTES:
        raise AppException(
            status_code=422,
            code="KNOWLEDGE_DOCUMENT_SIZE",
            message="Upload a non-empty document up to 5 MB.",
        )
    extension = PurePath(filename.lower()).suffix
    try:
        if extension == ".txt":
            text = content.decode("utf-8-sig")
        elif extension == ".pdf":
            from pypdf import PdfReader

            reader = PdfReader(BytesIO(content))
            if reader.is_encrypted or len(reader.pages) > 60:
                raise ValueError("Use an unencrypted PDF with at most 60 pages.")
            pages = []
            for page in reader.pages:
                pages.append(page.extract_text() or "")
                if sum(map(len, pages)) > MAX_DOCUMENT_CHARACTERS:
                    raise ValueError(
                        "Document text exceeds 12,000 characters; split it into smaller documents."
                    )
            text = "\n".join(pages)
        elif extension == ".docx":
            with ZipFile(BytesIO(content)) as archive:
                info = archive.getinfo("word/document.xml")
                if info.file_size > MAX_DOCUMENT_BYTES:
                    raise ValueError("The document is too large to extract safely.")
                root = ElementTree.fromstring(archive.read(info))
                ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
                text = "\n".join(
                    "".join(node.itertext()) for node in root.iter(ns + "p")
                )
        else:
            raise ValueError("Supported document formats: PDF, TXT, DOCX.")
        text = "".join(
            char for char in text if char in "\n\t" or ord(char) >= 32
        ).strip()
        if not text:
            raise ValueError(
                "No readable text found. Scanned documents need OCR before upload."
            )
        if len(text) > MAX_DOCUMENT_CHARACTERS:
            raise ValueError(
                "Document text exceeds 12,000 characters; split it into smaller documents."
            )
        return text
    except Exception as exc:
        raise AppException(
            status_code=422,
            code="KNOWLEDGE_DOCUMENT_INVALID",
            message=str(exc)
            if isinstance(exc, ValueError)
            else "Unable to read document. Upload a valid PDF, UTF-8 TXT, or DOCX file.",
        ) from exc
