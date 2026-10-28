from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import AppException
from app.core.security import decode_token
from app.dependencies import get_mongo_database
from app.repositories.auth_repository import AuthRepository
from app.services.media_storage_service import PRIVATE_MEDIA_FOLDERS, MediaStorageService, private_media_root
from app.utils.helpers import resolve_team_user_ids

router = APIRouter(prefix="/media/private", tags=["media"])


async def _authenticated_user_for_media(
    token: str | None = Query(default=None, description="Access token - the only way for <img>/<audio>/<video> tags to authenticate, since browsers never attach custom headers to those requests."),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
) -> dict:
    """Same checks as get_current_user, but also accepts the token as a query
    param. Every other endpoint only takes it in the Authorization header; this
    one has to also accept it in the URL because inline <img>/<audio>/<video>
    tags have no way to attach a header, and this route exists specifically so
    those tags can still render private attachments instead of silently 401ing."""
    if not token:
        raise AppException(status_code=401, code="NOT_AUTHENTICATED", message="Authentication required.")
    claims = decode_token(token)
    if claims.get("type") != "access":
        raise AppException(status_code=401, code="INVALID_ACCESS_TOKEN", message="Invalid access token type.")
    user = await AuthRepository(db).get_user_by_id(claims.get("sub", ""))
    if not user:
        raise AppException(status_code=401, code="USER_NOT_FOUND", message="User for this token no longer exists.")
    if user.get("status") == "blocked":
        raise AppException(status_code=403, code="ACCOUNT_BLOCKED", message="This account has been blocked.")
    return user


@router.get("/{folder}/{owner_id}/{filename}")
async def download_private_media(
    folder: str,
    owner_id: str,
    filename: str,
    current_user: dict = Depends(_authenticated_user_for_media),
    db: AsyncIOMotorDatabase = Depends(get_mongo_database),
):
    """Serves a private upload (message attachment, signed agreement PDF/certificate,
    bulk-campaign or inbound-email attachment) only to someone on the same team as
    the organization that owns it - these are never reachable from the public
    media mount. See MediaStorageService.PRIVATE_MEDIA_FOLDERS."""
    safe_folder = MediaStorageService._safe_path_part(folder, "folder")
    if safe_folder not in PRIVATE_MEDIA_FOLDERS:
        raise AppException(status_code=404, code="MEDIA_NOT_FOUND", message="File not found.")
    safe_owner_id = MediaStorageService._safe_path_part(owner_id, "owner_id")
    safe_filename = MediaStorageService._safe_path_part(filename, "filename")

    team_ids = await resolve_team_user_ids(db, str(current_user["_id"]))
    if safe_owner_id not in team_ids:
        raise AppException(status_code=403, code="MEDIA_FORBIDDEN", message="You do not have access to this file.")

    path = private_media_root() / safe_folder / safe_owner_id / safe_filename
    if not path.is_file():
        raise AppException(status_code=404, code="MEDIA_NOT_FOUND", message="File not found.")

    return FileResponse(path)
