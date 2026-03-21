from fastapi import WebSocket
from typing import List
import json, logging

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)
        logger.info(f"WS connected — {len(self.connections)} total")

    def disconnect(self, ws: WebSocket):
        self.connections = [c for c in self.connections if c is not ws]
        logger.info(f"WS disconnected — {len(self.connections)} total")

    async def broadcast(self, data: dict):
        dead = []
        msg = json.dumps(data, default=str)
        for ws in self.connections:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = WebSocketManager()
