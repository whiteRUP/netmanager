from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Optional
import json, os, httpx

from database import get_session
from routers.auth import get_current_user
from config import settings

router = APIRouter()

EMPTY_CONFIG = {
    "adguard": [],
    "pihole": [],
    "technitium": [],
    "powerdns": [],
    "routers": [],
    "switches": [],
    "dhcp": [],
    "npm": [],
    "monitoring": {
        "uptime_kuma": [],
        "netdata": [],
        "ntopng": [],
        "zabbix": [],
        "smokeping": [],
        "speedtest_tracker": []
    },
    "apps": {
        "home_assistant": [],
        "portainer": [],
        "node_red": [],
        "omv": [],
        "netbox": []
    },
    "tunnels": {
        "tailscale": {"api_key": "", "tailnet": "", "enabled": False},
        "cloudflare": {"api_token": "", "zone_id": "", "account_id": "", "enabled": False}
    },
    "notifications": {
        "ntfy": [],
        "telegram": []
    }
}


def _ensure_config():
    path = settings.integrations_config
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        with open(path, "w") as f:
            json.dump(EMPTY_CONFIG, f, indent=2)


def _load() -> dict:
    _ensure_config()
    with open(settings.integrations_config, "r") as f:
        return json.load(f)


def _save(config: dict):
    with open(settings.integrations_config, "w") as f:
        json.dump(config, f, indent=2, default=str)


@router.get("")
async def get_all(_: str = Depends(get_current_user)):
    return _load()


@router.put("/{section}")
async def update_section(
    section: str,
    data: Any,
    _: str = Depends(get_current_user)
):
    config = _load()
    if section not in config:
        raise HTTPException(404, f"Unknown section: {section}")
    config[section] = data
    _save(config)
    return {"ok": True}


@router.put("/{section}/{instance_id}")
async def upsert_instance(
    section: str,
    instance_id: str,
    data: Any,
    _: str = Depends(get_current_user)
):
    config = _load()
    if section not in config:
        raise HTTPException(404, f"Unknown section: {section}")
    lst = config[section]
    if not isinstance(lst, list):
        raise HTTPException(400, "Section is not a list")
    idx = next((i for i, x in enumerate(lst) if x.get("id") == instance_id), None)
    if idx is None:
        lst.append(data)
    else:
        lst[idx] = data
    _save(config)
    return {"ok": True}


@router.delete("/{section}/{instance_id}")
async def delete_instance(
    section: str,
    instance_id: str,
    _: str = Depends(get_current_user)
):
    config = _load()
    if section not in config or not isinstance(config[section], list):
        raise HTTPException(404, "Not found")
    config[section] = [x for x in config[section] if x.get("id") != instance_id]
    _save(config)
    return {"ok": True}


# ── Connection test ───────────────────────────────────────────────

from pydantic import BaseModel
from typing import Optional


class TestReq(BaseModel):
    type: str
    url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    api_key: Optional[str] = None
    api_token: Optional[str] = None
    token: Optional[str] = None
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None


@router.post("/test")
async def test_connection(
    req: TestReq,
    _: str = Depends(get_current_user)
):
    try:
        async with httpx.AsyncClient(timeout=5.0, verify=False) as client:

            if req.type == "adguard":
                r = await client.get(f"{req.url}/control/status",
                                     auth=(req.username or "", req.password or ""))
                if r.status_code == 200:
                    d = r.json()
                    return {"ok": True, "detail": f"AdGuard {d.get('version','?')} — running"}
                return {"ok": False, "detail": f"HTTP {r.status_code}"}

            elif req.type == "pihole":
                r = await client.get(f"{req.url}/api/info/version",
                                     headers={"X-FTL-SID": req.api_token or ""})
                if r.status_code == 200:
                    return {"ok": True, "detail": "Pi-hole connected"}
                return {"ok": False, "detail": f"HTTP {r.status_code}"}

            elif req.type == "npm":
                r = await client.post(f"{req.url}/api/tokens",
                                      json={"identity": req.username, "secret": req.password})
                if r.status_code == 200:
                    return {"ok": True, "detail": "NPM authenticated"}
                return {"ok": False, "detail": f"HTTP {r.status_code}"}

            elif req.type == "home_assistant":
                r = await client.get(f"{req.url}/api/",
                                     headers={"Authorization": f"Bearer {req.token or ''}"})
                if r.status_code == 200:
                    return {"ok": True, "detail": "Home Assistant connected"}
                return {"ok": False, "detail": f"HTTP {r.status_code}"}

            elif req.type == "portainer":
                r = await client.get(f"{req.url}/api/system/status",
                                     headers={"X-API-Key": req.api_key or ""})
                if r.status_code == 200:
                    return {"ok": True, "detail": "Portainer connected"}
                return {"ok": False, "detail": f"HTTP {r.status_code}"}

            elif req.type == "telegram":
                r = await client.get(
                    f"https://api.telegram.org/bot{req.bot_token}/getMe")
                if r.status_code == 200:
                    name = r.json().get("result", {}).get("username", "?")
                    return {"ok": True, "detail": f"Bot @{name} connected"}
                return {"ok": False, "detail": "Invalid bot token"}

            elif req.type == "ntfy":
                r = await client.get(req.url)
                if r.status_code < 400:
                    return {"ok": True, "detail": "ntfy server reachable"}
                return {"ok": False, "detail": f"HTTP {r.status_code}"}

            else:
                if req.url:
                    r = await client.get(req.url)
                    return {"ok": r.status_code < 400,
                            "detail": "Reachable" if r.status_code < 400 else f"HTTP {r.status_code}"}
                return {"ok": False, "detail": "No URL provided"}

    except httpx.ConnectError:
        return {"ok": False, "detail": "Connection refused — check URL and that service is running"}
    except httpx.TimeoutException:
        return {"ok": False, "detail": "Timeout — no response in 5s"}
    except Exception as e:
        return {"ok": False, "detail": str(e)}
