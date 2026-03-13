from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from database import init_db
from services.scheduler import start_scheduler, stop_scheduler
from routers import setup, auth, devices, integrations, scan, settings, ws

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("NetManager starting...")
    await init_db()

    # Ensure integrations.json exists
    from routers.integrations import _ensure_config
    _ensure_config()

    # Start scheduler only if setup is complete
    from database import AsyncSessionLocal
    from models import AppConfig
    from sqlmodel import select
    async with AsyncSessionLocal() as session:
        r = await session.execute(
            select(AppConfig).where(AppConfig.key == "setup_complete"))
        row = r.scalar_one_or_none()
        if row and row.value == "true":
            await start_scheduler()
            logger.info("Scheduler started")
        else:
            logger.info("Setup not complete — scheduler not started")

    yield
    await stop_scheduler()
    logger.info("NetManager stopped")


app = FastAPI(
    title="NetManager API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup is PUBLIC — no auth
app.include_router(setup.router,        prefix="/setup",        tags=["Setup"])

# Everything else requires auth
app.include_router(auth.router,         prefix="/auth",         tags=["Auth"])
app.include_router(devices.router,      prefix="/devices",      tags=["Devices"])
app.include_router(integrations.router, prefix="/integrations", tags=["Integrations"])
app.include_router(scan.router,         prefix="/scan",         tags=["Scan"])
app.include_router(settings.router,     prefix="/settings",     tags=["Settings"])
app.include_router(ws.router,           prefix="/ws",           tags=["WebSocket"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
