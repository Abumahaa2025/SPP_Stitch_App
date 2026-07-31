"""Single production entry for portfolio upload analysis — same path as API."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

from adapters.gas_import_bridge import analyze_upload_with_gas_fallback

Lang = Literal["ar", "en"]


def get_portfolio_analysis_context() -> Dict[str, Any]:
    """Portfolio context matching beta-mode upload API (_portfolio_live_context shape)."""
    from beta_seed import beta_dataset

    data = beta_dataset("owner")
    return {
        "settings": {},
        "properties": data.get("properties", []),
        "tenants": data.get("tenants", []),
        "contracts": data.get("contracts", []),
        "decisions": data.get("decisions", []),
        "reports": data.get("reports", []),
    }


def run_production_portfolio_analysis(
    files: List[dict],
    lang: Lang = "ar",
    ctx: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Universal Import production pipeline:
    GAS Smart Property when configured → else Python portfolio engine.
    Same function as POST /api/upload/portfolio-analysis.
    """
    payload = analyze_upload_with_gas_fallback(
        files,
        ctx or get_portfolio_analysis_context(),
        lang,
    )
    engine = (payload.get("intake_meta") or {}).get("engine") or "unknown"
    payload.setdefault("pipeline", {})
    if isinstance(payload["pipeline"], dict):
        payload["pipeline"]["entry"] = "production"
        payload["pipeline"]["engine"] = engine
    return payload
