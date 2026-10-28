from __future__ import annotations

import pytest

from app.core.exceptions import AppException
from app.services.media_storage_service import MediaStorageService

# Regression coverage for real gaps from the original audit's "upload checks"
# finding: images were validated by declared Content-Type alone (never the
# actual bytes), store_image enforced no size limit at all (the empty/size
# checks lived only in the file-attachment path, misplaced), and attachments
# accepted any extension/content-type including active HTML/SVG/JS, which a
# browser would execute if ever served inline from this origin.


def test_an_image_whose_bytes_do_not_match_its_declared_content_type_is_rejected():
    with pytest.raises(AppException) as exc_info:
        MediaStorageService().store_image(
            owner_id="owner1",
            folder="profile_avatars",
            file_bytes=b"<script>alert(1)</script>",
            content_type="image/png",
            filename="avatar.png",
        )
    assert exc_info.value.code == "IMAGE_CONTENT_MISMATCH"


def test_a_real_png_still_passes(tmp_path, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "MEDIA_ROOT", str(tmp_path))
    stored = MediaStorageService().store_image(
        owner_id="owner1",
        folder="profile_avatars",
        file_bytes=b"\x89PNG\r\n\x1a\nreal-enough-png-bytes",
        content_type="image/png",
        filename="avatar.png",
    )
    assert stored.content_type == "image/png"


def test_store_image_enforces_the_configured_size_limit(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "MEDIA_MAX_UPLOAD_BYTES", 10)
    with pytest.raises(AppException) as exc_info:
        MediaStorageService().store_image(
            owner_id="owner1",
            folder="profile_avatars",
            file_bytes=b"\x89PNG\r\n\x1a\n" + b"x" * 50,
            content_type="image/png",
            filename="avatar.png",
        )
    assert exc_info.value.code == "FILE_TOO_LARGE"


def test_an_html_attachment_disguised_with_a_safe_content_type_is_rejected_by_extension():
    with pytest.raises(AppException) as exc_info:
        MediaStorageService().store_file(
            owner_id="owner1",
            folder="message_attachments",
            file_bytes=b"<html><script>alert(document.cookie)</script></html>",
            content_type="application/octet-stream",
            filename="invoice.html",
        )
    assert exc_info.value.code == "UNSUPPORTED_ATTACHMENT_TYPE"


def test_an_attachment_declared_as_html_is_rejected_regardless_of_filename():
    with pytest.raises(AppException) as exc_info:
        MediaStorageService().store_file(
            owner_id="owner1",
            folder="message_attachments",
            file_bytes=b"<html></html>",
            content_type="text/html",
            filename="notes.txt",
        )
    assert exc_info.value.code == "UNSUPPORTED_ATTACHMENT_TYPE"


def test_a_real_pdf_attachment_is_still_accepted(tmp_path, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "MEDIA_ROOT", str(tmp_path))
    stored = MediaStorageService().store_file(
        owner_id="owner1",
        folder="documents",
        file_bytes=b"%PDF-1.4 fake but harmless",
        content_type="application/pdf",
        filename="invoice.pdf",
    )
    assert stored.filename.endswith(".pdf")
