from __future__ import annotations

import asyncio
import time

import redis.asyncio as aioredis

from app.core import http as http_module
from app.core.http import _get_redis as _real_get_redis  # captured before the
# session-wide autouse fixture in conftest.py replaces http_module._get_redis
# for test hermeticity - these tests specifically exercise the real function.

# Regression coverage for two real resilience gaps in the Redis-backed rate
# limiter/RBAC cache: a failed first connection attempt was cached forever
# (Redis coming back up never restored shared rate limiting without a
# redeploy), and a transient per-operation Redis error unconditionally
# ALLOWED the request - bypassing both Redis and the in-memory fallback for
# that one check, a real fail-open on a security control.


def test_a_failed_connection_is_retried_after_the_cooldown_not_cached_forever(monkeypatch):
    monkeypatch.setattr(http_module, "_redis", None)
    monkeypatch.setattr(http_module, "_redis_last_attempt", time.time())  # "just failed"

    attempts = {"n": 0}

    def fake_from_url(*args, **kwargs):
        # aioredis.from_url is a plain (non-async) constructor in the real code -
        # the actual connection failure surfaces later on `await client.ping()`.
        attempts["n"] += 1
        raise ConnectionError("still down")

    monkeypatch.setattr(aioredis, "from_url", fake_from_url)

    # Immediately after a failure, within the cooldown window: no retry yet.
    asyncio.run(_real_get_redis())
    assert attempts["n"] == 0, "must not retry before the cooldown elapses"

    # Cooldown elapsed: a real reconnect attempt must happen.
    monkeypatch.setattr(
        http_module, "_redis_last_attempt", time.time() - (http_module._REDIS_RETRY_COOLDOWN_SECONDS + 1)
    )
    asyncio.run(_real_get_redis())
    assert attempts["n"] == 1, "a failed connection must not be cached permanently - it must retry after the cooldown"


def test_a_transient_operation_error_degrades_to_in_memory_instead_of_allowing_unconditionally(monkeypatch):
    class _FailingPipeline:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc_info):
            return False

        def zremrangebyscore(self, *args, **kwargs):
            pass

        def zcard(self, *args, **kwargs):
            pass

        def zadd(self, *args, **kwargs):
            pass

        def expire(self, *args, **kwargs):
            pass

        async def execute(self):
            raise ConnectionError("connection reset mid-command")

    class _FailingClient:
        def pipeline(self, transaction=True):
            return _FailingPipeline()

    failing_client = _FailingClient()

    async def _return_failing_client():
        return failing_client

    # _redis_sliding_window calls the module-global _get_redis by name at
    # runtime - overriding it here (restored by monkeypatch after the test,
    # back to whatever conftest's autouse fixture set it to) lets this test
    # drive _redis_sliding_window's OWN exception-handling logic directly.
    monkeypatch.setattr(http_module, "_get_redis", _return_failing_client)
    monkeypatch.setattr(http_module, "_redis", failing_client)

    result = asyncio.run(http_module._redis_sliding_window("rl:test:key", limit=1, window=60))

    assert result is None, (
        "a transient Redis error must degrade to the in-memory fallback (None), "
        "not unconditionally allow the request (True) - that bypasses rate limiting entirely"
    )
    assert http_module._redis is None, "the broken client must be dropped so a later call can reconnect"
