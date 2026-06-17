from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from uuid import uuid4

import redis.asyncio as aioredis
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Redis connection (shared, lazy-initialised)
# ---------------------------------------------------------------------------

_redis: aioredis.Redis | None = None


async def _get_redis() -> aioredis.Redis | None:
    global _redis
    if _redis is not None:
        return _redis
    try:
        client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        await client.ping()
        _redis = client
        logger.info("Redis rate-limit store connected: %s", settings.REDIS_URL)
    except Exception as exc:
        logger.warning("Redis unavailable (%s); falling back to in-memory rate limiting.", exc)
        _redis = None
    return _redis


async def _redis_sliding_window(key: str, limit: int, window: int) -> bool:
    """Return True if the request is allowed (under limit)."""
    client = await _get_redis()
    if client is None:
        return None  # signal: use in-memory path

    now = time.time()
    cutoff = now - window
    unique = f"{now}-{uuid4().hex}"

    try:
        async with client.pipeline(transaction=True) as pipe:
            pipe.zremrangebyscore(key, 0, cutoff)
            pipe.zcard(key)
            pipe.zadd(key, {unique: now})
            pipe.expire(key, window + 1)
            results = await pipe.execute()
        count_before_add = results[1]
        return count_before_add < limit
    except Exception as exc:
        logger.warning("Redis rate-limit error (%s); allowing request.", exc)
        return True  # fail open


# ---------------------------------------------------------------------------
# Request context
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Shared rate-limit logic
# ---------------------------------------------------------------------------

def _make_429(request: Request, window: int) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid4()))
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "message": "Too many requests. Please try again later.",
            "error": {
                "code": "RATE_LIMITED",
                "details": {"request_id": request_id, "retry_after_seconds": window},
            },
        },
        headers={"Retry-After": str(window), "X-Request-ID": request_id},
    )


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ---------------------------------------------------------------------------
# Auth rate limit (POST /api/v1/auth/*)
# ---------------------------------------------------------------------------


class AuthRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:
        super().__init__(app)
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method.upper() != "POST" or not request.url.path.startswith("/api/v1/auth/"):
            return await call_next(request)

        limit = settings.AUTH_RATE_LIMIT_MAX_REQUESTS
        window = settings.AUTH_RATE_LIMIT_WINDOW_SECONDS
        ip = _client_ip(request)
        key = f"rl:auth:{ip}:{request.url.path}"

        allowed = await _redis_sliding_window(key, limit, window)

        if allowed is None:
            # In-memory fallback
            now = time.time()
            hits = self._hits[key]
            while hits and now - hits[0] > window:
                hits.popleft()
            if len(hits) >= limit:
                return _make_429(request, window)
            hits.append(now)
        elif not allowed:
            return _make_429(request, window)

        return await call_next(request)


# ---------------------------------------------------------------------------
# Mutation rate limit (POST/PATCH/PUT/DELETE outside auth)
# ---------------------------------------------------------------------------


class MutationRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:
        super().__init__(app)
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method.upper() not in {"POST", "PATCH", "PUT", "DELETE"}:
            return await call_next(request)
        if request.url.path.startswith("/api/v1/auth/"):
            return await call_next(request)

        limit = settings.MUTATION_RATE_LIMIT_MAX_REQUESTS
        window = settings.MUTATION_RATE_LIMIT_WINDOW_SECONDS
        ip = _client_ip(request)
        key = f"rl:mutation:{ip}"

        allowed = await _redis_sliding_window(key, limit, window)

        if allowed is None:
            now = time.time()
            hits = self._hits[key]
            while hits and now - hits[0] > window:
                hits.popleft()
            if len(hits) >= limit:
                return _make_429(request, window)
            hits.append(now)
        elif not allowed:
            return _make_429(request, window)

        return await call_next(request)
