"""Aggregate integration status for Settings / Profile pills."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict

from adapters.gas_client import GasClient, GasClientError
from .green_api import green_configured
from .home_assistant import ha_status

logger = logging.getLogger(__name__)


def _sheets_status() -> Dict[str, Any]:
    url = (os.environ.get("GOOGLE_APPS_SCRIPT_URL") or "").strip()
    configured = bool(url)
    if not configured:
        return {
            "id": "sheets",
            "configured": False,
            "status": "not_connected",
            "label": "Google Sheets / GAS",
            "detail": "GOOGLE_APPS_SCRIPT_URL not set",
        }
    client = GasClient()
    reachable = False
    detail = "configured"
    try:
        # Lightweight probe — get_properties_lite if available, else configured-only.
        if hasattr(client, "get_properties_lite"):
            client.get_properties_lite()
            reachable = True
            detail = "gas_reachable"
        else:
            reachable = client.configured
            detail = "url_configured"
    except GasClientError as exc:
        detail = str(exc)[:120]
        reachable = False
    except Exception as exc:  # noqa: BLE001
        detail = type(exc).__name__
        reachable = False
    return {
        "id": "sheets",
        "configured": True,
        "status": "active" if reachable else "configured",
        "label": "Google Sheets / GAS",
        "detail": detail,
        "reachable": reachable,
    }


def _green_status() -> Dict[str, Any]:
    configured = green_configured()
    return {
        "id": "whatsapp",
        "configured": configured,
        "status": "active" if configured else "not_connected",
        "label": "WhatsApp · Green API",
        "detail": "GREEN_API_INSTANCE_ID + GREEN_API_TOKEN" if configured else "env keys missing",
        "provider": "green_api",
        "fallback": "wa_me",
    }


def _ha_status_row() -> Dict[str, Any]:
    ha = ha_status()
    configured = bool(ha.get("configured"))
    reachable = bool(ha.get("reachable"))
    status = "not_connected"
    if configured and reachable:
        status = "active"
    elif configured:
        status = "configured"
    return {
        "id": "home_assistant",
        "configured": configured,
        "status": status,
        "label": "Home Assistant",
        "detail": f"sensors≈{ha.get('sensor_count', 0)}" if configured else "HOME_ASSISTANT_URL/TOKEN missing",
        "reachable": reachable,
        "sensor_count": ha.get("sensor_count", 0),
    }


def integration_status() -> Dict[str, Any]:
    sheets = _sheets_status()
    green = _green_status()
    ha = _ha_status_row()
    return {
        "ok": True,
        "services": {
            "sheets": sheets,
            "whatsapp": green,
            "home_assistant": ha,
        },
        "list": [sheets, green, ha],
    }
