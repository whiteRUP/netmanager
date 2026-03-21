from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from datetime import datetime, timezone

from database import get_session
from models import ScanEvent
from routers.auth import get_current_user

router = APIRouter()


@router.post("/trigger")
async def trigger_scan(
    scan_type: str = "ping",
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    import asyncio
    from services import scanner

    if scan_type == "full":
        asyncio.create_task(scanner.full_scan())
    else:
        asyncio.create_task(scanner.ping_scan())

    return {"ok": True, "scan_type": scan_type}


@router.get("/status")
async def scan_status(_: str = Depends(get_current_user)):
    from services.scanner import last_scan_time
    return {"last_scan": last_scan_time()}


@router.get("/history")
async def scan_history(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    result = await session.execute(
        select(ScanEvent).order_by(ScanEvent.started_at.desc()).limit(20))
    rows = result.scalars().all()
    out = []
    for s in rows:
        d = s.model_dump()
        d["started_at"]   = s.started_at.isoformat()
        d["completed_at"] = s.completed_at.isoformat() if s.completed_at else None
        out.append(d)
    return out
