from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status

from app.core.config import settings

logger = logging.getLogger(__name__)


class AppException(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: Any = None) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


def _error_payload(message: str, code: str, details: Any = None, request_id: str | None = None) -> dict[str, Any]:
    normalized_details = details
    if request_id:
        if isinstance(details, dict):
            normalized_details = {**details, "request_id": request_id}
        elif details is None:
            normalized_details = {"request_id": request_id}
    return {
        "success": False,
        "message": message,
        "error": {
            "code": code,
            "details": normalized_details,
        },
    }


def _json_safe_validation_errors(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def _make_safe(obj: Any) -> Any:
        if isinstance(obj, (list, tuple, set)):
            return [_make_safe(item) for item in obj]
        if isinstance(obj, dict):
            return {str(key): _make_safe(value) for key, value in obj.items()}
        if isinstance(obj, bytes):
            return f"<binary data: {len(obj)} bytes>"
        if obj.__class__.__name__ == "ObjectId":
            return str(obj)
        if isinstance(obj, BaseException):
            return str(obj)
        if isinstance(obj, (str, int, float, bool, type(None))):
            return obj
        return str(obj)

    return [_make_safe(error) for error in errors]



def register_exception_handlers(app: FastAPI) -> None:
    def _request_headers(request_id: str | None) -> dict[str, str]:
        return {"X-Request-ID": request_id} if request_id else {}

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(message=exc.message, code=exc.code, details=exc.details, request_id=request_id),
            headers=_request_headers(request_id),
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        message = str(exc.detail) if exc.detail else "Request failed."
        request_id = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(message=message, code="HTTP_ERROR", details=exc.detail, request_id=request_id),
            headers=_request_headers(request_id),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_payload(
                message="Validation error.",
                code="VALIDATION_ERROR",
                details=_json_safe_validation_errors(exc.errors()),
                request_id=request_id,
            ),
            headers=_request_headers(request_id),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        details = str(exc) if settings.DEBUG else None
        request_id = getattr(request.state, "request_id", None)
        logger.exception(
            "Unhandled exception request_id=%s method=%s path=%s",
            request_id,
            request.method,
            request.url.path,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_payload(message="Unexpected server error.", code="INTERNAL_SERVER_ERROR", details=details, request_id=request_id),
            headers=_request_headers(request_id),
        )
