"""Map SPP_Official getAppData → Emergent NotifT[]."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from adapters.mappers.common import slug


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _priority_from_level(level: str) -> str:
    level = level or ""
    if "عالي" in level or "critical" in level.lower():
        return "critical"
    if "متوسط" in level or "high" in level.lower():
        return "high"
    return "medium"


def map_notifications_from_app_data(app_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    notifications: List[Dict[str, Any]] = []

    for index, pred in enumerate(app_data.get("predictions") or []):
        notifications.append(
            {
                "id": f"n_pred_{slug(str(pred.get('title') or index))}",
                "title": str(pred.get("title") or "Portfolio alert"),
                "body": str(pred.get("recommendation") or pred.get("description") or ""),
                "priority": _priority_from_level(str(pred.get("level") or "")),
                "at": _iso(now - timedelta(hours=index + 1)),
                "read": False,
            }
        )

    for index, item in enumerate(app_data.get("maintenanceRequests") or []):
        status = str(item.get("status") or "")
        if "مكتمل" in status:
            continue
        risk = str(item.get("risk") or "")
        notifications.append(
            {
                "id": f"n_m_{slug(str(item.get('ticketNo') or str(index)))}",
                "title": str(item.get("type") or "Maintenance alert"),
                "body": f"{item.get('unit', '')} — {status}",
                "priority": _priority_from_level(risk) if risk else "high",
                "at": _iso(now - timedelta(hours=3 + index)),
                "read": False,
            }
        )

    for index, msg in enumerate((app_data.get("messages") or [])[:5]):
        notifications.append(
            {
                "id": f"n_msg_{index}",
                "title": str(msg.get("category") or "Message"),
                "body": f"{msg.get('phone', '')} · {msg.get('status', '')}",
                "priority": "medium",
                "at": _iso(now - timedelta(hours=6 + index)),
                "read": False,
            }
        )

    for index, unit in enumerate((app_data.get("dashboard") or {}).get("latePayments") or []):
        notifications.append(
            {
                "id": f"n_late_{slug(str(unit.get('unit') or index))}",
                "title": "Late payment",
                "body": f"{unit.get('tenant', '')} · {unit.get('unit', '')}",
                "priority": "high",
                "at": _iso(now - timedelta(hours=8 + index)),
                "read": False,
            }
        )

    notifications.sort(key=lambda n: n["at"], reverse=True)
    return notifications
