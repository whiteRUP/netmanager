from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.ws_manager import manager

router = APIRouter()


@router.websocket("/events")
async def ws_events(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
