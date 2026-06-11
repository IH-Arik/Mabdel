from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status

from Dashboard.app.core.config import settings

logger = logging.getLogger(__name__)


class AppException(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: Any = None) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


def _error_payload(message: str, code: str, details: Any = None) -> dict[str, Any]:
    return {"success": False, "message": message, "error": {"code": code, "details": details}}


def _safe_errors(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def make_safe(value: Any) -> Any:
        if isinstance(value, dict):
            return {str(k): make_safe(v) for k, v in value.items()}
        if isinstance(value, (list, tuple, set)):
            return [make_safe(item) for item in value]
        if isinstance(value, bytes):
            return f"<binary data: {len(value)} bytes>"
        if value.__class__.__name__ == "ObjectId":
            return str(value)
        if isinstance(value, BaseException):
            return str(value)
        if isinstance(value, (str, int, float, bool, type(None))):
            return value
        return str(value)

    return [make_safe(error) for error in errors]


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(exc.message, exc.code, exc.details),
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(str(exc.detail), "HTTP_ERROR", exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_payload("Validation error.", "VALIDATION_ERROR", _safe_errors(exc.errors())),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception method=%s path=%s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_payload(
                "Unexpected server error.",
                "INTERNAL_SERVER_ERROR",
                str(exc) if settings.DEBUG else None,
            ),
        )
