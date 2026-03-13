import asyncio, json, logging, subprocess
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)
_scanning = False
_last_scan: Optional[datetime] = None


def is_scanning() -> bool:
    return _scanning


def last_scan_time() -> Optional[str]:
    return _last_scan.isoformat() if _last_scan else None


def _mac_vendor(mac: str) -> str:
    try:
        import manuf
        return manuf.MacParser().get_manuf(mac) or "Unknown"
    except Exception:
        return "Unknown"


def _arp_scan(network: str) -> list:
    try:
        r = subprocess.run(
            ["arp-scan", "--localnet", "--quiet"],
            capture_output=True, text=True, timeout=30)
        devices = []
        for line in r.stdout.splitlines():
            parts = line.split("\t")
            if len(parts) >= 2 and ":" in parts[1]:
                devices.append({"ip": parts[0].strip(), "mac": parts[1].strip().lower()})
        return devices
    except Exception as e:
        logger.error(f"ARP scan error: {e}")
        return []


def _ping(ip: str) -> bool:
    try:
        r = subprocess.run(["ping", "-c", "1", "-W", "1", ip],
                           capture_output=True, timeout=3)
        return r.returncode == 0
    except Exception:
        return False


def _nmap_ports(ip: str) -> list:
    try:
        import nmap
        nm = nmap.PortScanner()
        nm.scan(ip, "22,80,443,8080,8443,8123,9000,3000,1883,554", "-T4 --open")
        ports = []
        if ip in nm.all_hosts():
            for proto in nm[ip].all_protocols():
                for port, info in nm[ip][proto].items():
                    if info["state"] == "open":
                        ports.append(port)
        return ports
    except Exception as e:
        logger.error(f"nmap error {ip}: {e}")
        return []


def _guess_type(ports, manufacturer, hostname):
    signals, confidence, device_type = [], 30, "Unknown"
    m = (manufacturer or "").lower()
    h = (hostname or "").lower()
    checks = [
        (1883 in ports,             "MQTT open",           "IoT Device",       20),
        (554 in ports,              "RTSP open",           "IP Camera",        35),
        (8123 in ports,             "Port 8123 (HA)",      "Home Assistant",   45),
        (9000 in ports,             "Port 9000 (Portainer)","Container Host",  35),
        (22 in ports,               "SSH open",            None,               15),
        ("raspberry" in m,          "Raspberry Pi OUI",    "Raspberry Pi",     40),
        ("raspberry" in h,          "Hostname hint",       "Raspberry Pi",     30),
        ("apple" in m,              "Apple OUI",           "Apple Device",     35),
        ("samsung" in m,            "Samsung OUI",         "Mobile/TV",        25),
        ("synology" in m or "synology" in h, "Synology",  "NAS",              50),
        ("tp-link" in m,            "TP-Link OUI",         "Network Device",   25),
        ("ubiquiti" in m,           "Ubiquiti OUI",        "Access Point",     40),
        ("espressif" in m,          "ESP OUI",             "IoT Device",       45),
    ]
    for condition, signal, dtype, boost in checks:
        if condition:
            signals.append(signal)
            confidence += boost
            if dtype:
                device_type = dtype
    return device_type, min(confidence, 99), signals


async def ping_scan():
    global _scanning, _last_scan
    if _scanning:
        return
    _scanning = True
    _last_scan = datetime.utcnow()
    try:
        from config import settings
        from database import AsyncSessionLocal
        from models import Device, ScanEvent, Alert
        from sqlmodel import select
        from services.ws_manager import manager

        network = settings.integrations_config  # unused here
        # Read scan_network from DB
        from models import AppConfig
        async with AsyncSessionLocal() as session:
            r = await session.execute(select(AppConfig).where(AppConfig.key == "scan_network"))
            row = r.scalar_one_or_none()
            network = row.value if row else "192.168.1.0/24"

            event = ScanEvent(scan_type="ping", status="running")
            session.add(event)
            await session.commit()

            r2 = await session.execute(select(Device))
            devices = {d.ip: d for d in r2.scalars().all()}
            base = ".".join(network.split(".")[:3])

            loop = asyncio.get_event_loop()
            tasks = [(ip := f"{base}.{i}",
                      loop.run_in_executor(None, _ping, ip))
                     for i in range(1, 255)]

            found = 0
            for ip, task in tasks:
                online = await task
                if ip in devices:
                    d = devices[ip]
                    was_online = d.status == "online"
                    d.status = "online" if online else "offline"
                    if online:
                        d.last_seen = datetime.utcnow()
                    session.add(d)
                    if was_online != online:
                        a = Alert(
                            level="info" if online else "warning",
                            title=f"{'Online' if online else 'Offline'}: {d.name}",
                            message=f"{d.name} ({d.ip}) is now {'online' if online else 'offline'}",
                            device_id=d.id
                        )
                        session.add(a)
                        await manager.broadcast({"event": "device_status_changed",
                                                  "device_id": d.id, "status": d.status,
                                                  "name": d.name})
                if online:
                    found += 1

            event.status = "completed"
            event.completed_at = datetime.utcnow()
            event.devices_found = found
            session.add(event)
            await session.commit()
            logger.info(f"Ping scan done: {found} online")

    except Exception as e:
        logger.error(f"Ping scan failed: {e}")
    finally:
        _scanning = False


async def full_scan():
    global _scanning, _last_scan
    if _scanning:
        return
    _scanning = True
    _last_scan = datetime.utcnow()
    try:
        from config import settings
        from database import AsyncSessionLocal
        from models import Device, PendingDevice, ScanEvent, Alert, AppConfig
        from sqlmodel import select
        from services.ws_manager import manager

        async with AsyncSessionLocal() as session:
            r = await session.execute(select(AppConfig).where(AppConfig.key == "scan_network"))
            row = r.scalar_one_or_none()
            network = row.value if row else "192.168.1.0/24"

            event = ScanEvent(scan_type="full", status="running")
            session.add(event)
            await session.commit()

            loop = asyncio.get_event_loop()
            arp_result = await loop.run_in_executor(None, _arp_scan, network)

            r2 = await session.execute(select(Device))
            known = {d.ip for d in r2.scalars().all()}
            r3 = await session.execute(select(PendingDevice))
            pending_ips = {p.ip for p in r3.scalars().all()}

            new_count = 0
            for host in arp_result:
                ip, mac = host["ip"], host["mac"]
                if ip in known:
                    r4 = await session.execute(select(Device).where(Device.ip == ip))
                    d = r4.scalar_one_or_none()
                    if d:
                        d.status = "online"
                        d.last_seen = datetime.utcnow()
                        session.add(d)
                    continue
                if ip in pending_ips:
                    continue

                manufacturer = await loop.run_in_executor(None, _mac_vendor, mac)
                ports = await loop.run_in_executor(None, _nmap_ports, ip)
                dtype, confidence, signals = _guess_type(ports, manufacturer, "")

                p = PendingDevice(
                    ip=ip, mac=mac, manufacturer=manufacturer,
                    open_ports=json.dumps(ports),
                    detected_type=dtype,
                    confidence=confidence,
                    signals=json.dumps(signals)
                )
                session.add(p)
                new_count += 1

                a = Alert(
                    level="info",
                    title=f"New device: {ip}",
                    message=f"MAC: {mac} | {manufacturer} | Confidence: {confidence}%"
                )
                session.add(a)
                await manager.broadcast({
                    "event": "new_device_discovered",
                    "ip": ip, "mac": mac,
                    "manufacturer": manufacturer,
                    "confidence": confidence
                })

            event.status = "completed"
            event.completed_at = datetime.utcnow()
            event.devices_found = len(arp_result)
            event.new_devices = new_count
            session.add(event)
            await session.commit()
            logger.info(f"Full scan done: {len(arp_result)} found, {new_count} new")

    except Exception as e:
        logger.error(f"Full scan failed: {e}")
    finally:
        _scanning = False
