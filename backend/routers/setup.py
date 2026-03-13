"""
Setup router — handles first-run wizard.
All endpoints here require NO authentication.
Once setup is complete, /setup/init returns 409 and is locked forever.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import BaseModel
from passlib.context import CryptContext
from datetime import datetime
import secrets

from database import get_session
from models import AppConfig

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def _get_config(key: str, session: AsyncSession) -> Optional[str]:
    result = await session.execute(select(AppConfig).where(AppConfig.key == key))
    row = result.scalar_one_or_none()
    return row.value if row else None


async def _set_config(key: str, value: str, session: AsyncSession):
    existing = await session.execute(select(AppConfig).where(AppConfig.key == key))
    row = existing.scalar_one_or_none()
    if row:
        row.value = value
        row.updated_at = datetime.utcnow()
    else:
        row = AppConfig(key=key, value=value)
    session.add(row)


from typing import Optional


@router.get("/status")
async def setup_status(session: AsyncSession = Depends(get_session)):
    """Frontend checks this on every load to decide: show setup wizard or login."""
    result = await session.execute(
        select(AppConfig).where(AppConfig.key == "setup_complete")
    )
    row = result.scalar_one_or_none()
    complete = row is not None and row.value == "true"
    return {"setup_complete": complete}


class SetupPayload(BaseModel):
    username: str
    password: str
    app_name: str = "NetManager"
    scan_network: str = "192.168.1.0/24"
    ping_interval: int = 60
    full_scan_interval: int = 900


@router.post("/init")
async def setup_init(
    payload: SetupPayload,
    session: AsyncSession = Depends(get_session)
):
    """One-time setup. Locked after first call."""
    # Check not already set up
    result = await session.execute(
        select(AppConfig).where(AppConfig.key == "setup_complete")
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Setup already completed")

    if len(payload.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Generate a random JWT secret
    jwt_secret = secrets.token_hex(32)

    configs = {
        "setup_complete":    "true",
        "admin_username":    payload.username,
        "admin_password":    pwd_context.hash(payload.password),
        "jwt_secret":        jwt_secret,
        "app_name":          payload.app_name,
        "scan_network":      payload.scan_network,
        "ping_interval":     str(payload.ping_interval),
        "full_scan_interval": str(payload.full_scan_interval),
    }

    for key, value in configs.items():
        await _set_config(key, value, session)

    await session.commit()
    return {"ok": True, "message": "Setup complete. You can now log in."}
