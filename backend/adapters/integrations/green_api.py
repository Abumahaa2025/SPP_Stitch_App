"""Green API WhatsApp send — optional server-side delivery.

When GREEN_API_INSTANCE_ID + GREEN_API_TOKEN are set, Koil / Smart Employee
can send via the API. Otherwise callers keep using wa.me deep links.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional
from urllib.parse import quote

import requests

logger = logging.getLogger(__name__)


def green_configured() -> bool:
    return bool(
        os.environ.get("GREEN_API_INSTANCE_ID", "").strip()
        and os.environ.get("GREEN_API_TOKEN", "").strip()
    )


def _digits(phone: str) -> str:
    return "".join(ch for ch in str(phone or "") if ch.isdigit())


def wa_me_fallback(phone: str, message: str) -> Optional[str]:
    d = _digits(phone)
    if not d:
        return None
    return f"https://wa.me/{d}?text={quote(message)}"


def send_whatsapp_message(
    phone: str,
    message: str,
    *,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Send a WhatsApp text via Green API, or return a wa.me deep link.

    Returns:
      {
        ok: bool,
        channel: "green_api" | "wa_me" | "none",
        delivery_status: "sent" | "ready_to_send" | "failed" | "missing_phone",
        deep_link: optional str,
        provider_id: optional str,
        error: optional str,
      }
    """
    digits = _digits(phone)
    deep = wa_me_fallback(digits, message) if digits else None
    if not digits:
        return {
            "ok": False,
            "channel": "none",
            "delivery_status": "missing_phone",
            "deep_link": None,
            "error": "phone_missing",
        }

    if not green_configured():
        return {
            "ok": True,
            "channel": "wa_me",
            "delivery_status": "ready_to_send",
            "deep_link": deep,
        }

    if dry_run:
        return {
            "ok": True,
            "channel": "green_api",
            "delivery_status": "ready_to_send",
            "deep_link": deep,
        }

    instance = os.environ["GREEN_API_INSTANCE_ID"].strip()
    token = os.environ["GREEN_API_TOKEN"].strip()
    base = (os.environ.get("GREEN_API_API_URL") or "https://api.green-api.com").rstrip("/")
    url = f"{base}/waInstance{instance}/sendMessage/{token}"
    chat_id = f"{digits}@c.us"
    try:
        resp = requests.post(
            url,
            json={"chatId": chat_id, "message": message},
            timeout=int(os.environ.get("GREEN_API_TIMEOUT_SECONDS", "30")),
        )
        if resp.status_code >= 400:
            logger.warning("Green API send failed status=%s", resp.status_code)
            return {
                "ok": False,
                "channel": "green_api",
                "delivery_status": "failed",
                "deep_link": deep,
                "error": f"http_{resp.status_code}",
            }
        data = resp.json() if resp.text else {}
        return {
            "ok": True,
            "channel": "green_api",
            "delivery_status": "sent",
            "deep_link": deep,
            "provider_id": str(data.get("idMessage") or data.get("id") or ""),
        }
    except Exception as exc:  # noqa: BLE001 — never break employee flow
        logger.warning("Green API send exception: %s", type(exc).__name__)
        return {
            "ok": False,
            "channel": "green_api",
            "delivery_status": "failed",
            "deep_link": deep,
            "error": type(exc).__name__,
        }
