from __future__ import annotations

import asyncio
from collections import defaultdict
from collections.abc import Awaitable, Callable

from bson import ObjectId
from fastapi.encoders import jsonable_encoder
from fastapi import WebSocket


class RealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._socket_users: dict[WebSocket, str] = {}
        self._lock = asyncio.Lock()

    async def connect(self, conversation_id: str, websocket: WebSocket, user_id: str | None = None) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[conversation_id].add(websocket)
            if user_id:
                self._socket_users[websocket] = user_id

    async def disconnect(self, conversation_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.get(conversation_id)
            if not sockets:
                return
            sockets.discard(websocket)
            self._socket_users.pop(websocket, None)
            if not sockets:
                self._connections.pop(conversation_id, None)

    async def disconnect_user(self, conversation_id: str, user_id: str) -> None:
        async with self._lock:
            sockets = list(self._connections.get(conversation_id, set()))
            targets = [socket for socket in sockets if self._socket_users.get(socket) == user_id]
        for socket in targets:
            try:
                await socket.close(code=1008, reason="Access revoked")
            except Exception:
                pass
            await self.disconnect(conversation_id, socket)

    async def publish(self, conversation_id: str, event: str, data: dict) -> None:
        async with self._lock:
            sockets = list(self._connections.get(conversation_id, set()))
        payload = jsonable_encoder(
            {"event": event, "channel": conversation_id, "data": data},
            custom_encoder={ObjectId: str},
        )
        stale: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:
                stale.append(socket)
        for socket in stale:
            await self.disconnect(conversation_id, socket)

    async def publish_per_viewer(
        self, conversation_id: str, event: str, build_data: Callable[[str | None], Awaitable[dict]]
    ) -> None:
        """Like publish, but re-serializes the payload once per distinct connected
        viewer instead of broadcasting one shared payload to everyone. Needed for
        anything whose correctness depends on who's looking at it — e.g. a message's
        sender_is_self flag, fixed at serialization time, was previously always
        computed from the SENDER's own point of view (since publish() was only ever
        called with a single, sender-serialized payload) and broadcast unchanged to
        every other participant, making their own messages appear to be the
        recipient's."""
        async with self._lock:
            sockets = list(self._connections.get(conversation_id, set()))
        stale: list[WebSocket] = []
        cache: dict[str | None, dict] = {}
        for socket in sockets:
            viewer_user_id = self._socket_users.get(socket)
            if viewer_user_id not in cache:
                cache[viewer_user_id] = await build_data(viewer_user_id)
            payload = jsonable_encoder(
                {"event": event, "channel": conversation_id, "data": cache[viewer_user_id]},
                custom_encoder={ObjectId: str},
            )
            try:
                await socket.send_json(payload)
            except Exception:
                stale.append(socket)
        for socket in stale:
            await self.disconnect(conversation_id, socket)


conversation_realtime_hub = RealtimeHub()
inbox_realtime_hub = RealtimeHub()
