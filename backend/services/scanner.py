import asyncio, json, logging, subprocess, ipaddress
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)
_scanning = False
_last_scan: Optional[datetime] = None

# Cache the MAC vendor parser — loading the OUI DB is expensive
_mac_parser = None

def _get_mac_parser():
    global _mac_parser
    if _mac_parser is None:
        try:
            import manuf
            _mac_parser = manuf.MacParser()
        except Exception:
            _mac_parser = False  # don't retry
    return _mac_parser if _mac_parser else None


def is_scanning() -> bool:
    return _scanning


def last_scan_time() -> Optional[str]:
    return _last_scan.isoformat() if _last_scan else None


def _mac_vendor(mac: str) -> str:
    if not mac or mac == "00:00:00:00:00:00":
        return "Unknown"
    try:
        parser = _get_mac_parser()
        if parser:
            result = parser.get_manuf(mac)
            # Filter out results that look like MAC prefixes (not real vendor names)
            if result and len(result) > 3 and not result.replace(":", "").replace("-", "").isalnum():
                return result
            if result and len(result) > 3 and not all(c in "0123456789abcdefABCDEF:" for c in result):
                return result
    except Exception:
        pass
    return "Unknown"


def _arp_cache_mac(ip: str) -> str:
    """Read MAC from system ARP cache — works cross-subnet after a ping."""
    try:
        import subprocess
        r = subprocess.run(["ip", "neigh", "show", ip],
                           capture_output=True, text=True, timeout=2)
        for line in r.stdout.splitlines():
            if ip in line and "lladdr" in line:
                parts = line.split()
                idx = parts.index("lladdr")
                if idx + 1 < len(parts):
                    return parts[idx + 1].lower()
    except Exception:
        pass
    return "00:00:00:00:00:00"


def _nmap_ping_sweep(network: str) -> list:
    """
    nmap -sn sweep across all configured CIDRs.
    Supports comma-separated ranges: "192.168.1.0/24, 10.0.0.0/24"
    Returns list of {ip, mac} dicts.
    """
    try:
        targets = [n.strip() for n in network.split(",") if n.strip()]
        results = []
        seen_ips = set()

        for target in targets:
            logger.info(f"nmap sweep: {target}")
            r = subprocess.run(
                ["nmap", "-sn", "-T4", "--host-timeout", "3s", target],
                capture_output=True, text=True, timeout=300
            )
            ip, mac = None, "00:00:00:00:00:00"
            for line in r.stdout.splitlines():
                line = line.strip()
                if line.startswith("Nmap scan report for"):
                    parts = line.split()
                    raw = parts[-1].strip("()")
                    try:
                        ipaddress.ip_address(raw)
                        ip = raw
                    except ValueError:
                        ip = None
                    mac = "00:00:00:00:00:00"
                elif "MAC Address:" in line and ip:
                    mac = line.split("MAC Address:")[1].strip().split()[0].lower()
                elif line.startswith("Host is up") and ip and ip not in seen_ips:
                    seen_ips.add(ip)
                    results.append({"ip": ip, "mac": mac})

        logger.info(f"nmap sweep found {len(results)} hosts")
        return results

    except subprocess.TimeoutExpired:
        logger.error("nmap sweep timed out")
        return []
    except Exception as e:
        logger.error(f"nmap sweep error: {e}")
        return []


def _ping(ip: str) -> bool:
    try:
        r = subprocess.run(
            ["ping", "-c", "1", "-W", "1", ip],
            capture_output=True, timeout=3
        )
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
        logger.error(f"nmap ports error {ip}: {e}")
        return []


def _guess_type(ports, manufacturer, hostname):
    signals, confidence, device_type = [], 30, "Unknown"
    m = (manufacturer or "").lower()
    h = (hostname or "").lower()
    checks = [
        (1883 in ports,                          "MQTT open",             "IoT Device",      20),
        (554 in ports,                           "RTSP open",             "IP Camera",       35),
        (8123 in ports,                          "Port 8123 (HA)",        "Home Assistant",  45),
        (9000 in ports,                          "Port 9000 (Portainer)", "Container Host",  35),
        (22 in ports,                            "SSH open",              None,              15),
        ("raspberry" in m or "raspberry" in h,   "Raspberry Pi",          "Raspberry Pi",    40),
        ("apple" in m,                           "Apple OUI",             "Apple Device",    35),
        ("samsung" in m,                         "Samsung OUI",           "Mobile/TV",       25),
        ("synology" in m or "synology" in h,     "Synology",              "NAS",             50),
        ("tp-link" in m,                         "TP-Link OUI",           "Network Device",  25),
        ("ubiquiti" in m,                        "Ubiquiti OUI",          "Access Point",    40),
        ("espressif" in m,                       "ESP OUI",               "IoT Device",      45),
        ("intel" in m,                           "Intel NIC",             "PC/Server",       20),
        ("dell" in m or "hewlett" in m,          "PC OUI",                "PC/Server",       30),
        ("vmware" in m or "xensource" in m,      "VM OUI",                "Virtual Machine", 40),
    ]
    for condition, signal, dtype, boost in checks:
        if condition:
            signals.append(signal)
            confidence += boost
            if dtype:
                device_type = dtype
    return device_type, min(confidence, 99), signals


async def ping_scan():
    """Fast sweep: ping all IPs, update online/offline for known devices."""
    global _scanning, _last_scan
    if _scanning:
        return
    _scanning = True
    _last_scan = datetime.now(timezone.utc)
    try:
        from database import AsyncSessionLocal
        from models import Device, ScanEvent, Alert, AppConfig
        from sqlmodel import select
        from services.ws_manager import manager

        async with AsyncSessionLocal() as session:
            r = await session.execute(select(AppConfig).where(AppConfig.key == "scan_network"))
            row = r.scalar_one_or_none()
            network = row.value if row else "192.168.1.0/24"

            event = ScanEvent(scan_type="ping", status="running")
            session.add(event)
            await session.commit()

            # Build full IP list from all CIDRs
            all_ips = []
            for cidr in [n.strip() for n in network.split(",") if n.strip()]:
                try:
                    net = ipaddress.ip_network(cidr, strict=False)
                    if net.num_addresses > 4096:
                        logger.warning(f"Skipping large network {cidr} for ping scan — use full scan")
                        continue
                    all_ips.extend([str(ip) for ip in net.hosts()])
                except ValueError as e:
                    logger.error(f"Invalid CIDR {cidr}: {e}")

            r2 = await session.execute(select(Device))
            devices = {d.ip: d for d in r2.scalars().all()}

            loop = asyncio.get_event_loop()
            tasks = [(ip, loop.run_in_executor(None, _ping, ip)) for ip in all_ips]

            found = 0
            for ip, task in tasks:
                online = await task
                if ip in devices:
                    d = devices[ip]
                    was_online = d.status == "online"
                    d.status = "online" if online else "offline"
                    if online:
                        d.last_seen = datetime.now(timezone.utc)
                        found += 1
                    session.add(d)
                    if was_online != online:
                        a = Alert(
                            level="info" if online else "warning",
                            title=f"{'Online' if online else 'Offline'}: {d.name}",
                            message=f"{d.name} ({d.ip}) is now {'online' if online else 'offline'}",
                            device_id=d.id
                        )
                        session.add(a)
                        await manager.broadcast({
                            "event": "device_status_changed",
                            "device_id": d.id, "status": d.status, "name": d.name
                        })
                elif online:
                    found += 1

            event.status = "completed"
            event.completed_at = datetime.now(timezone.utc)
            event.devices_found = found
            session.add(event)
            await session.commit()
            logger.info(f"Ping scan done: {found} online across {len(all_ips)} IPs")

    except Exception as e:
        logger.error(f"Ping scan failed: {e}", exc_info=True)
    finally:
        _scanning = False


async def full_scan():
    """Full discovery: nmap sweep → port scan → pending queue."""
    global _scanning, _last_scan
    if _scanning:
        return
    _scanning = True
    _last_scan = datetime.now(timezone.utc)
    try:
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
            arp_result = await loop.run_in_executor(None, _nmap_ping_sweep, network)

            if not arp_result:
                logger.warning("nmap returned 0 hosts — check network range and NET_ADMIN cap")

            # Fill in MACs from ARP cache for cross-subnet hosts (nmap can't get these)
            for host in arp_result:
                if host["mac"] == "00:00:00:00:00:00":
                    cached = _arp_cache_mac(host["ip"])
                    if cached != "00:00:00:00:00:00":
                        host["mac"] = cached

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
                        d.last_seen = datetime.now(timezone.utc)
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
                    message=f"MAC: {mac} | {manufacturer} | Type: {dtype} | Confidence: {confidence}%"
                )
                session.add(a)
                await manager.broadcast({
                    "event": "new_device_discovered",
                    "ip": ip, "mac": mac,
                    "manufacturer": manufacturer,
                    "confidence": confidence
                })

            event.status = "completed"
            event.completed_at = datetime.now(timezone.utc)
            event.devices_found = len(arp_result)
            event.new_devices = new_count
            session.add(event)
            await session.commit()
            logger.info(f"Full scan done: {len(arp_result)} found, {new_count} new")

    except Exception as e:
        logger.error(f"Full scan failed: {e}", exc_info=True)
    finally:
        _scanning = False
