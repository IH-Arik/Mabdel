from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import WebSocket


class RealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, conversation_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[conversation_id].add(websocket)

    async def disconnect(self, conversation_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.get(conversation_id)
            if not sockets:
                return
            sockets.discard(websocket)
            if not sockets:
                self._connections.pop(conversation_id, None)

    async def publish(self, conversation_id: str, event: str, data: dict) -> None:
        async with self._lock:
            sockets = list(self._connections.get(conversation_id, set()))
        stale: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json({"event": event, "channel": conversation_id, "data": data})
            except Exception:
                stale.append(socket)
        for socket in stale:
            await self.disconnect(conversation_id, socket)


conversation_realtime_hub = RealtimeHub()
inbox_realtime_hub = RealtimeHub()
