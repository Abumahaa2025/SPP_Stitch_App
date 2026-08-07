"""Green API WhatsApp — Blueprint Placeholder outbound rail.

Architecture (Blueprint §§3.2, 8.2, 13.3): outbound messaging is Placeholder.
The application opens native messenger deep links only; the server must not
dispatch via Green API until an approved RFC elevates the rail.

GREEN_API_* env may still be present for status/health honesty, but
``send_whatsapp_message`` never performs provider HTTP send.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional
from urllib.parse import quote


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
    dry_run: bool = True,
    approval_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Prepare a WhatsApp deep link only (no server dispatch).

    Returns:
      {
        ok: bool,
        channel: "wa_me" | "none",
        delivery_status: "ready_to_send" | "missing_phone",
        deep_link: optional str,
        server_dispatch: False,
        outbound_rail: "placeholder",
        approval_id: optional str,
        error: optional str,
      }
    """
    del dry_run  # retained for API compatibility; never enables Green dispatch
    digits = _digits(phone)
    deep = wa_me_fallback(digits, message) if digits else None
    if not digits:
        return {
            "ok": False,
            "channel": "none",
            "delivery_status": "missing_phone",
            "deep_link": None,
            "server_dispatch": False,
            "outbound_rail": "placeholder",
            "approval_id": approval_id,
            "error": "phone_missing",
        }

    return {
        "ok": True,
        "channel": "wa_me",
        "delivery_status": "ready_to_send",
        "deep_link": deep,
        "server_dispatch": False,
        "outbound_rail": "placeholder",
        "approval_bound": bool(approval_id),
        "approval_id": approval_id,
        "green_env_configured": green_configured(),
    }
