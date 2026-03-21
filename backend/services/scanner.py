"""
NetManager Scanner — two-phase discovery
Phase 1: nmap -sn ping sweep → get IPs + MACs (from nmap output, never emitting mid-block)
Phase 2: per-host port scan + fingerprinting → device type, confidence, signals

All type names match deviceTypes.js exactly.
"""
import subprocess, ipaddress, json, logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_last_scan: Optional[datetime] = None
_mac_parser = None


def last_scan_time() -> Optional[str]:
    return _last_scan.isoformat() if _last_scan else None


def _get_mac_parser():
    global _mac_parser
    if _mac_parser is None:
        try:
            import manuf
            _mac_parser = manuf.MacParser()
        except Exception:
            pass
    return _mac_parser


def _mac_vendor(mac: str) -> str:
    if not mac or mac == "00:00:00:00:00:00":
        return "Unknown"
    try:
        p = _get_mac_parser()
        if p:
            result = p.get_manuf(mac)
            if result and len(result) > 3:
                # Filter out results that are just hex strings (not real names)
                clean = result.replace(":", "").replace("-", "")
                if not all(c in "0123456789abcdefABCDEF" for c in clean):
                    return result
    except Exception:
        pass
    return "Unknown"


def _arp_cache_mac(ip: str) -> str:
    """Read MAC from kernel ARP cache — works cross-subnet after pings."""
    try:
        r = subprocess.run(["ip", "neigh", "show", ip],
                           capture_output=True, text=True, timeout=3)
        for line in r.stdout.splitlines():
            if ip in line and "lladdr" in line:
                parts = line.split()
                idx = parts.index("lladdr")
                if idx + 1 < len(parts):
                    return parts[idx + 1].lower()
    except Exception:
        pass
    return "00:00:00:00:00:00"


# ── Type registry (must match deviceTypes.js) ─────────────────────

# Port sets — any match triggers this type
PORT_SETS: dict = {
    "Home Assistant": {8123},
    "IoT Device":     {1883, 8883, 1880},
    "IP Camera":      {554, 8554},
    "Media Server":   {32400, 8096, 8920, 7359},
    "NAS/Storage":    {5000, 5001},
    "Printer":        {9100, 631},
    "DNS Server":     {53},
    "VPN Server":     {51820, 1194},
}

# Single-port → (type, icon)
PORT_TYPE_MAP: dict = {
    8123:  ("Home Assistant", "🏠"),
    1883:  ("IoT Device",     "💡"),
    8883:  ("IoT Device",     "💡"),
    1880:  ("IoT Device",     "💡"),
    554:   ("IP Camera",      "📷"),
    8554:  ("IP Camera",      "📷"),
    32400: ("Media Server",   "🎬"),
    8096:  ("Media Server",   "🎬"),
    8920:  ("Media Server",   "🎬"),
    7359:  ("Media Server",   "🎬"),
    5000:  ("NAS/Storage",    "💾"),
    5001:  ("NAS/Storage",    "💾"),
    9100:  ("Printer",        "🖨️"),
    631:   ("Printer",        "🖨️"),
    53:    ("DNS Server",     "🌐"),
    51820: ("VPN Server",     "🔐"),
    1194:  ("VPN Server",     "🔐"),
    9000:  ("Virtual Machine","🔲"),
    9443:  ("Virtual Machine","🔲"),
    3389:  ("PC/Desktop",     "🖥️"),
    5900:  ("PC/Desktop",     "🖥️"),
    4200:  ("Router",         "📡"),
    161:   ("Router",         "📡"),
}

# OUI prefix → (type, icon)
OUI_TYPE_MAP: dict = {
    "apple":           ("Apple Device",   "🍎"),
    "raspberry":       ("Raspberry Pi",   "🫐"),
    "raspberrypi":     ("Raspberry Pi",   "🫐"),
    "espressif":       ("IoT Device",     "💡"),
    "allterco":        ("IoT Device",     "💡"),   # Shelly
    "itead":           ("IoT Device",     "💡"),   # Sonoff
    "tuya":            ("IoT Device",     "💡"),
    "tp-link":         ("Router",         "📡"),
    "ubiquiti":        ("Access Point",   "📶"),
    "ubnt":            ("Access Point",   "📶"),
    "mikrotik":        ("MikroTik",       "⚡"),
    "cisco":           ("Switch",         "🔀"),
    "netgear":         ("Router",         "📡"),
    "d-link":          ("Router",         "📡"),
    "asustek":         ("Router",         "📡"),
    "samsung":         ("Mobile/Phone",   "📱"),
    "xiaomi":          ("Mobile/Phone",   "📱"),
    "synology":        ("NAS/Storage",    "💾"),
    "qnap":            ("NAS/Storage",    "💾"),
    "western digital": ("NAS/Storage",    "💾"),
    "intel":           ("PC/Desktop",     "🖥️"),
    "dell":            ("PC/Desktop",     "🖥️"),
    "hewlett":         ("PC/Desktop",     "🖥️"),
    "lenovo":          ("Laptop",         "💻"),
    "vmware":          ("Virtual Machine","🔲"),
    "qemu":            ("Virtual Machine","🔲"),
    "hikvision":       ("IP Camera",      "📷"),
    "dahua":           ("IP Camera",      "📷"),
    "reolink":         ("IP Camera",      "📷"),
    "amazon":          ("Smart Speaker",  "🔊"),
    "google":          ("Smart Speaker",  "🔊"),
    "nintendo":        ("Game Console",   "🎮"),
    "sony":            ("Game Console",   "🎮"),
    "microsoft":       ("PC/Desktop",     "🖥️"),
    "roku":            ("Smart TV",       "📺"),
    "lg electronics":  ("Smart TV",       "📺"),
    "brother":         ("Printer",        "🖨️"),
    "canon":           ("Printer",        "🖨️"),
    "epson":           ("Printer",        "🖨️"),
    "american power":  ("Network UPS",    "🔋"),
    "eaton":           ("Network UPS",    "🔋"),
    "cyberpower":      ("Network UPS",    "🔋"),
    "icewhale":        ("Server",         "🖧"),
}

# Hostname keyword → (type, icon)
HOSTNAME_PATTERNS: list = [
    ("esp",           "IoT Device",     "💡"),
    ("shelly",        "IoT Device",     "💡"),
    ("sonoff",        "IoT Device",     "💡"),
    ("tasmota",       "IoT Device",     "💡"),
    ("tuya",          "IoT Device",     "💡"),
    ("wemos",         "IoT Device",     "💡"),
    ("nodemcu",       "IoT Device",     "💡"),
    ("raspberrypi",   "Raspberry Pi",   "🫐"),
    ("raspi",         "Raspberry Pi",   "🫐"),
    ("rpi",           "Raspberry Pi",   "🫐"),
    ("camera",        "IP Camera",      "📷"),
    ("ipcam",         "IP Camera",      "📷"),
    ("hikvision",     "IP Camera",      "📷"),
    ("dahua",         "IP Camera",      "📷"),
    ("reolink",       "IP Camera",      "📷"),
    ("dvr",           "IP Camera",      "📷"),
    ("nvr",           "IP Camera",      "📷"),
    ("printer",       "Printer",        "🖨️"),
    ("brother",       "Printer",        "🖨️"),
    ("epson",         "Printer",        "🖨️"),
    ("router",        "Router",         "📡"),
    ("gateway",       "Router",         "📡"),
    ("openwrt",       "Router",         "📡"),
    ("opnsense",      "Router",         "📡"),
    ("pfsense",       "Router",         "📡"),
    ("mikrotik",      "MikroTik",       "⚡"),
    ("routerboard",   "MikroTik",       "⚡"),
    ("ubnt",          "Access Point",   "📶"),
    ("unifi",         "Access Point",   "📶"),
    ("switch",        "Switch",         "🔀"),
    ("nas",           "NAS/Storage",    "💾"),
    ("synology",      "NAS/Storage",    "💾"),
    ("diskstation",   "NAS/Storage",    "💾"),
    ("qnap",          "NAS/Storage",    "💾"),
    ("truenas",       "NAS/Storage",    "💾"),
    ("server",        "Server",         "🖧"),
    ("proxmox",       "Server",         "🖧"),
    ("iphone",        "Mobile/Phone",   "📱"),
    ("ipad",          "Tablet",         "📲"),
    ("android",       "Mobile/Phone",   "📱"),
    ("pixel",         "Mobile/Phone",   "📱"),
    ("galaxy",        "Mobile/Phone",   "📱"),
    ("homeassistant", "Home Assistant", "🏠"),
    ("hassio",        "Home Assistant", "🏠"),
    ("hass",          "Home Assistant", "🏠"),
    ("plex",          "Media Server",   "🎬"),
    ("jellyfin",      "Media Server",   "🎬"),
    ("emby",          "Media Server",   "🎬"),
    ("chromecast",    "Smart TV",       "📺"),
    ("firetv",        "Smart TV",       "📺"),
    ("echo",          "Smart Speaker",  "🔊"),
    ("alexa",         "Smart Speaker",  "🔊"),
    ("playstation",   "Game Console",   "🎮"),
    ("xbox",          "Game Console",   "🎮"),
    ("nintendo",      "Game Console",   "🎮"),
    ("desktop",       "PC/Desktop",     "🖥️"),
    ("laptop",        "Laptop",         "💻"),
    ("macbook",       "Laptop",         "💻"),
    ("imac",          "PC/Desktop",     "🖥️"),
]


def _detect_type(ports: list, hostname: str, manufacturer: str) -> tuple:
    """
    Returns (device_type, icon, confidence, signals_list).
    Priority: port set > specific port > hostname > OUI > fallback.
    """
    host = (hostname or "").lower().replace(".local", "").replace(".lan", "")
    mfr  = (manufacturer or "").lower()
    signals = []

    # 1. Port set — highest confidence
    for type_name, port_set in PORT_SETS.items():
        if any(p in ports for p in port_set):
            icon = next((v[1] for k, v in PORT_TYPE_MAP.items()
                         if v[0] == type_name and k in port_set), "💡")
            signals.append(("port_set", type_name, icon))
            break

    # 2. Specific single-port priority
    for port in [8123, 32400, 8096, 554, 8554, 1883, 9100, 51820, 53, 3389]:
        if port in ports and port in PORT_TYPE_MAP:
            dt, ic = PORT_TYPE_MAP[port]
            if not signals or signals[0][1] != dt:
                signals.append(("port", dt, ic))
                break

    # 3. Hostname patterns
    for pattern, dtype, dicon in HOSTNAME_PATTERNS:
        if pattern in host:
            signals.append(("hostname", dtype, dicon))
            break

    # 4. OUI / manufacturer
    for prefix, (dtype, dicon) in OUI_TYPE_MAP.items():
        if prefix in mfr:
            signals.append(("oui", dtype, dicon))
            break

    if not signals:
        return "Unknown", "❓", 20, []

    _, dtype, dicon = signals[0]
    signal_types = [s[0] for s in signals]

    # Confidence: more agreeing signals = higher confidence
    base = {"port_set": 85, "port": 75, "hostname": 65, "oui": 55}.get(signals[0][0], 30)
    # Bonus for multiple agreeing signals
    agreeing = sum(1 for s in signals[1:] if s[1] == dtype)
    conf = min(99, base + agreeing * 10)

    return dtype, dicon, conf, signal_types


# ── nmap sweep ────────────────────────────────────────────────────

def _nmap_ping_sweep(network: str) -> list:
    """
    nmap -sn sweep. Supports comma-separated CIDRs.
    CRITICAL: nmap outputs MAC AFTER 'Host is up', so we accumulate
    a full host block and only emit on the next 'Nmap scan report' line.
    """
    targets = [n.strip() for n in network.split(",") if n.strip()]
    results, seen_ips = [], set()

    for target in targets:
        try:
            net = ipaddress.ip_network(target, strict=False)
            if net.num_addresses > 4096:
                logger.warning(f"Skipping {target} — too large for ping scan (>{net.num_addresses} hosts)")
                continue
        except ValueError:
            logger.warning(f"Invalid network: {target}")
            continue

        logger.info(f"nmap sweep: {target}")
        try:
            r = subprocess.run(
                ["nmap", "-sn", "-T4", "--host-timeout", "3s", target],
                capture_output=True, text=True, timeout=300
            )
        except subprocess.TimeoutExpired:
            logger.error(f"nmap sweep timed out: {target}")
            continue
        except Exception as e:
            logger.error(f"nmap sweep error: {e}")
            continue

        # Parse — accumulate per-host block before emitting
        current_ip  = None
        current_mac = "00:00:00:00:00:00"
        is_up       = False

        def _emit():
            if current_ip and is_up and current_ip not in seen_ips:
                seen_ips.add(current_ip)
                results.append({"ip": current_ip, "mac": current_mac})

        for line in r.stdout.splitlines():
            line = line.strip()
            if line.startswith("Nmap scan report for"):
                _emit()  # flush previous block
                parts = line.split()
                raw = parts[-1].strip("()")
                try:
                    ipaddress.ip_address(raw)
                    current_ip = raw
                except ValueError:
                    current_ip = None
                current_mac = "00:00:00:00:00:00"
                is_up = False

            elif line.startswith("Host is up"):
                is_up = True

            elif "MAC Address:" in line and current_ip:
                # "MAC Address: AA:BB:CC:DD:EE:FF (Vendor Name)"
                mac_part = line.split("MAC Address:")[1].strip()
                current_mac = mac_part.split()[0].lower()

        _emit()  # flush last block

    logger.info(f"nmap sweep found {len(results)} hosts")

    # ARP cache fallback for missing MACs (cross-subnet hosts)
    for host in results:
        if host["mac"] == "00:00:00:00:00:00":
            cached = _arp_cache_mac(host["ip"])
            if cached != "00:00:00:00:00:00":
                host["mac"] = cached
                logger.debug(f"ARP cache MAC for {host['ip']}: {cached}")

    return results


def _nmap_port_scan(ip: str, hostname: str = "") -> dict:
    """Port scan a single host. Returns {ports, os_hint, hostname}."""
    try:
        r = subprocess.run(
            ["nmap", "-sV", "-T4", "--host-timeout", "10s",
             "-p", "21,22,23,25,53,80,110,143,161,443,445,554,631,"
                   "1883,1880,3389,5000,5001,5900,7359,8080,8096,8123,"
                   "8443,8554,8883,8920,9000,9100,9443,32400,51820",
             ip],
            capture_output=True, text=True, timeout=60
        )
        ports = []
        found_hostname = hostname
        for line in r.stdout.splitlines():
            line = line.strip()
            if "/tcp" in line and "open" in line:
                try:
                    port = int(line.split("/")[0])
                    ports.append(port)
                except ValueError:
                    pass
            if line.startswith("Nmap scan report for") and "(" in line:
                found_hostname = line.split("for")[1].split("(")[0].strip()
        return {"ports": ports, "hostname": found_hostname}
    except Exception as e:
        logger.warning(f"Port scan failed for {ip}: {e}")
        return {"ports": [], "hostname": hostname}


# ── Main scan functions ────────────────────────────────────────────

async def ping_scan():
    """Quick ping sweep — updates online/offline for known devices only."""
    global _last_scan
    from database import AsyncSessionLocal
    from models import Device, ScanEvent, DeviceStatus
    from sqlmodel import select
    from services.ws_manager import manager

    logger.info("Starting ping scan")

    async with AsyncSessionLocal() as session:
        scan = ScanEvent(scan_type="ping")
        session.add(scan)
        await session.commit()
        await session.refresh(scan)

        try:
            r = await session.execute(select(Device))
            known_devices = r.scalars().all()

            r2 = await session.execute(
                select(from_statement := __import__("sqlmodel").select(
                    __import__("models").AppConfig
                ).where(__import__("models").AppConfig.key == "scan_network")))
            network = "192.168.1.0/24"
            try:
                from models import AppConfig
                r_net = await session.execute(
                    select(AppConfig).where(AppConfig.key == "scan_network"))
                net_row = r_net.scalar_one_or_none()
                if net_row:
                    network = net_row.value
            except Exception:
                pass

            sweep = _nmap_ping_sweep(network)
            live_ips = {h["ip"] for h in sweep}
            now = datetime.now(timezone.utc)

            changed = 0
            for d in known_devices:
                new_status = DeviceStatus.online if d.ip in live_ips else DeviceStatus.offline
                if d.status != new_status:
                    d.status = new_status
                    d.last_changed = now
                    changed += 1
                if d.ip in live_ips:
                    d.last_seen = now
                session.add(d)

            scan.status        = "completed"
            scan.completed_at  = now
            scan.devices_found = len(live_ips)
            session.add(scan)
            await session.commit()
            _last_scan = now

            logger.info(f"Ping scan done — {len(live_ips)} online, {changed} status changes")
            await manager.broadcast({"event": "scan_complete", "type": "ping",
                                     "online": len(live_ips), "changed": changed})

        except Exception as e:
            logger.error(f"Ping scan error: {e}")
            scan.status = "error"
            scan.error  = str(e)
            scan.completed_at = datetime.now(timezone.utc)
            session.add(scan)
            await session.commit()


async def full_scan():
    """Full nmap sweep + port scan + fingerprint + add new to pending queue."""
    global _last_scan
    from database import AsyncSessionLocal
    from models import Device, PendingDevice, ScanEvent, DeviceStatus, Alert, AppConfig
    from sqlmodel import select
    from services.ws_manager import manager

    logger.info("Starting full scan")

    async with AsyncSessionLocal() as session:
        scan = ScanEvent(scan_type="full")
        session.add(scan)
        await session.commit()
        await session.refresh(scan)

        try:
            r_net = await session.execute(
                select(AppConfig).where(AppConfig.key == "scan_network"))
            net_row = r_net.scalar_one_or_none()
            network = net_row.value if net_row else "192.168.1.0/24"

            sweep = _nmap_ping_sweep(network)
            now = datetime.now(timezone.utc)

            r = await session.execute(select(Device))
            known = {d.ip: d for d in r.scalars().all()}

            r2 = await session.execute(select(PendingDevice))
            pending_ips = {p.ip for p in r2.scalars().all()
                           if p.status == "pending"}

            new_count = 0
            live_ips  = set()

            for host in sweep:
                ip  = host["ip"]
                mac = host["mac"]
                live_ips.add(ip)

                mfr = _mac_vendor(mac)

                # Port scan
                scan_result = _nmap_port_scan(ip)
                ports    = scan_result["ports"]
                hostname = scan_result["hostname"]

                dtype, dicon, confidence, signals = _detect_type(ports, hostname, mfr)

                if ip in known:
                    # Update existing device
                    d = known[ip]
                    if d.status != DeviceStatus.online:
                        d.status = DeviceStatus.online
                        d.last_changed = now
                    d.last_seen = now
                    if mac != "00:00:00:00:00:00" and (not d.mac or d.mac == "00:00:00:00:00:00"):
                        d.mac = mac
                    if mfr != "Unknown" and not d.manufacturer:
                        d.manufacturer = mfr
                    if hostname and not d.hostname:
                        d.hostname = hostname
                    if ports:
                        d.open_ports = json.dumps(ports)
                    session.add(d)

                elif ip not in pending_ips:
                    # New device — add to pending queue
                    p = PendingDevice(
                        ip=ip, mac=mac,
                        hostname=hostname or None,
                        manufacturer=mfr if mfr != "Unknown" else None,
                        open_ports=json.dumps(ports) if ports else None,
                        detected_type=dtype,
                        suggested_icon=dicon,
                        confidence=confidence,
                        signals=json.dumps(signals),
                        first_seen=now,
                    )
                    session.add(p)
                    new_count += 1

            # Mark offline devices
            for ip, d in known.items():
                if ip not in live_ips and d.status != DeviceStatus.offline:
                    d.status = DeviceStatus.offline
                    d.last_changed = now
                    session.add(d)
                    # Create alert
                    alert = Alert(
                        level="warning",
                        title=f"{d.name} went offline",
                        message=f"{d.ip} ({d.mac}) was not found in the latest scan",
                        device_id=d.id,
                    )
                    session.add(alert)

            if new_count > 0:
                alert = Alert(
                    level="info",
                    title=f"{new_count} new device{'s' if new_count > 1 else ''} found",
                    message=f"Full scan discovered {new_count} new device(s). Review them in Discovery.",
                )
                session.add(alert)

            scan.status        = "completed"
            scan.completed_at  = now
            scan.devices_found = len(live_ips)
            scan.new_devices   = new_count
            session.add(scan)
            await session.commit()
            _last_scan = now

            logger.info(f"Full scan done — {len(live_ips)} found, {new_count} new")
            await manager.broadcast({
                "event": "scan_complete", "type": "full",
                "found": len(live_ips), "new": new_count
            })

        except Exception as e:
            logger.error(f"Full scan error: {e}", exc_info=True)
            scan.status = "error"
            scan.error  = str(e)
            scan.completed_at = datetime.now(timezone.utc)
            session.add(scan)
            await session.commit()
