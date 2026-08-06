"""Home Assistant bridge — optional live sensor readings for /api/sensors."""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

_CACHE: Dict[str, Any] = {"at": 0.0, "rows": []}
_CACHE_TTL_SEC = 30


def ha_configured() -> bool:
    return bool(
        os.environ.get("HOME_ASSISTANT_URL", "").strip()
        and os.environ.get("HOME_ASSISTANT_TOKEN", "").strip()
    )


def _map_status(state: str) -> str:
    s = (state or "").strip().lower()
    if s in {"unavailable", "unknown", "none", ""}:
        return "attention"
    if s in {"on", "open", "detected", "wet", "problem"}:
        return "critical"
    try:
        v = float(s)
        if v >= 80:
            return "attention"
    except ValueError:
        pass
    return "nominal"


def _map_kind(entity_id: str, device_class: str) -> str:
    dc = (device_class or "").lower()
    eid = (entity_id or "").lower()
    for key in ("temperature", "humidity", "occupancy", "moisture", "leak", "power", "energy", "battery"):
        if key in dc or key in eid:
            return key if key != "moisture" else "leak"
    return "sensor"


def fetch_ha_sensors(limit: int = 40) -> List[Dict[str, Any]]:
    """Return SPP-shaped sensor rows from Home Assistant states.

    Empty list when not configured or on failure (caller falls back to mongo/seed).
    """
    if not ha_configured():
        return []

    now = time.time()
    if _CACHE["rows"] and (now - float(_CACHE["at"])) < _CACHE_TTL_SEC:
        return list(_CACHE["rows"])[:limit]

    base = os.environ["HOME_ASSISTANT_URL"].rstrip("/")
    token = os.environ["HOME_ASSISTANT_TOKEN"].strip()
    prefix = (os.environ.get("HOME_ASSISTANT_ENTITY_PREFIX") or "sensor.").strip()
    url = f"{base}/api/states"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=int(os.environ.get("HOME_ASSISTANT_TIMEOUT_SECONDS", "20")))
        if resp.status_code >= 400:
            logger.warning("Home Assistant states failed status=%s", resp.status_code)
            return []
        states = resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Home Assistant request failed: %s", type(exc).__name__)
        return []

    rows: List[Dict[str, Any]] = []
    for ent in states or []:
        entity_id = str(ent.get("entity_id") or "")
        if prefix and not entity_id.startswith(prefix) and not entity_id.startswith("binary_sensor."):
            # Allow binary_sensor for leak/occupancy even when prefix is sensor.
            if not entity_id.startswith("sensor."):
                continue
        attrs = ent.get("attributes") or {}
        device_class = str(attrs.get("device_class") or "")
        kind = _map_kind(entity_id, device_class)
        raw_state = str(ent.get("state") or "")
        try:
            value = float(raw_state)
        except ValueError:
            value = 1.0 if raw_state.lower() in {"on", "open", "detected", "wet"} else 0.0
        unit = str(attrs.get("unit_of_measurement") or "")
        label = str(attrs.get("friendly_name") or entity_id)
        prop = str(attrs.get("spp_property_id") or attrs.get("property_id") or "prop_ha")
        rows.append(
            {
                "id": f"ha_{entity_id.replace('.', '_')}",
                "property_id": prop,
                "kind": kind,
                "label": label,
                "value": value,
                "unit": unit,
                "status": _map_status(raw_state),
                "trend": "flat",
                "source": "home_assistant",
                "entity_id": entity_id,
            }
        )
        if len(rows) >= max(limit, 1):
            break

    _CACHE["at"] = now
    _CACHE["rows"] = rows
    return list(rows)


def ha_status() -> Dict[str, Any]:
    configured = ha_configured()
    if not configured:
        return {"configured": False, "reachable": False, "sensor_count": 0}
    rows = fetch_ha_sensors(limit=5)
    return {
        "configured": True,
        "reachable": bool(rows) or _probe_alive(),
        "sensor_count": len(_CACHE.get("rows") or rows),
    }


def _probe_alive() -> bool:
    try:
        base = os.environ["HOME_ASSISTANT_URL"].rstrip("/")
        token = os.environ["HOME_ASSISTANT_TOKEN"].strip()
        resp = requests.get(
            f"{base}/api/",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        return resp.status_code < 500
    except Exception:
        return False
