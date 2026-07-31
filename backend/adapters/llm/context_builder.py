"""Controlled context builder — builds LLM context from persisted AI state only.

NEVER sends raw imported rows or complete uploaded documents.
Applies strict size limits to keep prompts small and focused.
"""

from __future__ import annotations

from typing import Any, Dict, Optional


def build_controlled_context(
    ai_state: Dict[str, Any],
    task: str = "answer",
    question: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a controlled LLM context from persisted AI state.

    Only includes these sections (never raw files):
        - canonical_portfolio_summary
        - property_knowledge summaries (not full tenant cards)
        - property_memory (capped at 5 assets)
        - normalized_lifecycle (capped at 3 items per list)
        - koil_reasoning (brief + top 3 recommendations)
        - executive_brief (key_numbers + property_status)
        - executive_intelligence (capped at 5 insights)
        - unified_smart_decisions (capped at 10 decisions)
        - normalized_gate (status + conflicts)

    Args:
        ai_state: The persisted AI state dict from _load_ai_state().
        task: The LLM task (answer, executive_summary, decision_explanation).
        question: Optional user question (for answer task).

    Returns:
        A dict with only the allowed context sections, capped and filtered.
    """
    ai_state = ai_state or {}

    # 1. Canonical portfolio summary (small, safe to include fully).
    cps = ai_state.get("canonical_portfolio_summary") or {}
    canonical_summary = {
        "units_count": cps.get("units_count", 0),
        "assets_count": cps.get("assets_count", 0),
        "life_events_count": cps.get("life_events_count", 0),
        "maintenance_count": cps.get("maintenance_count", 0),
        "settings": cps.get("settings") or {},
    }

    # 2. Property knowledge summary (extract counts only, not full tenant cards).
    pk = ai_state.get("property_knowledge") or {}
    pk_summary = {
        "tenant_count": len(pk.get("tenants") or []),
        "late_tenant_count": (pk.get("late") or {}).get("tenant_count", 0),
        "departed_count": (pk.get("lifecycle") or {}).get("departed_count", 0),
        "newcomers_count": (pk.get("lifecycle") or {}).get("newcomers_count", 0),
        "active_count": (pk.get("lifecycle") or {}).get("active_count", 0),
        "collection_total_expected": (pk.get("collection") or {}).get("total_expected", 0),
        "collection_total_collected": (pk.get("collection") or {}).get("total_collected", 0),
        "collection_total_unpaid": (pk.get("collection") or {}).get("total_unpaid", 0),
    }

    # 3. Property memory (capped at 5 assets, summary only).
    pm = ai_state.get("property_memory") or {}
    property_memory = {
        "summary": pm.get("summary") or {},
        "assets": [
            {
                "asset_id": a.get("asset_id"),
                "name": a.get("name"),
                "risk": a.get("risk"),
                "fault_count": a.get("fault_count"),
            }
            for a in (pm.get("assets") or [])[:5]
        ],
    }

    # 4. Normalized lifecycle (capped at 3 items per list).
    nl = ai_state.get("normalized_lifecycle") or {}
    normalized_lifecycle = {
        "summary": nl.get("summary") or {},
        "reporting_period": nl.get("reporting_period") or {},
        "departed": [
            {"tenant": d.get("tenant"), "unit": d.get("unit"), "reason": d.get("reason")}
            for d in (nl.get("departed") or [])[:3]
        ],
        "newcomers": [
            {"tenant": n.get("tenant"), "unit": n.get("unit")}
            for n in (nl.get("newcomers") or [])[:3]
        ],
        "late_tenants": [
            {
                "tenant": lt.get("tenant"),
                "unit": lt.get("unit"),
                "late_month_count": lt.get("late_month_count"),
                "total_unpaid": lt.get("total_unpaid"),
            }
            for lt in (nl.get("late_tenants") or [])[:3]
        ],
        "month_comparison": [
            {"month": m.get("month"), "revenue": m.get("revenue"), "collected": m.get("collected")}
            for m in (nl.get("month_comparison") or [])[:3]
        ],
    }

    # 5. Koïl reasoning (brief + top 3 recommendations only).
    kr = ai_state.get("koil_reasoning") or {}
    koil_reasoning = {
        "brief": kr.get("brief", ""),
        "top_recommendations": [
            {"action": r.get("action"), "priority": r.get("priority")}
            for r in (kr.get("recommendations") or [])[:3]
        ],
        "confidence": kr.get("confidence"),
    }

    # 6. Executive brief (key_numbers + property_status only).
    eb = ai_state.get("executive_brief") or {}
    executive_brief = {
        "property_status": eb.get("property_status", ""),
        "key_numbers": eb.get("key_numbers") or {},
    }

    # 7. Executive intelligence (capped at 5 insights).
    ei = ai_state.get("executive_intelligence") or {}
    executive_intelligence = {
        "insights": [
            {
                "headline": i.get("headline"),
                "why": i.get("why"),
                "action": i.get("action"),
                "confidence": i.get("confidence"),
            }
            for i in (ei.get("insights") or [])[:5]
        ],
    }

    # 8. Unified smart decisions (capped at 10, with key fields only).
    usd = ai_state.get("unified_smart_decisions") or []
    unified_decisions = [
        {
            "id": d.get("id"),
            "kind": d.get("kind"),
            "priority": d.get("priority"),
            "title": d.get("title"),
            "action": d.get("action"),
            "confidence": d.get("confidence_after_gate", d.get("confidence")),
            "requires_confirmation": d.get("requires_confirmation", True),
            "blocked_by_gate": d.get("blocked_by_gate", False),
            "gate_status": d.get("gate_status"),
            "tenant_name": d.get("tenant_name"),
            "unit_label": d.get("unit_label"),
        }
        for d in usd[:10]
    ]

    # 9. Normalized gate (status + conflicts only).
    ng = ai_state.get("normalized_gate") or {}
    normalized_gate = {
        "status": ng.get("status", "ok"),
        "confidence_cap": ng.get("confidence_cap", 100),
        "conflicts": [
            {
                "code": c.get("code"),
                "message": c.get("message"),
                "severity": c.get("severity"),
                "tenant_name": c.get("tenant_name"),
                "unit_label": c.get("unit_label"),
            }
            for c in (ng.get("conflicts") or [])[:5]
        ],
    }

    # Remove empty fields to keep the prompt small.
    context = {
        "analysis_id": ai_state.get("analysis_id"),
        "task": task,
        "locale": "ar",
        "question": question,
        "canonical_portfolio_summary": _remove_empty(canonical_summary),
        "property_knowledge_summary": _remove_empty(pk_summary),
        "property_memory": _remove_empty(property_memory),
        "normalized_lifecycle": _remove_empty(normalized_lifecycle),
        "koil_reasoning": _remove_empty(koil_reasoning),
        "executive_brief": _remove_empty(executive_brief),
        "executive_intelligence": _remove_empty(executive_intelligence),
        "unified_smart_decisions": unified_decisions,
        "normalized_gate": _remove_empty(normalized_gate),
    }

    return context


def _remove_empty(d: Dict[str, Any]) -> Dict[str, Any]:
    """Remove keys with None or empty values from a dict (non-recursive)."""
    return {k: v for k, v in d.items() if v is not None and v != "" and v != [] and v != {}}


def get_known_entities(context: Dict[str, Any]) -> Dict[str, set]:
    """Extract known entity names/labels from the context for validation.

    Returns sets of known tenant_names, unit_labels, decision_ids, and
    financial_values that the LLM response is allowed to reference.
    """
    tenant_names: set = set()
    unit_labels: set = set()
    decision_ids: set = set()
    financial_values: set = set()

    nl = context.get("normalized_lifecycle") or {}
    for d in (nl.get("departed") or []):
        if d.get("tenant"):
            tenant_names.add(d["tenant"].lower())
        if d.get("unit"):
            unit_labels.add(str(d["unit"]).lower())
    for n in (nl.get("newcomers") or []):
        if n.get("tenant"):
            tenant_names.add(n["tenant"].lower())
        if n.get("unit"):
            unit_labels.add(str(n["unit"]).lower())
    for lt in (nl.get("late_tenants") or []):
        if lt.get("tenant"):
            tenant_names.add(lt["tenant"].lower())
        if lt.get("unit"):
            unit_labels.add(str(lt["unit"]).lower())
        if lt.get("total_unpaid") is not None:
            financial_values.add(str(int(float(lt["total_unpaid"]))))

    for d in (context.get("unified_smart_decisions") or []):
        if d.get("id"):
            decision_ids.add(d["id"])
        if d.get("tenant_name"):
            tenant_names.add(d["tenant_name"].lower())
        if d.get("unit_label"):
            unit_labels.add(str(d["unit_label"]).lower())

    pks = context.get("property_knowledge_summary") or {}
    for key in ("collection_total_expected", "collection_total_collected", "collection_total_unpaid"):
        val = pks.get(key)
        if val is not None and val != 0:
            financial_values.add(str(int(float(val))))

    for mc in (nl.get("month_comparison") or []):
        if mc.get("revenue") is not None:
            financial_values.add(str(int(float(mc["revenue"]))))
        if mc.get("collected") is not None:
            financial_values.add(str(int(float(mc["collected"]))))

    return {
        "tenant_names": tenant_names,
        "unit_labels": unit_labels,
        "decision_ids": decision_ids,
        "financial_values": financial_values,
    }
