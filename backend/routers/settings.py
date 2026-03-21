from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import bcrypt

from database import get_session
from models import AppConfig
from routers.auth import get_current_user

router = APIRouter()


async def _get(key: str, session: AsyncSession) -> Optional[str]:
    r = await session.execute(select(AppConfig).where(AppConfig.key == key))
    row = r.scalar_one_or_none()
    return row.value if row else None


async def _set(key: str, value: str, session: AsyncSession):
    row = await session.get(AppConfig, key)
    if row:
        row.value = value
        row.updated_at = datetime.now(timezone.utc)
    else:
        row = AppConfig(key=key, value=value)
    session.add(row)


@router.get("")
async def get_settings(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    return {
        "app_name":           await _get("app_name", session) or "NetManager",
        "scan_network":       await _get("scan_network", session) or "192.168.1.0/24",
        "ping_interval":      int(await _get("ping_interval", session) or 60),
        "full_scan_interval": int(await _get("full_scan_interval", session) or 900),
    }


class ScanSettings(BaseModel):
    scan_network:       str
    ping_interval:      int
    full_scan_interval: int


@router.put("/scan")
async def update_scan_settings(
    body: ScanSettings,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    await _set("scan_network",       body.scan_network,             session)
    await _set("ping_interval",      str(body.ping_interval),       session)
    await _set("full_scan_interval", str(body.full_scan_interval),  session)
    await session.commit()

    # Reschedule with new intervals
    try:
        from services.scheduler import reschedule
        await reschedule(body.ping_interval, body.full_scan_interval)
    except Exception:
        pass

    return {"ok": True}


class AppNameUpdate(BaseModel):
    app_name: str


@router.put("/app-name")
async def update_app_name(
    body: AppNameUpdate,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    await _set("app_name", body.app_name, session)
    await session.commit()
    return {"ok": True}


class PasswordChange(BaseModel):
    current_password: str
    new_password:     str


@router.put("/password")
async def change_password(
    body: PasswordChange,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    stored = await _get("admin_password", session)
    if not stored or not bcrypt.checkpw(body.current_password.encode(), stored.encode()):
        raise HTTPException(400, "Current password incorrect")
    hashed = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    await _set("admin_password", hashed, session)
    await session.commit()
    return {"ok": True}
