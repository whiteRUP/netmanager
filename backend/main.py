from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from database import init_db
from routers import setup, auth, devices, integrations, scan, settings, ws

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Start scheduler only if setup is already complete
    try:
        from database import AsyncSessionLocal
        from models import AppConfig
        from sqlmodel import select
        async with AsyncSessionLocal() as session:
            r = await session.execute(select(AppConfig).where(AppConfig.key == "setup_complete"))
            row = r.scalar_one_or_none()
            if row and row.value == "true":
                from services.scheduler import start_scheduler
                await start_scheduler()
                logger.info("Scheduler started at boot")
            else:
                logger.info("Setup not complete — scheduler not started")
    except Exception as e:
        logger.warning(f"Scheduler boot check failed: {e}")
    yield
    try:
        from services.scheduler import stop_scheduler
        await stop_scheduler()
    except Exception:
        pass


app = FastAPI(title="NetManager", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(setup.router,        prefix="/api/setup")
app.include_router(auth.router,         prefix="/api/auth")
app.include_router(devices.router,      prefix="/api/devices")
app.include_router(integrations.router, prefix="/api/integrations")
app.include_router(scan.router,         prefix="/api/scan")
app.include_router(settings.router,     prefix="/api/settings")
app.include_router(ws.router,           prefix="/ws")


@app.get("/api/health")
async def health():
    return {"ok": True}
