from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from app.core.config import settings
from app.core.exceptions import AppException


@dataclass(frozen=True)
class StoredMedia:
    url: str
    public_path: str
    storage_path: Path
    filename: str
    content_type: str
    size_bytes: int


class MediaStorageService:
    IMAGE_EXTENSIONS_BY_TYPE = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }

    def store_image(
        self,
        *,
        owner_id: str,
        folder: str,
        file_bytes: bytes,
        content_type: str | None,
        filename: str | None = None,
        label: str = "Image",
    ) -> StoredMedia:
        media_type = self._normalize_content_type(content_type)
        self._validate_image(file_bytes=file_bytes, media_type=media_type, label=label)

        safe_owner_id = self._safe_path_part(owner_id, "owner_id")
        safe_folder = self._safe_path_part(folder, "folder")
        extension = self._image_extension(media_type, filename)
        stored_name = f"{uuid4().hex}{extension}"

        directory = Path(settings.MEDIA_ROOT).expanduser() / safe_folder / safe_owner_id
        directory.mkdir(parents=True, exist_ok=True)
        storage_path = directory / stored_name
        storage_path.write_bytes(file_bytes)

        public_path = f"{settings.MEDIA_PUBLIC_PATH.rstrip('/')}/{safe_folder}/{safe_owner_id}/{stored_name}"
        return StoredMedia(
            url=f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}{public_path}",
            public_path=public_path,
            storage_path=storage_path,
            filename=stored_name,
            content_type=media_type,
            size_bytes=len(file_bytes),
        )

    def normalize_public_url(self, url: str | None) -> str | None:
        if not url:
            return None
        media_prefix = settings.MEDIA_PUBLIC_PATH.rstrip("/") + "/"
        if media_prefix in url:
            parts = url.split(media_prefix, 1)
            path = media_prefix + parts[1]
            return f"{settings.PUBLIC_BACKEND_URL.rstrip('/')}/{path.lstrip('/')}"
        return url

    def _validate_image(self, *, file_bytes: bytes, media_type: str, label: str) -> None:
        if media_type not in settings.MEDIA_ALLOWED_IMAGE_TYPES:
            raise AppException(
                status_code=415,
                code="UNSUPPORTED_IMAGE_TYPE",
                message=f"{label} must be a JPG, PNG, WebP, or GIF image.",
                details={"content_type": media_type or None},
            )
        if not file_bytes:
            raise AppException(status_code=400, code="IMAGE_FILE_EMPTY", message=f"{label} file is empty.")
        if len(file_bytes) > settings.MEDIA_MAX_UPLOAD_BYTES:
            raise AppException(
                status_code=413,
                code="IMAGE_FILE_TOO_LARGE",
                message=f"{label} file is too large.",
                details={"max_bytes": settings.MEDIA_MAX_UPLOAD_BYTES},
            )

    @staticmethod
    def _normalize_content_type(content_type: str | None) -> str:
        return (content_type or "").lower().split(";", 1)[0].strip()

    @classmethod
    def _image_extension(cls, content_type: str, filename: str | None) -> str:
        if content_type in cls.IMAGE_EXTENSIONS_BY_TYPE:
            return cls.IMAGE_EXTENSIONS_BY_TYPE[content_type]
        suffix = Path(filename or "").suffix.lower()
        return suffix if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"} else ".img"

    @staticmethod
    def _safe_path_part(value: str, field_name: str) -> str:
        cleaned = str(value or "").strip().strip("/\\")
        if not cleaned or cleaned in {".", ".."} or "/" in cleaned or "\\" in cleaned:
            raise AppException(
                status_code=400,
                code="INVALID_MEDIA_PATH",
                message=f"Invalid media {field_name}.",
            )
        return cleaned
