from fastapi import APIRouter, Depends
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio

from database import get_session
from models import ScanEvent
from routers.auth import get_current_user
from services import scanner

router = APIRouter()


@router.post("/trigger")
async def trigger_scan(
    scan_type: str = "ping",
    _: str = Depends(get_current_user)
):
    if scan_type == "full":
        asyncio.create_task(scanner.full_scan())
    else:
        asyncio.create_task(scanner.ping_scan())
    return {"ok": True, "started": scan_type}


@router.get("/status")
async def scan_status(_: str = Depends(get_current_user)):
    return {
        "running": scanner.is_scanning(),
        "last_scan": scanner.last_scan_time()
    }


@router.get("/history")
async def scan_history(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    result = await session.execute(
        select(ScanEvent).order_by(ScanEvent.started_at.desc()).limit(20))
    return result.scalars().all()
