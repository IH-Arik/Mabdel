from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.core.exceptions import AppException


def fernet_for_secret(secret: str) -> Fernet:
    """The Fernet for an arbitrary secret string, derived exactly like the app's own key.
    Exposed so a key rotation can read with the old secret and write with the new one."""
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _build_fernet() -> Fernet:
    return fernet_for_secret(settings.OAUTH_TOKEN_ENCRYPTION_KEY or settings.SECRET_KEY)


_fernet = _build_fernet()


def encrypt_value(value: str) -> str:
    return _fernet.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(value: str) -> str:
    try:
        return _fernet.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise AppException(status_code=500, code="TOKEN_DECRYPTION_FAILED", message="Stored token could not be decrypted.") from exc
