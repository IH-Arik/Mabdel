from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ErrorDetails(BaseModel):
    code: str
    details: Any | None = None


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "Request successful."
    data: T | None = None


class ApiErrorResponse(BaseModel):
    success: bool = False
    message: str
    error: ErrorDetails
