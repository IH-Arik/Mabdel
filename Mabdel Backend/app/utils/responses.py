from __future__ import annotations

from typing import Any


def success_response(data: Any = None, message: str = "Request successful.") -> dict[str, Any]:
    return {
        "success": True,
        "message": message,
        "data": data,
    }
