from __future__ import annotations

from app.services.media_storage_service import MediaStorageService, private_media_root
from app.tests.test_team_direct_messaging import _same_org, _signup

# Regression for B03: message attachments, signed agreement PDFs/certificates, and
# bulk/inbound-email attachments used to be served from the public, unauthenticated
# /media/* StaticFiles mount - anyone with the URL could download them. They're now
# written outside the public media root and served only via this authenticated
# route, which checks the requester shares an organization with the file's owner.
#
# This route takes its token as a ?token= query param rather than the usual
# Authorization header, because it's meant to be used directly as an <img>/
# <audio>/<video> src - those tags can't attach a custom header.


def _store_private_file(owner_id: str) -> str:
    stored = MediaStorageService().store_file(
        owner_id=owner_id,
        folder="message_attachments",
        file_bytes=b"private contents",
        content_type="application/pdf",
        filename="note.pdf",
    )
    return stored.public_path


def _token(headers: dict) -> str:
    return headers["Authorization"].removeprefix("Bearer ")


def test_private_file_is_not_written_under_the_public_media_root():
    stored = MediaStorageService().store_file(
        owner_id="owner123",
        folder="agreement_signed_pdfs",
        file_bytes=b"signed pdf bytes",
        content_type="application/pdf",
        filename="agreement.pdf",
    )
    assert stored.public_path.startswith("/api/v1/media/private/")
    assert stored.storage_path.is_relative_to(private_media_root())


def test_the_files_owner_can_download_it(client, mock_db):
    headers, owner_id = _signup(client, mock_db, "media-owner@example.com", "Owner")
    path = _store_private_file(owner_id)

    response = client.get(path, params={"token": _token(headers)})

    assert response.status_code == 200
    assert response.content == b"private contents"


def test_a_teammate_in_the_same_organization_can_download_it(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "media-owner2@example.com", "Owner")
    mate_headers, mate_id = _signup(client, mock_db, "media-mate2@example.com", "Mate")
    _same_org(mock_db, owner_id, mate_id)
    path = _store_private_file(owner_id)

    response = client.get(path, params={"token": _token(mate_headers)})

    assert response.status_code == 200


def test_a_stranger_cannot_download_another_organizations_file(client, mock_db):
    owner_headers, owner_id = _signup(client, mock_db, "media-owner3@example.com", "Owner")
    stranger_headers, _ = _signup(client, mock_db, "media-stranger3@example.com", "Stranger")
    path = _store_private_file(owner_id)

    response = client.get(path, params={"token": _token(stranger_headers)})

    assert response.status_code == 403


def test_an_unauthenticated_request_is_rejected(client, mock_db):
    _, owner_id = _signup(client, mock_db, "media-owner4@example.com", "Owner")
    path = _store_private_file(owner_id)

    response = client.get(path)

    assert response.status_code == 401


def test_a_legacy_sensitive_file_under_the_public_media_root_is_not_served(client):
    """Regression for R03: files written under a PRIVATE_MEDIA_FOLDERS name
    before B03's fix (or by any writer that still targets the public root by
    mistake) sat under the public, unauthenticated /media/* StaticFiles mount.
    That folder name must be denied there outright, regardless of how the file
    got there."""
    from pathlib import Path
    from app.core.config import settings

    legacy_dir = Path(settings.MEDIA_ROOT).expanduser() / "message_attachments" / "legacy-owner"
    legacy_dir.mkdir(parents=True, exist_ok=True)
    (legacy_dir / "old.pdf").write_bytes(b"legacy public contents")

    response = client.get(f"{settings.MEDIA_PUBLIC_PATH}/message_attachments/legacy-owner/old.pdf")

    assert response.status_code == 404
