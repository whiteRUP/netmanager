from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import select, col
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, timezone
import json

from database import get_session
from models import Device, DeviceUpdate, PendingDevice, Alert
from routers.auth import get_current_user
from services.ws_manager import manager

router = APIRouter()


def _parse(d: Device) -> dict:
    r = d.dict()
    r["open_ports"]    = json.loads(d.open_ports)    if d.open_ports    else []
    r["mac_addresses"] = json.loads(d.mac_addresses) if d.mac_addresses else []
    return r


# ── Device list & stats ───────────────────────────────────────────
# NOTE: specific paths MUST come before /{device_id} or FastAPI
# will try to cast the path segment to int and return 422.

@router.get("")
async def list_devices(
    search:     Optional[str]  = None,
    group_name: Optional[str]  = None,
    status:     Optional[str]  = None,
    vlan:       Optional[str]  = None,
    verified:   Optional[bool] = None,
    session:    AsyncSession   = Depends(get_session),
    _:          str            = Depends(get_current_user)
):
    q = select(Device)
    if search:
        q = q.where(
            col(Device.name).contains(search) |
            col(Device.ip).contains(search) |
            col(Device.mac).contains(search)
        )
    if group_name: q = q.where(Device.group_name == group_name)
    if status:     q = q.where(Device.status == status)
    if vlan:       q = q.where(Device.vlan == vlan)
    if verified is not None:
        q = q.where(Device.verified == verified)
    result = await session.execute(q)
    return [_parse(d) for d in result.scalars().all()]


@router.get("/stats")
async def stats(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    result  = await session.execute(select(Device))
    devices = result.scalars().all()
    pending = await session.execute(
        select(PendingDevice).where(PendingDevice.status == "pending"))
    groups, vlans, types = {}, {}, {}
    for d in devices:
        g = d.group_name or "General"
        groups[g] = groups.get(g, 0) + 1
        if d.vlan:
            vlans[d.vlan] = vlans.get(d.vlan, 0) + 1
        t = d.device_type or "Unknown"
        types[t] = types.get(t, 0) + 1
    # Sort types by count descending
    types = dict(sorted(types.items(), key=lambda x: -x[1]))
    # Recently changed status (last 5)
    recently_changed = sorted(
        [d for d in devices if d.last_changed],
        key=lambda d: d.last_changed, reverse=True
    )[:5]
    recently_changed_data = [
        {"id": d.id, "name": d.name, "ip": d.ip, "status": d.status,
         "icon": d.icon or "❓", "last_changed": d.last_changed.isoformat() if d.last_changed else None}
        for d in recently_changed
    ]
    # Top offline: sorted by longest absent first
    top_offline = sorted(
        [d for d in devices if d.status == "offline"],
        key=lambda d: (d.last_seen or d.first_seen)
    )[:5]
    top_offline_data = [
        {"id": d.id, "name": d.name, "ip": d.ip, "status": "offline",
         "icon": d.icon or "❓", "last_seen": d.last_seen.isoformat() if d.last_seen else None}
        for d in top_offline
    ]

    return {
        "total":            len(devices),
        "online":           sum(1 for d in devices if d.status == "online"),
        "offline":          sum(1 for d in devices if d.status == "offline"),
        "verified":         sum(1 for d in devices if d.verified),
        "unverified":       sum(1 for d in devices if not d.verified),
        "pending":          len(pending.scalars().all()),
        "groups":           groups,
        "vlans":            vlans,
        "types":            types,
        "recently_changed": recently_changed_data,
        "top_offline":      top_offline_data,
    }


# ── Alerts (before /{device_id}!) ────────────────────────────────

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


# read-all MUST come before /alerts/{alert_id}/read
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


# ── Discovery queue (before /{device_id}!) ───────────────────────

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
        d["signals"]    = json.loads(p.signals)    if p.signals    else []
        out.append(d)
    return out


class ApproveOverrides(BaseModel):
    name:        Optional[str] = None
    device_type: Optional[str] = None
    icon:        Optional[str] = None
    group_name:  Optional[str] = None


@router.post("/pending/{pending_id}/approve")
async def approve_pending(
    pending_id: int,
    overrides:  ApproveOverrides = ApproveOverrides(),
    session:    AsyncSession = Depends(get_session),
    _:          str          = Depends(get_current_user)
):
    p = await session.get(PendingDevice, pending_id)
    if not p:
        raise HTTPException(404, "Not found")

    detected_icon = "❓"
    if overrides.device_type or p.detected_type:
        TYPE_ICONS = {
            "Router / AP":"📡","Switch":"🔀","PC / Laptop":"💻","Server / SBC":"🖥️",
            "Virtual Machine":"🖼️","Raspberry Pi":"🍓","IoT Device":"🔌","Home Assistant":"🏠",
            "IP Camera":"📷","NAS":"💾","Printer":"🖨️","Phone / Tablet":"📱",
            "Smart Speaker":"🔊","Media Player":"📺","Game Console":"🎮","Portainer":"🐳",
            "DNS Server":"🌐","Media Server":"🎬","UPS":"🔋","Linux Device":"🐧",
            "Windows Device":"🪟","Apple / macOS":"🍎",
        }
        dtype = overrides.device_type or p.detected_type or "Unknown"
        detected_icon = TYPE_ICONS.get(dtype, "❓")

    d = Device(
        name         = overrides.name or p.hostname or f"Device-{p.ip.split('.')[-1]}",
        ip           = p.ip,
        mac          = p.mac,
        manufacturer = p.manufacturer,
        device_type  = overrides.device_type or p.detected_type or "Unknown",
        icon         = overrides.icon or detected_icon,
        hostname     = p.hostname,
        open_ports   = p.open_ports,
        group_name   = overrides.group_name or "General",
        first_seen   = p.first_seen,
        last_seen    = datetime.now(timezone.utc),
        status       = "online"
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


# ── Single device CRUD (/{device_id} always LAST) ────────────────

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
    d.last_changed = datetime.now(timezone.utc)
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
    d.last_changed = datetime.now(timezone.utc)
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
