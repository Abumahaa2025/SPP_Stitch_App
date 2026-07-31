"""Shared assertions for SPP benchmark regression (all levels)."""

from __future__ import annotations

from typing import Any, Dict, List

GENERIC_PHRASES = (
    "التحصيل مستقر ولا تغيّرات حرجة",
    "لا مخاطر حرجة مكتشفة",
    "لا إجراء عاجل",
    "Stable period",
    "No critical risks",
    "No urgent action",
)


def collect_koil_texts(koil: dict) -> List[str]:
    texts: List[str] = []
    for key in ("what_happened", "why", "risks", "recommendations"):
        for item in koil.get(key) or []:
            texts.append(item.get("text") or item.get("action") or "")
    return [t for t in texts if t.strip()]


def is_generic_only(texts: List[str]) -> bool:
    if not texts:
        return True
    non_generic = [t for t in texts if not any(g in t for g in GENERIC_PHRASES)]
    return len(non_generic) == 0


def count_specific(texts: List[str], markers: List[str]) -> int:
    if not markers:
        return len([t for t in texts if t.strip() and not any(g in t for g in GENERIC_PHRASES)])
    return sum(1 for t in texts if any(m in t for m in markers))


def assert_koil(koil: dict, rules: dict, errors: List[str]) -> None:
    if koil.get("version") != rules.get("version", "koil-reasoning-v1"):
        errors.append(f"koil version expected {rules.get('version')}, got {koil.get('version')}")

    what = koil.get("what_happened") or []
    if len(what) < int(rules.get("min_what_items") or 1):
        errors.append(f"what_happened count {len(what)} < min {rules.get('min_what_items')}")

    if rules.get("require_evidence"):
        for block in ("what_happened", "why", "risks", "recommendations"):
            for item in koil.get(block) or []:
                if not (item.get("evidence") or []):
                    errors.append(f"missing evidence on {block} item {item.get('id')}")

    texts = collect_koil_texts(koil)
    if rules.get("reject_generic_only") and is_generic_only(texts):
        errors.append("koil output is generic-only (no data-specific inferences)")

    markers = rules.get("specific_markers") or []
    min_spec = int(rules.get("min_specific_inferences") or 0)
    if min_spec and count_specific(texts, markers) < min_spec:
        errors.append(f"specific inferences {count_specific(texts, markers)} < {min_spec}")

    risk_kw = rules.get("must_include_risk_keywords") or []
    if risk_kw:
        risk_text = " ".join(item.get("text") or "" for item in koil.get("risks") or [])
        if not any(kw in risk_text for kw in risk_kw):
            errors.append(f"risks missing keywords: {risk_kw}")

    recs = koil.get("recommendations") or []
    if int(rules.get("min_recommendations") or 0) and len(recs) < int(rules["min_recommendations"]):
        errors.append(f"recommendations {len(recs)} < {rules['min_recommendations']}")


def assert_metrics(metrics: dict, rules: dict, errors: List[str]) -> None:
    def _get(key: str, *aliases: str):
        for k in (key, *aliases):
            if k in metrics and metrics[k] is not None:
                return metrics[k]
        return None

    if "total_units" in rules:
        val = _get("total_units", "units")
        if int(val or 0) != int(rules["total_units"]):
            errors.append(f"total_units {val} != {rules['total_units']}")
    if "apartment_count" in rules:
        val = _get("apartment_count", "residential_units")
        if int(val or 0) != int(rules["apartment_count"]):
            errors.append(f"apartment_count {val} != {rules['apartment_count']}")
    if "shop_count" in rules:
        val = _get("shop_count", "commercial_units")
        if int(val or 0) != int(rules["shop_count"]):
            errors.append(f"shop_count {val} != {rules['shop_count']}")
    if int(metrics.get("months_linked") or 0) < int(rules.get("min_months_linked") or 0):
        errors.append(f"months_linked {metrics.get('months_linked')} < {rules.get('min_months_linked')}")
    min_units = rules.get("min_total_units")
    if min_units is not None:
        val = int(_get("total_units", "units") or 0)
        if val < int(min_units):
            errors.append(f"units {val} < min_total_units {min_units}")
    if int(metrics.get("files_analyzed") or 0) < int(rules.get("min_files_analyzed") or 0):
        errors.append(f"files_analyzed {metrics.get('files_analyzed')} < {rules.get('min_files_analyzed')}")


def assert_sections(report: dict, required_keys: List[str], errors: List[str]) -> None:
    keys = {s.get("key") for s in (report.get("sections") or [])}
    for k in required_keys:
        if k not in keys:
            errors.append(f"missing executive section: {k}")


def assert_brief(success_message: str, prefix: str, errors: List[str], lang: str = "ar") -> None:
    if not prefix:
        return
    alt = "Koil" if prefix == "كويل" else prefix
    ok = (success_message or "").startswith(prefix) or (lang == "en" and (success_message or "").startswith(alt))
    if not ok:
        errors.append(f"success_message must start with '{prefix}' (or Koil for en), got: {(success_message or '')[:60]}")
