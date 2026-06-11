from __future__ import annotations

import time
from collections import defaultdict, deque
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.core.config import settings


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response


class AuthRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:
        super().__init__(app)
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method.upper() != "POST" or not request.url.path.startswith("/api/v1/auth/"):
            return await call_next(request)

        limit = settings.AUTH_RATE_LIMIT_MAX_REQUESTS
        window = settings.AUTH_RATE_LIMIT_WINDOW_SECONDS
        forwarded_for = request.headers.get("x-forwarded-for", "")
        client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else "unknown")
        key = f"{client_ip}:{request.url.path}"
        now = time.time()
        hits = self._hits[key]
        while hits and now - hits[0] > window:
            hits.popleft()
        if len(hits) >= limit:
            request_id = getattr(request.state, "request_id", str(uuid4()))
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "message": "Too many authentication attempts. Please try again later.",
                    "error": {
                        "code": "RATE_LIMITED",
                        "details": {
                            "request_id": request_id,
                            "retry_after_seconds": window,
                        },
                    },
                },
                headers={
                    "Retry-After": str(window),
                    "X-Request-ID": request_id,
                },
            )
        hits.append(now)
        return await call_next(request)
