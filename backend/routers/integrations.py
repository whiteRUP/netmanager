from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any, Optional
import json, os, httpx

from routers.auth import get_current_user
from config import INTEGRATIONS_PATH

router = APIRouter()

EMPTY = {
    "adguard":    [],
    "pihole":     [],
    "technitium": [],
    "powerdns":   [],
    "routers":    [],
    "switches":   [],
    "dhcp":       [],
    "npm":        [],
    "monitoring": {
        "uptime_kuma": [], "netdata": [], "ntopng": [],
        "zabbix": [], "smokeping": [], "speedtest_tracker": []
    },
    "apps": {
        "home_assistant": [], "portainer": [], "node_red": [],
        "omv": [], "netbox": []
    },
    "tunnels": {
        "tailscale":  {"api_key": "", "tailnet": "", "enabled": False},
        "cloudflare": {"api_token": "", "zone_id": "", "account_id": "", "enabled": False}
    },
    "notifications": {"ntfy": [], "telegram": []}
}


def _ensure():
    os.makedirs(os.path.dirname(INTEGRATIONS_PATH), exist_ok=True)
    if not os.path.exists(INTEGRATIONS_PATH):
        with open(INTEGRATIONS_PATH, "w") as f:
            json.dump(EMPTY, f, indent=2)


def _load() -> dict:
    _ensure()
    with open(INTEGRATIONS_PATH) as f:
        return json.load(f)


def _save(cfg: dict):
    with open(INTEGRATIONS_PATH, "w") as f:
        json.dump(cfg, f, indent=2, default=str)


@router.get("")
async def get_all(_: str = Depends(get_current_user)):
    return _load()


@router.put("/{section}")
async def update_section(
    section: str,
    data: Any,
    _: str = Depends(get_current_user)
):
    cfg = _load()
    if section not in cfg:
        raise HTTPException(404, f"Unknown section: {section}")
    cfg[section] = data
    _save(cfg)
    return {"ok": True}


@router.put("/{section}/{instance_id}")
async def upsert_instance(
    section: str,
    instance_id: str,
    data: Any,
    _: str = Depends(get_current_user)
):
    cfg = _load()
    if section not in cfg:
        raise HTTPException(404, f"Unknown section: {section}")
    lst = cfg[section]
    if not isinstance(lst, list):
        raise HTTPException(400, "Section is not a list — use PUT /{section} for nested objects")
    idx = next((i for i, x in enumerate(lst) if str(x.get("id")) == str(instance_id)), None)
    if idx is None:
        lst.append(data)
    else:
        lst[idx] = data
    _save(cfg)
    return {"ok": True}


@router.delete("/{section}/{instance_id}")
async def delete_instance(
    section: str,
    instance_id: str,
    _: str = Depends(get_current_user)
):
    cfg = _load()
    if section not in cfg or not isinstance(cfg[section], list):
        raise HTTPException(404, "Not found")
    cfg[section] = [x for x in cfg[section] if str(x.get("id")) != str(instance_id)]
    _save(cfg)
    return {"ok": True}


# ── Connection test ───────────────────────────────────────────────
class TestReq(BaseModel):
    type:      str
    url:       Optional[str] = None
    username:  Optional[str] = None
    password:  Optional[str] = None
    api_key:   Optional[str] = None
    api_token: Optional[str] = None
    token:     Optional[str] = None
    bot_token: Optional[str] = None
    chat_id:   Optional[str] = None


@router.post("/test")
async def test_connection(req: TestReq, _: str = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=6.0, verify=False) as c:

            if req.type == "adguard":
                r = await c.get(f"{req.url}/control/status",
                                auth=(req.username or "", req.password or ""))
                if r.status_code == 200:
                    v = r.json().get("version", "?")
                    return {"ok": True, "detail": f"AdGuard Home {v} — connected"}
                return {"ok": False, "detail": f"HTTP {r.status_code}"}

            elif req.type == "pihole":
                r = await c.get(f"{req.url}/api/info/version",
                                headers={"X-FTL-SID": req.api_token or ""})
                return {"ok": r.status_code == 200,
                        "detail": "Pi-hole connected" if r.status_code == 200 else f"HTTP {r.status_code}"}

            elif req.type == "npm":
                r = await c.post(f"{req.url}/api/tokens",
                                 json={"identity": req.username, "secret": req.password})
                return {"ok": r.status_code == 200,
                        "detail": "NPM authenticated" if r.status_code == 200 else f"HTTP {r.status_code}"}

            elif req.type == "home_assistant":
                r = await c.get(f"{req.url}/api/",
                                headers={"Authorization": f"Bearer {req.token or ''}"})
                return {"ok": r.status_code == 200,
                        "detail": "Home Assistant connected" if r.status_code == 200 else f"HTTP {r.status_code}"}

            elif req.type == "portainer":
                r = await c.get(f"{req.url}/api/system/status",
                                headers={"X-API-Key": req.api_key or ""})
                return {"ok": r.status_code == 200,
                        "detail": "Portainer connected" if r.status_code == 200 else f"HTTP {r.status_code}"}

            elif req.type == "telegram":
                r = await c.get(f"https://api.telegram.org/bot{req.bot_token}/getMe")
                if r.status_code == 200:
                    name = r.json().get("result", {}).get("username", "?")
                    return {"ok": True, "detail": f"Telegram bot @{name} connected"}
                return {"ok": False, "detail": "Invalid bot token"}

            elif req.type == "ntfy":
                r = await c.get(req.url)
                return {"ok": r.status_code < 400,
                        "detail": "ntfy reachable" if r.status_code < 400 else f"HTTP {r.status_code}"}

            elif req.type == "technitium":
                r = await c.get(f"{req.url}/api/user/login",
                                params={"user": req.username, "pass": req.password})
                return {"ok": r.status_code == 200,
                        "detail": "Technitium connected" if r.status_code == 200 else f"HTTP {r.status_code}"}

            else:
                if req.url:
                    r = await c.get(req.url)
                    return {"ok": r.status_code < 400,
                            "detail": f"Reachable (HTTP {r.status_code})" if r.status_code < 400 else f"HTTP {r.status_code}"}
                return {"ok": False, "detail": "No URL provided"}

    except httpx.ConnectError:
        return {"ok": False, "detail": "Connection refused — check URL and that service is running"}
    except httpx.TimeoutException:
        return {"ok": False, "detail": "Timeout — no response in 6s"}
    except Exception as e:
        return {"ok": False, "detail": str(e)}
