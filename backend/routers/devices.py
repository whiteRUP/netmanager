from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, col
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, timezone
import json

from database import get_session
from models import Device, DeviceUpdate, PendingDevice, Alert, DeviceStatus
from routers.auth import get_current_user
from services.ws_manager import manager

router = APIRouter()


def _parse(d: Device) -> dict:
    r = d.model_dump()
    r["open_ports"]    = json.loads(d.open_ports)    if d.open_ports    else []
    r["mac_addresses"] = json.loads(d.mac_addresses) if d.mac_addresses else []
    # Ensure datetimes are ISO strings with timezone
    for field in ("first_seen", "last_seen", "last_changed"):
        val = r.get(field)
        if isinstance(val, datetime):
            r[field] = val.isoformat()
    return r


# ── STATS (before /{id}) ──────────────────────────────────────────
@router.get("/stats")
async def stats(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    result  = await session.execute(select(Device))
    devices = result.scalars().all()
    pending_r = await session.execute(
        select(PendingDevice).where(PendingDevice.status == "pending"))
    pending_count = len(pending_r.scalars().all())

    groups, vlans, types = {}, {}, {}
    for d in devices:
        g = d.group_name or "General"
        groups[g] = groups.get(g, 0) + 1
        if d.vlan:
            vlans[d.vlan] = vlans.get(d.vlan, 0) + 1
        t = d.device_type or "Unknown"
        types[t] = types.get(t, 0) + 1

    types = dict(sorted(types.items(), key=lambda x: -x[1]))

    recently_changed = sorted(
        [d for d in devices if d.last_changed],
        key=lambda d: d.last_changed,
        reverse=True
    )[:6]

    top_offline = sorted(
        [d for d in devices if d.status == "offline"],
        key=lambda d: (d.last_seen or d.first_seen)
    )[:6]

    def dev_mini(d):
        return {
            "id": d.id, "name": d.name, "ip": d.ip, "mac": d.mac,
            "status": d.status, "device_type": d.device_type, "icon": d.icon,
            "last_seen": d.last_seen.isoformat() if d.last_seen else None,
            "last_changed": d.last_changed.isoformat() if d.last_changed else None,
        }

    return {
        "total":            len(devices),
        "online":           sum(1 for d in devices if d.status == "online"),
        "offline":          sum(1 for d in devices if d.status == "offline"),
        "unknown":          sum(1 for d in devices if d.status == "unknown"),
        "verified":         sum(1 for d in devices if d.verified),
        "pending":          pending_count,
        "groups":           groups,
        "vlans":            vlans,
        "types":            types,
        "recently_changed": [dev_mini(d) for d in recently_changed],
        "top_offline":      [dev_mini(d) for d in top_offline],
    }


# ── ALERTS (before /{id}) ─────────────────────────────────────────
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
    rows = result.scalars().all()
    out = []
    for a in rows:
        d = a.model_dump()
        d["created_at"] = a.created_at.isoformat()
        out.append(d)
    return out


# read-all MUST be before /alerts/{id}/read
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


# ── PENDING (before /{id}) ────────────────────────────────────────
@router.get("/pending/list")
async def list_pending(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user)
):
    result = await session.execute(
        select(PendingDevice).where(PendingDevice.status == "pending"))
    out = []
    for p in result.scalars().all():
        d = p.model_dump()
        d["open_ports"] = json.loads(p.open_ports) if p.open_ports else []
        d["signals"]    = json.loads(p.signals)    if p.signals    else []
        d["first_seen"] = p.first_seen.isoformat()
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

    # Check if IP already exists
    existing = await session.execute(select(Device).where(Device.ip == p.ip))
    if existing.scalar_one_or_none():
        p.status = "approved"
        session.add(p)
        await session.commit()
        return {"ok": True, "message": "Device with this IP already exists"}

    d = Device(
        name=p.hostname or f"Device-{p.ip.split('.')[-1]}",
        ip=p.ip,
        mac=p.mac,
        hostname=p.hostname,
        manufacturer=p.manufacturer,
        device_type=p.detected_type or "Unknown",
        icon=p.suggested_icon or "❓",
        open_ports=p.open_ports,
        first_seen=p.first_seen,
        last_seen=datetime.now(timezone.utc),
        status=DeviceStatus.online,
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


# ── DEVICE LIST ───────────────────────────────────────────────────
@router.get("")
async def list_devices(
    search:     Optional[str]  = None,
    group_name: Optional[str]  = None,
    status:     Optional[str]  = None,
    vlan:       Optional[str]  = None,
    verified:   Optional[bool] = None,
    device_type:Optional[str]  = None,
    session:    AsyncSession   = Depends(get_session),
    _:          str            = Depends(get_current_user)
):
    q = select(Device)
    if search:
        q = q.where(
            col(Device.name).contains(search) |
            col(Device.ip).contains(search)   |
            col(Device.mac).contains(search)  |
            col(Device.hostname).contains(search)
        )
    if group_name:   q = q.where(Device.group_name == group_name)
    if status:       q = q.where(Device.status == status)
    if vlan:         q = q.where(Device.vlan == vlan)
    if device_type:  q = q.where(Device.device_type == device_type)
    if verified is not None:
        q = q.where(Device.verified == verified)
    result = await session.execute(q)
    return [_parse(d) for d in result.scalars().all()]


# ── SINGLE DEVICE CRUD — always LAST ─────────────────────────────
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
    data = update.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(d, k, v)
    d.last_changed = datetime.now(timezone.utc)
    session.add(d)
    await session.commit()
    await session.refresh(d)
    out = _parse(d)
    await manager.broadcast({"event": "device_updated", "device": out})
    return out


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
    await manager.broadcast({"event": "device_verified", "device_id": device_id})
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
