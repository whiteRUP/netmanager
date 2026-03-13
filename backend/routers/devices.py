from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, col
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime
import json

from database import get_session
from models import Device, DeviceUpdate, PendingDevice, Alert
from routers.auth import get_current_user
from services.ws_manager import manager

router = APIRouter()


def _parse(d: Device) -> dict:
    r = d.dict()
    r["open_ports"] = json.loads(d.open_ports) if d.open_ports else []
    r["mac_addresses"] = json.loads(d.mac_addresses) if d.mac_addresses else []
    return r


@router.get("")
async def list_devices(
    search: Optional[str] = None,
    group_name: Optional[str] = None,
    status: Optional[str] = None,
    vlan: Optional[str] = None,
    verified: Optional[bool] = None,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    q = select(Device)
    if search:
        q = q.where(
            col(Device.name).contains(search) |
            col(Device.ip).contains(search) |
            col(Device.mac).contains(search)
        )
    if group_name:
        q = q.where(Device.group_name == group_name)
    if status:
        q = q.where(Device.status == status)
    if vlan:
        q = q.where(Device.vlan == vlan)
    if verified is not None:
        q = q.where(Device.verified == verified)
    result = await session.execute(q)
    return [_parse(d) for d in result.scalars().all()]


@router.get("/stats")
async def stats(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    result = await session.execute(select(Device))
    devices = result.scalars().all()
    pending = await session.execute(
        select(PendingDevice).where(PendingDevice.status == "pending"))
    groups, vlans = {}, {}
    for d in devices:
        g = d.group_name or "General"
        groups[g] = groups.get(g, 0) + 1
        if d.vlan:
            vlans[d.vlan] = vlans.get(d.vlan, 0) + 1
    return {
        "total": len(devices),
        "online": sum(1 for d in devices if d.status == "online"),
        "offline": sum(1 for d in devices if d.status == "offline"),
        "verified": sum(1 for d in devices if d.verified),
        "pending": len(pending.scalars().all()),
        "groups": groups,
        "vlans": vlans,
    }


@router.get("/alerts")
async def get_alerts(
    unread_only: bool = False,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    q = select(Alert)
    if unread_only:
        q = q.where(Alert.read == False)
    q = q.order_by(Alert.created_at.desc()).limit(100)
    result = await session.execute(q)
    return result.scalars().all()


@router.post("/alerts/{alert_id}/read")
async def mark_read(
    alert_id: int,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    a = await session.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "Alert not found")
    a.read = True
    session.add(a)
    await session.commit()
    return {"ok": True}


@router.post("/alerts/read-all")
async def mark_all_read(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    result = await session.execute(select(Alert).where(Alert.read == False))
    for a in result.scalars().all():
        a.read = True
        session.add(a)
    await session.commit()
    return {"ok": True}


@router.get("/{device_id}")
async def get_device(
    device_id: int,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    d = await session.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Device not found")
    return _parse(d)


@router.patch("/{device_id}")
async def update_device(
    device_id: int,
    update: DeviceUpdate,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    d = await session.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Device not found")
    for k, v in update.dict(exclude_unset=True).items():
        setattr(d, k, v)
    d.last_changed = datetime.utcnow()
    session.add(d)
    await session.commit()
    await session.refresh(d)
    data = _parse(d)
    await manager.broadcast({"event": "device_updated", "device": data})
    return data


@router.post("/{device_id}/verify")
async def verify_device(
    device_id: int,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    d = await session.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Device not found")
    d.verified = True
    d.last_changed = datetime.utcnow()
    session.add(d)
    await session.commit()
    return {"ok": True}


@router.delete("/{device_id}")
async def delete_device(
    device_id: int,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    d = await session.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Device not found")
    await session.delete(d)
    await session.commit()
    await manager.broadcast({"event": "device_deleted", "device_id": device_id})
    return {"ok": True}


# ── Discovery queue ───────────────────────────────────────────────

@router.get("/pending/list")
async def list_pending(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    result = await session.execute(
        select(PendingDevice).where(PendingDevice.status == "pending"))
    out = []
    for p in result.scalars().all():
        d = p.dict()
        d["open_ports"] = json.loads(p.open_ports) if p.open_ports else []
        d["signals"] = json.loads(p.signals) if p.signals else []
        out.append(d)
    return out


@router.post("/pending/{pending_id}/approve")
async def approve_pending(
    pending_id: int,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    p = await session.get(PendingDevice, pending_id)
    if not p:
        raise HTTPException(404, "Not found")
    d = Device(
        name=p.hostname or f"Device-{p.ip.split('.')[-1]}",
        ip=p.ip, mac=p.mac,
        manufacturer=p.manufacturer,
        device_type=p.detected_type or "Unknown",
        hostname=p.hostname,
        open_ports=p.open_ports,
        first_seen=p.first_seen,
        last_seen=datetime.utcnow(),
        status="online"
    )
    session.add(d)
    p.status = "approved"
    session.add(p)
    await session.commit()
    await session.refresh(d)
    data = _parse(d)
    await manager.broadcast({"event": "device_approved", "device": data})
    return data


@router.post("/pending/{pending_id}/reject")
async def reject_pending(
    pending_id: int,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    p = await session.get(PendingDevice, pending_id)
    if not p:
        raise HTTPException(404, "Not found")
    p.status = "rejected"
    session.add(p)
    await session.commit()
    return {"ok": True}
