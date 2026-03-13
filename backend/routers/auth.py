from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from datetime import datetime, timedelta
from pydantic import BaseModel
import bcrypt

from database import get_session
from models import AppConfig
from config import settings

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


async def _get(key: str, session: AsyncSession) -> str:
    result = await session.execute(select(AppConfig).where(AppConfig.key == key))
    row = result.scalar_one_or_none()
    return row.value if row else ""


class Token(BaseModel):
    access_token: str
    token_type: str
    username: str


def _make_token(username: str, secret: str, expire_hours: int = 24) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=expire_hours)
    return jwt.encode(
        {"sub": username, "exp": expire},
        secret,
        algorithm=settings.jwt_algorithm
    )


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session)
) -> str:
    secret = await _get("jwt_secret", session)
    if not secret:
        raise HTTPException(status_code=503, detail="App not configured")
    try:
        payload = jwt.decode(token, secret, algorithms=[settings.jwt_algorithm])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session)
):
    stored_username = await _get("admin_username", session)
    stored_password = await _get("admin_password", session)
    jwt_secret      = await _get("jwt_secret", session)

    if not stored_username:
        raise HTTPException(status_code=503, detail="Setup not completed")

    if form_data.username != stored_username or \
       not _verify_password(form_data.password, stored_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    token = _make_token(form_data.username, jwt_secret)
    return {"access_token": token, "token_type": "bearer", "username": form_data.username}


@router.get("/me")
async def me(current_user: str = Depends(get_current_user)):
    return {"username": current_user}
