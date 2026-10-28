from __future__ import annotations

import asyncio

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.core.database import MongoConnectionManager

# Regression for R05: Celery tasks that call asyncio.run(...) get a brand new
# event loop per invocation, which is closed by the time the next invocation
# runs. MongoConnectionManager is a module-level singleton shared by every
# caller, so a client created on run N's loop used to be cached and handed to
# run N+1 unchanged - a query against it then raised "Event loop is closed"
# even though nothing about the database itself had actually failed.


def test_connect_reconnects_when_the_running_loop_has_changed(monkeypatch):
    created_clients: list[object] = []

    def fake_client(*args, **kwargs):
        client = AsyncMongoMockClient()
        created_clients.append(client)
        return client

    import app.core.database as database_module
    monkeypatch.setattr(database_module, "AsyncIOMotorClient", fake_client)

    manager = MongoConnectionManager()

    first_db = asyncio.run(manager.connect())
    assert first_db is not None
    assert len(created_clients) == 1
    first_client = manager.client

    # A second asyncio.run() is a brand new, independent event loop - the real-world
    # equivalent of the next Celery task invocation in the same prefork worker.
    second_db = asyncio.run(manager.connect())
    assert second_db is not None
    assert len(created_clients) == 2, "the stale client bound to the first (now-closed) loop must be discarded, not reused"
    assert manager.client is not first_client


def test_connect_does_not_reconnect_within_the_same_loop(monkeypatch):
    created_clients: list[object] = []

    def fake_client(*args, **kwargs):
        client = AsyncMongoMockClient()
        created_clients.append(client)
        return client

    import app.core.database as database_module
    monkeypatch.setattr(database_module, "AsyncIOMotorClient", fake_client)

    manager = MongoConnectionManager()

    async def _connect_twice():
        await manager.connect()
        await manager.connect()

    asyncio.run(_connect_twice())
    assert len(created_clients) == 1, "the cached client must be reused for calls within the same loop"


def test_connect_adopts_a_database_assigned_without_going_through_connect(monkeypatch):
    """A test fixture (or any caller) can assign .database directly, bypassing
    connect() entirely, so _loop is never set. The first connect() call in that
    loop must adopt it rather than treating the never-set _loop as a dead loop
    and discarding a perfectly valid client - this is exactly how this repo's
    own `mock_db` test fixture wires up mongomock."""
    created_clients: list[object] = []

    def fake_client(*args, **kwargs):
        client = AsyncMongoMockClient()
        created_clients.append(client)
        return client

    import app.core.database as database_module
    monkeypatch.setattr(database_module, "AsyncIOMotorClient", fake_client)

    manager = MongoConnectionManager()
    preassigned = AsyncMongoMockClient()
    manager.client = preassigned
    manager.database = preassigned["preassigned_db"]

    result = asyncio.run(manager.connect())

    assert result is manager.database
    assert manager.client is preassigned
    assert created_clients == [], "a pre-assigned database must never be discarded on its first connect() call"
