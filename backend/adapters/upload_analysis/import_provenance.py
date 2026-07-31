"""Field-level provenance and confidence — universal import rule (any client file)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def field_provenance(
    value: Any,
    *,
    source_file: str = "",
    source_sheet: str = "",
    source_row: int = 0,
    source_column: str = "",
    extraction: str = "",
    confidence: float = 0.0,
    reason: str = "",
    needs_review: bool = False,
) -> dict:
    conf = max(0.0, min(100.0, float(confidence)))
    return {
        "value": value,
        "source": {
            "file": source_file,
            "sheet": source_sheet,
            "row": source_row,
            "column": source_column,
        },
        "extraction": extraction,
        "confidence": round(conf, 1),
        "reason": reason,
        "needs_review": bool(needs_review) or conf < 55,
    }


def wrap_row_fields(row: dict, file_name: str, row_index: int) -> dict:
    """Attach provenance wrappers for key tenant/unit fields on a parsed row."""
    out = dict(row)
    prov: Dict[str, dict] = {}
    mapping = [
        ("tenant", "tenant", "column_map", 78),
        ("phone", "phone", "column_map", 85),
        ("contract", "contract", "column_map", 82),
        ("rent", "rent", "column_map", 80),
        ("paid", "paid", "column_map", 75),
        ("unit", "unit", "unit_parse", 88),
    ]
    for key, col_hint, method, base_conf in mapping:
        val = row.get(key)
        if val in (None, ""):
            continue
        extra = 8 if row.get(f"{key}_from_continuation") else 0
        prov[key] = field_provenance(
            val,
            source_file=file_name,
            source_row=row_index,
            source_column=col_hint,
            extraction=method if not row.get(f"{key}_from_continuation") else "continuation_row",
            confidence=min(100, base_conf + extra),
            reason="استخراج مباشر من الصف" if not row.get(f"{key}_from_continuation") else "دمج من صف تابع",
        )
    if row.get("payment_state") == "unclear":
        prov["payment_state"] = field_provenance(
            row.get("payment_state"),
            source_file=file_name,
            source_row=row_index,
            extraction="payment_rules",
            confidence=40,
            reason="حالة الدفع غير مؤكدة — لا يكفي غياب كلمة «دفع»",
            needs_review=True,
        )
    out["field_provenance"] = prov
    return out


def merge_provenance_from_continuation(
    target_prov: Dict[str, dict],
    source_prov: Dict[str, dict],
    field: str,
) -> None:
    if field not in source_prov:
        return
    sp = source_prov[field]
    if field in target_prov:
        existing = target_prov[field]
        if float(existing.get("confidence") or 0) >= float(sp.get("confidence") or 0):
            return
    target_prov[field] = {
        **sp,
        "extraction": "continuation_row",
        "reason": (sp.get("reason") or "") + " · مدمج من صف تابع",
    }


def provenance_summary(rows: List[dict]) -> dict:
    review = 0
    low_conf = 0
    for r in rows:
        fp = r.get("field_provenance") or {}
        for p in fp.values():
            if p.get("needs_review"):
                review += 1
            if float(p.get("confidence") or 100) < 60:
                low_conf += 1
    return {"fields_needing_review": review, "low_confidence_fields": low_conf}
