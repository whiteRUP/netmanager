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


async def _get(key: str, session: AsyncSession) -> str:
    r = await session.execute(select(AppConfig).where(AppConfig.key == key))
    row = r.scalar_one_or_none()
    return row.value if row else ""


async def _set(key: str, value: str, session: AsyncSession):
    r = await session.execute(select(AppConfig).where(AppConfig.key == key))
    row = r.scalar_one_or_none()
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
        "app_name":           await _get("app_name", session),
        "admin_username":     await _get("admin_username", session),
        "scan_network":       await _get("scan_network", session),
        "ping_interval":      int(await _get("ping_interval", session) or 60),
        "full_scan_interval": int(await _get("full_scan_interval", session) or 900),
    }


class ScanSettings(BaseModel):
    scan_network: str
    ping_interval: int
    full_scan_interval: int


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class AppNameChange(BaseModel):
    app_name: str


@router.put("/scan")
async def update_scan(
    data: ScanSettings,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    await _set("scan_network", data.scan_network, session)
    await _set("ping_interval", str(data.ping_interval), session)
    await _set("full_scan_interval", str(data.full_scan_interval), session)
    await session.commit()
    return {"ok": True}


@router.put("/password")
async def change_password(
    data: PasswordChange,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    stored = await _get("admin_password", session)
    if not bcrypt.checkpw(data.current_password.encode(), stored.encode()):
        raise HTTPException(400, "Current password is incorrect")
    if len(data.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    hashed = bcrypt.hashpw(data.new_password.encode(), bcrypt.gensalt()).decode()
    await _set("admin_password", hashed, session)
    await session.commit()
    return {"ok": True}


@router.put("/app-name")
async def change_app_name(
    data: AppNameChange,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    await _set("app_name", data.app_name, session)
    await session.commit()
    return {"ok": True}
