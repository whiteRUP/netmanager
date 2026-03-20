"""
NetManager scanner service
  - nmap -sn ping sweep (respects CIDR, multi-CIDR)
  - ARP cache fill for cross-subnet hosts
  - Port scan for new hosts
  - Rich device type identification:
      port signatures → hostname patterns → OUI → TTL
"""
import asyncio
import ipaddress
import json
import logging
import subprocess
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ── MAC parser singleton ──────────────────────────────────────────
_mac_parser = None

def _get_mac_parser():
    global _mac_parser
    if _mac_parser is None:
        try:
            import manuf
            _mac_parser = manuf.MacParser()
        except Exception as e:
            logger.warning(f"manuf not available: {e}")
    return _mac_parser


def _mac_vendor(mac: str) -> str:
    if not mac or mac == "00:00:00:00:00:00":
        return "Unknown"
    try:
        parser = _get_mac_parser()
        if parser:
            result = parser.get_manuf(mac)
            # Only return if it looks like a real vendor name (not a MAC prefix)
            if result and len(result) > 2:
                stripped = result.replace(":", "").replace("-", "")
                if not all(c in "0123456789abcdefABCDEF" for c in stripped):
                    return result
    except Exception:
        pass
    return "Unknown"


def _arp_cache_mac(ip: str) -> str:
    """Lookup MAC from kernel ARP/neighbour table — works for cross-subnet after a ping."""
    try:
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


# ── OUI → device type / icon ─────────────────────────────────────
# Types MUST match deviceTypes.js DEVICE_TYPES exactly for icon lookup.
# Format: {prefix_lower: (device_type, icon)}
OUI_TYPE_MAP = {
    # Apple — phones first, OUI could be iPhone/iPad/MacBook
    "apple":            ("Apple Device",   "🍎"),
    # Raspberry Pi Foundation
    "raspberry":        ("Raspberry Pi",   "🫐"),
    "raspberrypi":      ("Raspberry Pi",   "🫐"),
    # Espressif (ESP8266, ESP32 — IoT modules)
    "espressif":        ("IoT Device",     "💡"),
    # Shelly / Allterco
    "allterco":         ("IoT Device",     "💡"),
    # Sonoff / ITEAD
    "itead":            ("IoT Device",     "💡"),
    # Tuya
    "tuya":             ("IoT Device",     "💡"),
    # TP-Link (routers + switches + Kasa plugs)
    "tp-link":          ("Router",         "📡"),
    "tp link":          ("Router",         "📡"),
    # Ubiquiti
    "ubiquiti":         ("Access Point",   "📶"),
    "ubnt":             ("Access Point",   "📶"),
    # MikroTik
    "mikrotik":         ("MikroTik",       "⚡"),
    # Cisco
    "cisco":            ("Switch",         "🔀"),
    # Netgear
    "netgear":          ("Router",         "📡"),
    # D-Link
    "d-link":           ("Router",         "📡"),
    # Asus
    "asustek":          ("Router",         "📡"),
    "asus":             ("Router",         "📡"),
    # Samsung — could be phone, TV, appliance
    "samsung":          ("Mobile/Phone",   "📱"),
    # Xiaomi
    "xiaomi":           ("Mobile/Phone",   "📱"),
    # OnePlus
    "oneplus":          ("Mobile/Phone",   "📱"),
    # Synology
    "synology":         ("NAS/Storage",    "💾"),
    # QNAP
    "qnap":             ("NAS/Storage",    "💾"),
    # Western Digital (My Cloud NAS)
    "western digital":  ("NAS/Storage",    "💾"),
    # Intel (NUC / PC NIC)
    "intel":            ("PC/Desktop",     "🖥️"),
    # Dell
    "dell":             ("PC/Desktop",     "🖥️"),
    # HP
    "hewlett":          ("PC/Desktop",     "🖥️"),
    "hp":               ("PC/Desktop",     "🖥️"),
    # Lenovo
    "lenovo":           ("Laptop",         "💻"),
    # VMware
    "vmware":           ("Virtual Machine","🔲"),
    # Proxmox / QEMU
    "qemu":             ("Virtual Machine","🔲"),
    # Hikvision / Dahua / Reolink — cameras
    "hikvision":        ("IP Camera",      "📷"),
    "dahua":            ("IP Camera",      "📷"),
    "reolink":          ("IP Camera",      "📷"),
    "amcrest":          ("IP Camera",      "📷"),
    "foscam":           ("IP Camera",      "📷"),
    # Amazon (Echo, Fire TV)
    "amazon":           ("Smart Speaker",  "🔊"),
    # Google (Nest, Chromecast, Google Home)
    "google":           ("Smart Speaker",  "🔊"),
    # Nintendo
    "nintendo":         ("Game Console",   "🎮"),
    # Sony (PS4/PS5)
    "sony":             ("Game Console",   "🎮"),
    # Microsoft (Xbox, Surface)
    "microsoft":        ("PC/Desktop",     "🖥️"),
    # Roku
    "roku":             ("Smart TV",       "📺"),
    # LG Electronics (TVs)
    "lg electronics":   ("Smart TV",       "📺"),
    # Brother / Canon / Epson
    "brother":          ("Printer",        "🖨️"),
    "canon":            ("Printer",        "🖨️"),
    "epson":            ("Printer",        "🖨️"),
    "seiko":            ("Printer",        "🖨️"),
    # APC / Eaton (UPS)
    "american power":   ("Network UPS",   "🔋"),
    "eaton":            ("Network UPS",   "🔋"),
    "cyberpower":       ("Network UPS",   "🔋"),
    # ZimaBoard / SBC
    "icewhale":         ("Server",         "🖧"),
}

# ── Hostname patterns → (type, icon) ────────────────────────────
# Types MUST match deviceTypes.js DEVICE_TYPES exactly.
HOSTNAME_PATTERNS = [
    # IoT / smart home
    ("esp",           "IoT Device",     "💡"),
    ("shelly",        "IoT Device",     "💡"),
    ("sonoff",        "IoT Device",     "💡"),
    ("tasmota",       "IoT Device",     "💡"),
    ("tuya",          "IoT Device",     "💡"),
    ("wemos",         "IoT Device",     "💡"),
    ("nodemcu",       "IoT Device",     "💡"),
    ("zigbee",        "IoT Device",     "💡"),
    ("zwavejs",       "IoT Device",     "💡"),
    # Smart plug
    ("kasa",          "Smart Plug",     "🔌"),
    ("meross",        "Smart Plug",     "🔌"),
    # Raspberry Pi
    ("raspberrypi",   "Raspberry Pi",   "🫐"),
    ("raspi",         "Raspberry Pi",   "🫐"),
    ("rpi",           "Raspberry Pi",   "🫐"),
    # Cameras
    ("camera",        "IP Camera",      "📷"),
    ("ipcam",         "IP Camera",      "📷"),
    ("dvr",           "IP Camera",      "📷"),
    ("nvr",           "IP Camera",      "📷"),
    ("hikvision",     "IP Camera",      "📷"),
    ("dahua",         "IP Camera",      "📷"),
    ("reolink",       "IP Camera",      "📷"),
    # Printers
    ("printer",       "Printer",        "🖨️"),
    ("brother",       "Printer",        "🖨️"),
    ("epson",         "Printer",        "🖨️"),
    # Network
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
    # Servers / NAS
    ("nas",           "NAS/Storage",    "💾"),
    ("synology",      "NAS/Storage",    "💾"),
    ("diskstation",   "NAS/Storage",    "💾"),
    ("qnap",          "NAS/Storage",    "💾"),
    ("truenas",       "NAS/Storage",    "💾"),
    ("server",        "Server",         "🖧"),
    ("proxmox",       "Server",         "🖧"),
    # Mobile
    ("iphone",        "Mobile/Phone",   "📱"),
    ("ipad",          "Tablet",         "📲"),
    ("android",       "Mobile/Phone",   "📱"),
    ("pixel",         "Mobile/Phone",   "📱"),
    ("galaxy",        "Mobile/Phone",   "📱"),
    ("oneplus",       "Mobile/Phone",   "📱"),
    # Smart home
    ("homeassistant", "Home Assistant", "🏠"),
    ("hassio",        "Home Assistant", "🏠"),
    ("hass",          "Home Assistant", "🏠"),
    # Media
    ("plex",          "Media Server",   "🎬"),
    ("jellyfin",      "Media Server",   "🎬"),
    ("emby",          "Media Server",   "🎬"),
    ("chromecast",    "Smart TV",       "📺"),
    ("firetv",        "Smart TV",       "📺"),
    # Smart speakers
    ("echo",          "Smart Speaker",  "🔊"),
    ("alexa",         "Smart Speaker",  "🔊"),
    ("google-home",   "Smart Speaker",  "🔊"),
    # Gaming
    ("playstation",   "Game Console",   "🎮"),
    ("ps4",           "Game Console",   "🎮"),
    ("ps5",           "Game Console",   "🎮"),
    ("xbox",          "Game Console",   "🎮"),
    ("nintendo",      "Game Console",   "🎮"),
    # PCs
    ("desktop",       "PC/Desktop",     "🖥️"),
    ("laptop",        "Laptop",         "💻"),
    ("workstation",   "PC/Desktop",     "🖥️"),
    ("macbook",       "Laptop",         "💻"),
    ("imac",          "PC/Desktop",     "🖥️"),
]

# ── Port signatures → (type, icon) ──────────────────────────────
# Types MUST match deviceTypes.js DEVICE_TYPES exactly.
PORT_TYPE_MAP = {
    # IoT / MQTT
    1883:  ("IoT Device",     "💡"),
    8883:  ("IoT Device",     "💡"),
    # Home Assistant
    8123:  ("Home Assistant", "🏠"),
    # Portainer / Docker
    9000:  ("Virtual Machine","🔲"),
    9443:  ("Virtual Machine","🔲"),
    # Cameras — RTSP
    554:   ("IP Camera",      "📷"),
    8554:  ("IP Camera",      "📷"),
    # Printers
    9100:  ("Printer",        "🖨️"),
    631:   ("Printer",        "🖨️"),
    # NAS — Synology DSM
    5000:  ("NAS/Storage",    "💾"),
    5001:  ("NAS/Storage",    "💾"),
    # Network management — SNMP
    161:   ("Router",         "📡"),
    # Remote desktop
    3389:  ("PC/Desktop",     "🖥️"),
    5900:  ("PC/Desktop",     "🖥️"),
    # Media servers
    32400: ("Media Server",   "🎬"),
    8096:  ("Media Server",   "🎬"),
    8920:  ("Media Server",   "🎬"),
    7359:  ("Media Server",   "🎬"),
    # Plex/Emby/Kodi discovery
    1900:  ("Media Server",   "🎬"),
    # DNS
    53:    ("DNS Server",     "🌐"),
    # Router management panels
    4200:  ("Router",         "📡"),
    # Node-RED
    1880:  ("IoT Device",     "💡"),
    # WireGuard / VPN
    51820: ("VPN Server",     "🔐"),
}

# Port sets (any match triggers this type)
PORT_SETS = {
    "IoT Device":     {1883, 8883, 1880},
    "Home Assistant": {8123},
    "IP Camera":      {554, 8554},
    "Printer":        {9100, 631},
    "Media Server":   {32400, 8096, 8920, 7359},
    "NAS/Storage":    {5000, 5001},
    "DNS Server":     {53},
    "VPN Server":     {51820, 1194},
}


def _detect_type(ports: list, hostname: str, manufacturer: str, ttl: Optional[int] = None) -> tuple:
    """
    Return (device_type, icon, confidence_signals) tuple.
    Uses 4 signals with priority: ports > hostname > OUI/manufacturer > TTL.
    """
    hostname_lower = (hostname or "").lower().replace(".local", "").replace(".lan", "")
    mfr_lower      = (manufacturer or "").lower()
    signals = []

    # 1. Port-based detection (strongest signal)
    for type_name, port_set in PORT_SETS.items():
        if any(p in ports for p in port_set):
            icon = next((v[1] for k, v in PORT_TYPE_MAP.items() if v[0] == type_name), "💡")
            signals.append(("port", type_name, icon))
            break
    # Specific port priority (ordered by confidence)
    for port in [8123, 32400, 8096, 554, 8554, 1883, 9100, 51820, 53, 3389]:
        if port in ports and port in PORT_TYPE_MAP:
            dt, ic = PORT_TYPE_MAP[port]
            if not any(s[1] == dt for s in signals):
                signals.append(("port", dt, ic))

    # 2. Hostname pattern match
    for pattern, dtype, dicon in HOSTNAME_PATTERNS:
        if pattern in hostname_lower:
            signals.append(("hostname", dtype, dicon))
            break

    # 3. OUI / manufacturer match
    for prefix, (dtype, dicon) in OUI_TYPE_MAP.items():
        if prefix in mfr_lower:
            signals.append(("oui", dtype, dicon))
            break

    # 4. TTL-based OS guess (lowest confidence)
    if ttl:
        if 60 <= ttl <= 70:
            signals.append(("ttl", "Linux Device",   "🐧"))
        elif 120 <= ttl <= 135:
            signals.append(("ttl", "Windows Device", "🪟"))
        elif 250 <= ttl <= 255:
            signals.append(("ttl", "Apple / Cisco",  "🍎"))

    # Pick winner: first signal wins (priority: port → hostname → oui → ttl)
    if signals:
        _, dtype, dicon = signals[0]
        return dtype, dicon, [s[0] for s in signals]
    return "Unknown", "❓", []


# ── nmap sweep ───────────────────────────────────────────────────

def _nmap_ping_sweep(network: str) -> list:
    """
    nmap -sn sweep across all configured CIDRs.
    Supports comma-separated: "192.168.1.0/24, 10.0.0.0/24"

    nmap output order per host:
        Nmap scan report for <hostname> (<ip>)    ← OR just <ip>
        Host is up (Xs latency).
        MAC Address: AA:BB:CC:DD:EE:FF (Vendor)   ← AFTER "Host is up"

    We accumulate a full host block then emit on next "scan report" line.
    """
    try:
        targets  = [n.strip() for n in network.split(",") if n.strip()]
        results  = []
        seen_ips = set()

        for target in targets:
            # Skip oversized ranges (>4096 hosts) for ping scan
            try:
                net = ipaddress.ip_network(target, strict=False)
                if net.num_addresses > 4096:
                    logger.warning(f"Skipping {target} (>{net.num_addresses} addresses) for ping scan")
                    continue
            except ValueError:
                pass

            logger.info(f"nmap sweep: {target}")
            r = subprocess.run(
                ["nmap", "-sn", "-T4", "--host-timeout", "3s", target],
                capture_output=True, text=True, timeout=300
            )

            current_ip  = None
            current_mac = "00:00:00:00:00:00"
            current_host = None
            is_up       = False

            def _emit():
                if current_ip and is_up and current_ip not in seen_ips:
                    seen_ips.add(current_ip)
                    mac = current_mac
                    # Try ARP cache if nmap gave us nothing (cross-subnet)
                    if mac == "00:00:00:00:00:00":
                        mac = _arp_cache_mac(current_ip)
                    results.append({
                        "ip":       current_ip,
                        "mac":      mac,
                        "hostname": current_host,
                    })

            for line in r.stdout.splitlines():
                line = line.strip()

                if line.startswith("Nmap scan report for"):
                    _emit()  # flush previous host block
                    # Parse: "Nmap scan report for hostname (1.2.3.4)" or "... for 1.2.3.4"
                    parts = line.split()
                    raw = parts[-1].strip("()")
                    try:
                        ipaddress.ip_address(raw)
                        current_ip = raw
                        # Hostname may be before the parens
                        if "(" in line:
                            current_host = line.split("for ")[1].split(" (")[0]
                        else:
                            current_host = None
                    except ValueError:
                        current_ip = None
                        current_host = None
                    current_mac = "00:00:00:00:00:00"
                    is_up = False

                elif line.startswith("Host is up"):
                    is_up = True

                elif "MAC Address:" in line and current_ip:
                    # "MAC Address: AA:BB:CC:DD:EE:FF (Vendor Name)"
                    mac_part    = line.split("MAC Address:")[1].strip()
                    current_mac = mac_part.split()[0].lower()

            _emit()  # flush final block

        logger.info(f"nmap sweep complete: {len(results)} hosts")
        return results

    except subprocess.TimeoutExpired:
        logger.error("nmap sweep timed out")
        return []
    except Exception as e:
        logger.error(f"nmap sweep error: {e}")
        return []


def _port_scan(ip: str) -> tuple:
    """
    nmap port scan. Returns (open_ports: list[int], ttl: int|None).
    Scans common service ports relevant to homelab devices.
    """
    port_list = (
        "21,22,23,25,53,80,110,143,161,443,445,554,"
        "631,1883,3389,4200,5000,5001,5900,7359,"
        "8080,8096,8123,8443,8554,8883,8920,9000,"
        "9100,9443,32400"
    )
    try:
        r = subprocess.run(
            ["nmap", "-p", port_list, "-T4", "--host-timeout", "5s", "-oG", "-", ip],
            capture_output=True, text=True, timeout=60
        )
        ports = []
        ttl   = None
        for line in r.stdout.splitlines():
            if "Ports:" in line:
                # grepable format: "Ports: 22/open/tcp//ssh///, 80/open/tcp//http///"
                for seg in line.split("Ports:")[1].split(","):
                    seg = seg.strip()
                    if "/open/" in seg:
                        try:
                            ports.append(int(seg.split("/")[0]))
                        except ValueError:
                            pass
            if "ttl" in line.lower():
                # Not in grepable format; try normal output
                pass
        return ports, ttl
    except subprocess.TimeoutExpired:
        logger.warning(f"Port scan timed out for {ip}")
        return [], None
    except Exception as e:
        logger.error(f"Port scan error for {ip}: {e}")
        return [], None


# ── Main scan functions ──────────────────────────────────────────

async def ping_scan():
    """Quick sweep — update online/offline for known devices, don't add new ones."""
    from database import AsyncSessionLocal
    from models import Device, DeviceStatus, ScanEvent
    from sqlmodel import select
    from services.ws_manager import ws_manager

    now = datetime.now(timezone.utc)
    event = ScanEvent(scan_type="ping", started_at=now)

    async with AsyncSessionLocal() as session:
        r_cfg = await session.execute(
            __import__("sqlmodel", fromlist=["select"]).select(
                __import__("models", fromlist=["AppConfig"]).AppConfig
            ).where(
                __import__("models", fromlist=["AppConfig"]).AppConfig.key == "scan_network"
            )
        )
        cfg = r_cfg.scalar_one_or_none()
        network = cfg.value if cfg else "192.168.1.0/24"

        session.add(event)
        await session.commit()
        await session.refresh(event)

    logger.info(f"Ping scan starting — network: {network}")
    hosts = await asyncio.get_event_loop().run_in_executor(
        None, _nmap_ping_sweep, network)

    live_ips = {h["ip"] for h in hosts}

    async with AsyncSessionLocal() as session:
        result  = await session.execute(select(Device))
        devices = result.scalars().all()
        changed = 0

        for d in devices:
            new_status = DeviceStatus.online if d.ip in live_ips else DeviceStatus.offline
            if d.status != new_status:
                d.status    = new_status
                d.last_changed = datetime.now(timezone.utc)
                changed += 1
            if d.ip in live_ips:
                d.last_seen = datetime.now(timezone.utc)

        event.completed_at  = datetime.now(timezone.utc)
        event.devices_found = len(hosts)
        event.status        = "completed"
        session.add(event)
        await session.commit()

    logger.info(f"Ping scan done — {len(hosts)} live, {changed} status changes")
    await ws_manager.broadcast({"type": "scan_complete", "scan_type": "ping",
                                "devices_found": len(hosts)})


async def full_scan():
    """Deep scan — discover new devices with port scan + type detection."""
    from database import AsyncSessionLocal
    from models import Device, DeviceStatus, PendingDevice, ScanEvent, Alert, AppConfig
    from sqlmodel import select
    from services.ws_manager import ws_manager

    now = datetime.now(timezone.utc)
    event = ScanEvent(scan_type="full", started_at=now)

    async with AsyncSessionLocal() as session:
        r_cfg = await session.execute(
            select(AppConfig).where(AppConfig.key == "scan_network"))
        cfg     = r_cfg.scalar_one_or_none()
        network = cfg.value if cfg else "192.168.1.0/24"

        session.add(event)
        await session.commit()
        await session.refresh(event)

    logger.info(f"Full scan starting — network: {network}")
    hosts = await asyncio.get_event_loop().run_in_executor(
        None, _nmap_ping_sweep, network)

    live_ips = {h["ip"] for h in hosts}
    new_count = 0

    async with AsyncSessionLocal() as session:
        result   = await session.execute(select(Device))
        existing = {d.ip: d for d in result.scalars().all()}
        pending_r = await session.execute(select(PendingDevice))
        pending_ips = {p.ip for p in pending_r.scalars().all()
                       if p.status == "pending"}

        for host in hosts:
            ip  = host["ip"]
            mac = host["mac"]
            mfr = _mac_vendor(mac)

            # Update known device
            if ip in existing:
                d = existing[ip]
                d.status   = DeviceStatus.online
                d.last_seen = datetime.now(timezone.utc)
                if mac != "00:00:00:00:00:00" and d.mac == "00:00:00:00:00:00":
                    d.mac = mac
                if mfr != "Unknown" and (not d.manufacturer or d.manufacturer == "Unknown"):
                    d.manufacturer = mfr
                continue

            # Skip already-pending
            if ip in pending_ips:
                continue

            # Port scan new host (run in executor to keep async)
            ports, ttl = await asyncio.get_event_loop().run_in_executor(
                None, _port_scan, ip)

            hostname = host.get("hostname")
            dtype, dicon, signals = _detect_type(ports, hostname or "", mfr, ttl)

            # Confidence scoring
            conf = 30  # base
            if mac != "00:00:00:00:00:00":
                conf += 15
            if mfr != "Unknown":
                conf += 10
            if hostname:
                conf += 10
            if ports:
                conf += 15
            if dtype != "Unknown":
                conf += 20

            pending = PendingDevice(
                ip           = ip,
                mac          = mac,
                manufacturer = mfr if mfr != "Unknown" else None,
                hostname     = hostname,
                open_ports   = json.dumps(ports) if ports else None,
                detected_type = dtype,
                confidence   = min(conf, 99),
                signals      = json.dumps(signals),
            )
            session.add(pending)
            new_count += 1

            # Mark offline existing devices that didn't respond
        for ip, d in existing.items():
            if ip not in live_ips and d.status == DeviceStatus.online:
                d.status = DeviceStatus.offline
                d.last_changed = datetime.now(timezone.utc)
                alert = Alert(
                    level="warning",
                    title=f"{d.name} went offline",
                    message=f"{d.ip} ({d.mac}) not seen in full scan",
                    device_id=d.id,
                )
                session.add(alert)

        event.completed_at  = datetime.now(timezone.utc)
        event.devices_found = len(hosts)
        event.new_devices   = new_count
        event.status        = "completed"
        session.add(event)
        await session.commit()

    logger.info(f"Full scan done — {len(hosts)} live, {new_count} new pending")
    await ws_manager.broadcast({"type": "scan_complete", "scan_type": "full",
                                "devices_found": len(hosts), "new_devices": new_count})
