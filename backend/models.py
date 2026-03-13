from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


def utcnow():
    """Return timezone-aware UTC datetime so JSON serialises with +00:00."""
    return datetime.now(timezone.utc)


# ── App Config ────────────────────────────────────────────────────
class AppConfig(SQLModel, table=True):
    key:        str      = Field(primary_key=True)
    value:      str
    updated_at: datetime = Field(default_factory=utcnow)


# ── Device ────────────────────────────────────────────────────────
class DeviceStatus(str, Enum):
    online  = "online"
    offline = "offline"
    unknown = "unknown"


class IPType(str, Enum):
    static   = "static"
    reserved = "reserved"
    dynamic  = "dynamic"
    conflict = "conflict"
    unknown  = "unknown"


class Device(SQLModel, table=True):
    id:              Optional[int]   = Field(default=None, primary_key=True)
    name:            str
    ip:              str
    mac:             str
    hostname:        Optional[str]   = None
    manufacturer:    Optional[str]   = None
    device_type:     Optional[str]   = "Unknown"
    icon:            Optional[str]   = "❓"
    os:              Optional[str]   = None
    location:        Optional[str]   = None
    group_name:      Optional[str]   = "General"
    vlan:            Optional[str]   = None
    ip_type:         IPType          = IPType.unknown
    status:          DeviceStatus    = DeviceStatus.unknown
    verified:        bool            = False
    notes:           Optional[str]   = None
    open_ports:      Optional[str]   = None   # JSON: [80, 443]
    mac_addresses:   Optional[str]   = None   # JSON: [{mac, tag}]
    tailscale_ip:    Optional[str]   = None
    first_seen:      datetime        = Field(default_factory=utcnow)
    last_seen:       Optional[datetime] = None
    last_changed:    Optional[datetime] = None
    uptime_percent:  Optional[float] = None
    response_time_ms:Optional[float] = None


class DeviceUpdate(SQLModel):
    name:        Optional[str]    = None
    device_type: Optional[str]    = None
    icon:        Optional[str]    = None
    manufacturer:Optional[str]    = None
    os:          Optional[str]    = None
    location:    Optional[str]    = None
    group_name:  Optional[str]    = None
    vlan:        Optional[str]    = None
    ip_type:     Optional[IPType] = None
    verified:    Optional[bool]   = None
    notes:       Optional[str]    = None


# ── Discovery ─────────────────────────────────────────────────────
class PendingDevice(SQLModel, table=True):
    id:            Optional[int] = Field(default=None, primary_key=True)
    ip:            str
    mac:           str
    manufacturer:  Optional[str] = None
    hostname:      Optional[str] = None
    open_ports:    Optional[str] = None
    detected_type: Optional[str] = None
    confidence:    int           = 0
    signals:       Optional[str] = None
    first_seen:    datetime      = Field(default_factory=utcnow)
    status:        str           = "pending"  # pending|approved|rejected


# ── Scan History ──────────────────────────────────────────────────
class ScanEvent(SQLModel, table=True):
    id:            Optional[int]      = Field(default=None, primary_key=True)
    started_at:    datetime           = Field(default_factory=utcnow)
    completed_at:  Optional[datetime] = None
    scan_type:     str                = "ping"
    devices_found: int                = 0
    new_devices:   int                = 0
    status:        str                = "running"
    error:         Optional[str]      = None


# ── Alerts ────────────────────────────────────────────────────────
class Alert(SQLModel, table=True):
    id:         Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime      = Field(default_factory=utcnow)
    level:      str           = "info"   # info|warning|critical
    title:      str
    message:    str
    device_id:  Optional[int] = None
    read:       bool          = False
