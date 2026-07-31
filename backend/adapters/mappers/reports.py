"""Map SPP_Official getAppData → Emergent ReportT[]."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def map_reports_from_app_data(app_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    settings = app_data.get("settings") or {}
    report = app_data.get("report") or {}
    health = app_data.get("propertyHealth") or {}
    dashboard = app_data.get("dashboard") or {}
    summary = dashboard.get("summary") or {}
    expenses = app_data.get("expenses") or {}
    now = datetime.now(timezone.utc)
    portfolio = settings.get("propertyName") or settings.get("clientName") or "Portfolio"

    collection = report.get("collectionRate", 0)
    health_score = health.get("score", 0)
    net_profit = expenses.get("netProfit", 0)
    rented = summary.get("rented", 0)
    total = summary.get("totalUnits", 0)

    return [
        {
            "id": "r_monthly",
            "kind": "monthly",
            "title": "Monthly Portfolio Review",
            "subtitle": f"AI-authored · {portfolio}",
            "highlight": f"Collection {collection}% · Health {health_score}",
            "created_at": _iso(now - timedelta(days=2)),
            "pages": 10,
            "accent": "gold",
        },
        {
            "id": "r_financial",
            "kind": "financial",
            "title": "Yield & Cashflow",
            "subtitle": "Live sheet data",
            "highlight": f"Net profit ≈ {net_profit:,.0f} · {rented}/{total} units rented",
            "created_at": _iso(now - timedelta(days=7)),
            "pages": 8,
            "accent": "emerald",
        },
        {
            "id": "r_collection",
            "kind": "financial",
            "title": "Collection Performance",
            "subtitle": portfolio,
            "highlight": f"Late total ≈ {report.get('lateTotal', 0):,.0f}",
            "created_at": _iso(now - timedelta(days=12)),
            "pages": 6,
            "accent": "gold",
        },
    ]
