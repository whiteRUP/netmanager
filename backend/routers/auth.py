from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from typing import Optional
import bcrypt

from database import get_session
from models import AppConfig

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ALGORITHM = "HS256"
TOKEN_HOURS = 72


async def _get_secret(session: AsyncSession) -> str:
    r = await session.execute(select(AppConfig).where(AppConfig.key == "jwt_secret"))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(503, "App not configured")
    return row.value


def _make_token(username: str, secret: str, hours: int = TOKEN_HOURS) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=hours)
    return jwt.encode({"sub": username, "exp": expire}, secret, algorithm=ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session)
) -> str:
    credentials_error = HTTPException(401, "Invalid credentials", headers={"WWW-Authenticate": "Bearer"})
    try:
        secret = await _get_secret(session)
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if not username:
            raise credentials_error
        return username
    except JWTError:
        raise credentials_error


@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session)
):
    r = await session.execute(select(AppConfig).where(AppConfig.key == "admin_username"))
    u_row = r.scalar_one_or_none()
    r = await session.execute(select(AppConfig).where(AppConfig.key == "admin_password"))
    p_row = r.scalar_one_or_none()

    if not u_row or not p_row:
        raise HTTPException(503, "App not configured")

    if form_data.username != u_row.value:
        raise HTTPException(401, "Invalid username or password")

    if not bcrypt.checkpw(form_data.password.encode(), p_row.value.encode()):
        raise HTTPException(401, "Invalid username or password")

    secret = await _get_secret(session)
    token = _make_token(form_data.username, secret)
    return {"access_token": token, "token_type": "bearer"}


class MeOut(BaseModel):
    username: str

@router.get("/me", response_model=MeOut)
async def me(current_user: str = Depends(get_current_user)):
    return {"username": current_user}
