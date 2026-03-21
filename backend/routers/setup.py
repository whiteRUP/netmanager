from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import secrets, bcrypt

from database import get_session
from models import AppConfig

router = APIRouter()


async def _cfg(key: str, session: AsyncSession) -> Optional[str]:
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


@router.get("/status")
async def setup_status(session: AsyncSession = Depends(get_session)):
    done = await _cfg("setup_complete", session)
    app_name = await _cfg("app_name", session) or "NetManager"
    return {"setup_complete": done == "true", "app_name": app_name}


class SetupInit(BaseModel):
    username:   str
    password:   str
    app_name:   str = "NetManager"
    scan_network: str = "192.168.1.0/24"


@router.post("/init")
async def setup_init(body: SetupInit, session: AsyncSession = Depends(get_session)):
    if await _cfg("setup_complete", session) == "true":
        raise HTTPException(409, "Setup already complete")

    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    jwt_secret = secrets.token_hex(32)

    for k, v in [
        ("setup_complete",   "true"),
        ("admin_username",   body.username),
        ("admin_password",   hashed),
        ("jwt_secret",       jwt_secret),
        ("app_name",         body.app_name),
        ("scan_network",     body.scan_network),
        ("ping_interval",    "60"),
        ("full_scan_interval", "900"),
    ]:
        await _set(k, v, session)

    await session.commit()

    try:
        from services.scheduler import start_scheduler
        await start_scheduler()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Scheduler start after setup: {e}")

    return {"ok": True, "message": "Setup complete. You can now log in."}
