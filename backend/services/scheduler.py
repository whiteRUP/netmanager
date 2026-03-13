from apscheduler.schedulers.asyncio import AsyncIOScheduler
import logging

logger    = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def start_scheduler():
    if scheduler.running:
        logger.info("Scheduler already running — skipping start")
        return

    from services.scanner import ping_scan, full_scan
    from database import AsyncSessionLocal
    from models import AppConfig
    from sqlmodel import select

    async with AsyncSessionLocal() as session:
        r  = await session.execute(select(AppConfig).where(AppConfig.key == "ping_interval"))
        r2 = await session.execute(select(AppConfig).where(AppConfig.key == "full_scan_interval"))
        ping_row = r.scalar_one_or_none()
        full_row = r2.scalar_one_or_none()

    ping_sec = int(ping_row.value) if ping_row else 60
    full_sec = int(full_row.value) if full_row else 900

    scheduler.add_job(ping_scan, "interval", seconds=ping_sec,
                      id="ping_scan", max_instances=1, coalesce=True)
    scheduler.add_job(full_scan,  "interval", seconds=full_sec,
                      id="full_scan",  max_instances=1, coalesce=True)
    scheduler.start()
    logger.info(f"Scheduler started — ping/{ping_sec}s  full/{full_sec}s")


async def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
