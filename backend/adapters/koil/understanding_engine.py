"""Koil AI Understanding — Layer 2: files, columns, relationships (no math)."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Literal, Optional

from adapters.upload_analysis.intake_classifier import month_label

from .understanding_llm import enhance_understanding_with_llm

Lang = Literal["ar", "en"]

VERSION = "koil-understanding-v1"


def _tenant_key(name: str) -> str:
    return "".join((name or "").lower().split())


def _labels(lang: Lang) -> dict:
    if lang == "ar":
        return {
            "rent_roll": "كشف إيجار شهري",
            "expense": "مصروفات / صيانة",
            "unknown": "مستند غير محدد",
            "month_gap": "شهر مفقود في السلسلة",
            "tenant_change": "تغيّر مستأجر على نفس الوحدة",
            "stable_tenant": "استمرار نفس المستأجر",
            "commercial_mix": "مزيج سكني وتجاري",
            "low_columns": "تعيين أعمدة ضعيف",
            "no_content": "لم يُقرأ محتوى الملف",
            "parse_fail": "فشل قراءة الكشف",
        }
    return {
        "rent_roll": "Monthly rent roll",
        "expense": "Expenses / maintenance",
        "unknown": "Unclassified document",
        "month_gap": "Missing month in sequence",
        "tenant_change": "Tenant change on same unit",
        "stable_tenant": "Same tenant continued",
        "commercial_mix": "Residential + commercial mix",
        "low_columns": "Weak column mapping",
        "no_content": "File content not read",
        "parse_fail": "Rent roll parse failed",
    }


def _rolls_by_name(parsed_rolls: List[dict]) -> Dict[str, dict]:
    out: Dict[str, dict] = {}
    for pr in parsed_rolls or []:
        name = (pr.get("file_name") or "").strip()
        if name:
            out[name] = pr
    return out


def _file_understood_as(fc: dict, pr: Optional[dict], labels: dict) -> str:
    cat = fc.get("category") or ""
    month = int(fc.get("month") or 0)
    year = int(fc.get("year") or 0)
    if cat in ("rent_roll", "comprehensive"):
        ml = month_label(month, "ar") if month else ""
        base = labels["rent_roll"]
        if month:
            return f"{base} — {ml} {year}".strip()
        return base
    if cat in ("maintenance", "expense"):
        return labels["expense"]
    if pr and pr.get("ok"):
        return labels["rent_roll"]
    return labels["unknown"]


def _column_notes(pr: dict, lang: Lang) -> List[str]:
    notes: List[str] = []
    labels = pr.get("column_labels") or {}
    conf = float(pr.get("column_confidence") or 0)
    if labels:
        mapped = " · ".join(f"{k}←{v}" for k, v in labels.items())
        notes.append(
            f"ربط الأعمدة ({conf:.0f}%): {mapped}"
            if lang == "ar"
            else f"Column map ({conf:.0f}%): {mapped}"
        )
    if conf < 60:
        notes.append(
            "تعيين الأعمدة يحتاج مراجعة — بعض الحقول غير واضحة"
            if lang == "ar"
            else "Column mapping needs review"
        )
    return notes


def _unit_mix_notes(pr: dict, lang: Lang) -> List[str]:
    rows = pr.get("rows") or []
    if not rows:
        return []
    shops = sum(1 for r in rows if (r.get("unit_type") or "") not in ("", "شقة"))
    apts = len(rows) - shops
    if shops and apts:
        if lang == "ar":
            return [f"الكشف يخلط سكني ({apts}) وتجاري ({shops}) — سأتابع كل نوع بقواعده."]
        return [f"Mix of residential ({apts}) and commercial ({shops}) units."]
    return []


def _build_file_insights(
    files: List[dict],
    classifications: List[dict],
    parsed_rolls: List[dict],
    parse_errors: List[dict],
    files_without_content: List[dict],
    lang: Lang,
) -> List[dict]:
    labels = _labels(lang)
    rolls = _rolls_by_name(parsed_rolls)
    errors_by_name = {(e.get("file_name") or ""): e.get("error") for e in parse_errors}
    no_content = {f.get("file_name") for f in files_without_content}

    out: List[dict] = []
    seen_names: set = set()

    for fc in classifications:
        name = fc.get("name") or ""
        seen_names.add(name)
        pr = rolls.get(name)
        notes: List[str] = []
        confidence = float(fc.get("confidence") or 70)

        if name in no_content:
            notes.append(labels["no_content"])
            confidence = min(confidence, 25)
        elif name in errors_by_name:
            notes.append(f"{labels['parse_fail']}: {errors_by_name[name]}")
            confidence = min(confidence, 35)
        elif pr:
            confidence = max(confidence, float(pr.get("column_confidence") or 0))
            notes.extend(_column_notes(pr, lang))
            notes.extend(_unit_mix_notes(pr, lang))
            rc = int(pr.get("row_count") or 0)
            if rc:
                notes.append(
                    f"قرأت {rc} صف مستأجر/وحدة"
                    if lang == "ar"
                    else f"Read {rc} tenant/unit rows"
                )

        out.append(
            {
                "name": name,
                "role": fc.get("category") or "unknown",
                "understood_as": _file_understood_as(fc, pr, labels),
                "month": fc.get("month"),
                "year": fc.get("year"),
                "confidence": round(confidence, 1),
                "notes": notes,
            }
        )

    for f in files:
        name = f.get("name") or ""
        if name in seen_names:
            continue
        out.append(
            {
                "name": name,
                "role": "unknown",
                "understood_as": labels["unknown"],
                "month": None,
                "year": None,
                "confidence": 20.0,
                "notes": [labels["no_content"] if not (f.get("textSnippet") or f.get("contentPreview")) else labels["parse_fail"]],
            }
        )

    return out


def _month_relationships(parsed_rolls: List[dict], lang: Lang) -> List[dict]:
    labels = _labels(lang)
    rels: List[dict] = []
    months = sorted(
        {
            (int(pr.get("year") or 0), int(pr.get("month") or 0))
            for pr in (parsed_rolls or [])
            if pr.get("month")
        }
    )
    if len(months) >= 2:
        gaps = []
        for i in range(1, len(months)):
            py, pm = months[i - 1]
            cy, cm = months[i]
            expected = cm - 1 if cm > 1 else 12
            ey = py if cm > 1 else py + 1
            if (cy, cm) != (ey, expected) and not (pm == 12 and cm == 1 and cy == py + 1):
                gaps.append(month_label(expected, lang))
        if gaps:
            rels.append(
                {
                    "text": f"{labels['month_gap']}: {', '.join(gaps)}",
                    "evidence": [f"m:{y}-{m}" for y, m in months],
                }
            )

    by_month: Dict[tuple, List[dict]] = {}
    for pr in parsed_rolls or []:
        key = (int(pr.get("year") or 0), int(pr.get("month") or 0))
        by_month.setdefault(key, []).extend(pr.get("rows") or [])

    month_keys = sorted(by_month.keys())
    if len(month_keys) >= 2:
        prev_rows = {str(r.get("unit") or ""): r for r in by_month[month_keys[0]]}
        for idx in range(1, len(month_keys)):
            mk = month_keys[idx]
            changes = 0
            stable = 0
            for r in by_month[mk]:
                unit = str(r.get("unit") or "")
                if not unit or unit not in prev_rows:
                    continue
                pt = _tenant_key(prev_rows[unit].get("tenant") or "")
                ct = _tenant_key(r.get("tenant") or "")
                if pt and ct and pt != ct:
                    changes += 1
                elif pt and ct and pt == ct:
                    stable += 1
            _, ppm = month_keys[idx - 1]
            cy, cm = mk
            ml = month_label(cm, lang)
            if changes:
                rels.append(
                    {
                        "text": (
                            f"بين {month_label(ppm, lang)} و{ml}: {changes} وحدة غيّرت مستأجرها"
                            if lang == "ar"
                            else f"Between {month_label(ppm, lang)} and {ml}: {changes} tenant changes"
                        ),
                        "evidence": [f"unit_change:{cy}-{cm}"],
                    }
                )
            if stable >= 3:
                rels.append(
                    {
                        "text": (
                            f"في {ml}: {stable} وحدة استمر مستأجوها دون تغيير"
                            if lang == "ar"
                            else f"In {ml}: {stable} units kept the same tenant"
                        ),
                        "evidence": [f"stable:{cy}-{cm}"],
                    }
                )
            prev_rows = {str(r.get("unit") or ""): r for r in by_month[mk]}

    return rels[:8]


def _collect_ambiguities(parsed_rolls: List[dict], lang: Lang) -> List[dict]:
    labels = _labels(lang)
    amb: List[dict] = []
    review_units = 0
    unclear_pay = 0
    for pr in parsed_rolls or []:
        for r in pr.get("rows") or []:
            if r.get("unit_needs_review") or r.get("shop_needs_review"):
                review_units += 1
            if r.get("payment_state") == "unclear":
                unclear_pay += 1
        if float(pr.get("column_confidence") or 100) < 55:
            amb.append(
                {
                    "text": (
                        f"{pr.get('file_name')}: {labels['low_columns']}"
                        if lang == "ar"
                        else f"{pr.get('file_name')}: {labels['low_columns']}"
                    ),
                    "needs_review": True,
                }
            )
    if review_units:
        amb.append(
            {
                "text": (
                    f"{review_units} وحدة تحتاج تأكيد هوية (محل/شقة بدون رقم واضح)"
                    if lang == "ar"
                    else f"{review_units} units need identity confirmation"
                ),
                "needs_review": True,
            }
        )
    if unclear_pay:
        amb.append(
            {
                "text": (
                    f"{unclear_pay} صف حالة دفع غير واضحة — لا أحكم «متأخر» من الغياب فقط"
                    if lang == "ar"
                    else f"{unclear_pay} rows with unclear payment status"
                ),
                "needs_review": True,
            }
        )
    return amb[:10]


def _portfolio_summary(
    file_insights: List[dict],
    parsed_rolls: List[dict],
    relationships: List[dict],
    ambiguities: List[dict],
    lang: Lang,
) -> str:
    n_files = len(file_insights)
    n_months = len({int(pr.get("month") or 0) for pr in parsed_rolls if pr.get("month")})
    n_rows = sum(int(pr.get("row_count") or 0) for pr in parsed_rolls)
    ok_files = sum(1 for f in file_insights if f.get("confidence", 0) >= 55)

    if lang == "ar":
        parts = [
            f"فهمت {n_files} ملفًا — {ok_files} بثقة جيدة.",
            f"ربطت {n_months} شهرًا وقرأت {n_rows} صفًا من الكشوف.",
        ]
        if relationships:
            parts.append(f"اكتشفت {len(relationships)} علاقة بين الأشهر.")
        if ambiguities:
            parts.append(f"{len(ambiguities)} نقطة تحتاج مراجعتك قبل الاعتماد.")
        return " ".join(parts)

    parts = [
        f"Understood {n_files} files — {ok_files} with good confidence.",
        f"Linked {n_months} months and read {n_rows} rows.",
    ]
    if relationships:
        parts.append(f"Found {len(relationships)} cross-month relationships.")
    if ambiguities:
        parts.append(f"{len(ambiguities)} items need your review before applying.")
    return " ".join(parts)


def _merge_llm(base: dict, llm: dict) -> dict:
    if not llm:
        return base
    merged = dict(base)
    if llm.get("portfolio_summary"):
        merged["portfolio_summary"] = llm["portfolio_summary"]
        merged["mode"] = "ai_enhanced"
    for key in ("relationships", "ambiguities"):
        extra = llm.get(key) or []
        if extra:
            existing = list(merged.get(key) or [])
            seen = {x.get("text") for x in existing}
            for item in extra:
                t = item.get("text") if isinstance(item, dict) else str(item)
                if t and t not in seen:
                    existing.append(item if isinstance(item, dict) else {"text": t, "needs_review": False})
                    seen.add(t)
            merged[key] = existing[:12]
    llm_files = {f.get("name"): f for f in (llm.get("files") or []) if f.get("name")}
    files_out = []
    for f in base.get("files") or []:
        nf = dict(f)
        lf = llm_files.get(f.get("name"))
        if lf:
            if lf.get("understood_as"):
                nf["understood_as"] = lf["understood_as"]
            extra_notes = lf.get("notes") or []
            if extra_notes:
                nf["notes"] = list(dict.fromkeys((nf.get("notes") or []) + extra_notes))[:6]
        files_out.append(nf)
    merged["files"] = files_out
    return merged


def deep_stub_from_gas(report: dict, files: List[dict]) -> dict:
    """Minimal deep-shaped dict for understanding when GAS path is used."""
    report = report or {}
    dr = report.get("detailedReport") or {}
    monthly = dr.get("monthlyBreakdown") or report.get("monthlyRolls") or []
    parsed_rolls = []
    for m in monthly:
        parsed_rolls.append(
            {
                "ok": True,
                "month": m.get("month"),
                "year": m.get("year"),
                "file_name": m.get("fileName") or m.get("file_name") or "",
                "row_count": m.get("rowCount") or m.get("tenantCount") or 0,
                "rows": [],
                "column_confidence": 75,
            }
        )
    classifications = []
    for f in files or []:
        name = f.get("name") or ""
        month_m = re.search(r"شهر\s*(\d+)", name) or re.search(r"month\s*(\d+)", name, re.I)
        classifications.append(
            {
                "name": name,
                "category": "rent_roll",
                "confidence": 80,
                "month": int(month_m.group(1)) if month_m else None,
                "year": 2026,
            }
        )
    return {
        "file_classifications": classifications,
        "parsed_rolls": parsed_rolls,
        "parse_errors": report.get("parseErrors") or [],
        "files_without_content": report.get("filesWithoutContent") or [],
        "quality_log": report.get("qualityLog") or [],
        "lifecycle": report.get("lifecycle") or {},
    }


def run_koil_understanding(
    files: List[dict],
    deep: dict,
    lang: Lang = "ar",
) -> dict:
    """Layer 2 — structural understanding before property knowledge."""
    deep = deep or {}
    classifications = deep.get("file_classifications") or []
    parsed_rolls = deep.get("parsed_rolls") or []
    parse_errors = deep.get("parse_errors") or []
    files_without_content = deep.get("files_without_content") or []

    file_insights = _build_file_insights(
        files, classifications, parsed_rolls, parse_errors, files_without_content, lang
    )
    relationships = _month_relationships(parsed_rolls, lang)
    ambiguities = _collect_ambiguities(parsed_rolls, lang)
    summary = _portfolio_summary(file_insights, parsed_rolls, relationships, ambiguities, lang)

    confs = [float(f.get("confidence") or 0) for f in file_insights]
    avg_conf = round(sum(confs) / len(confs), 1) if confs else 0.0

    result = {
        "version": VERSION,
        "mode": "rules",
        "confidence": avg_conf,
        "portfolio_summary": summary,
        "files": file_insights,
        "relationships": relationships,
        "ambiguities": ambiguities,
    }

    compact = {
        "files": [
            {
                "name": f.get("name"),
                "role": f.get("role"),
                "understood_as": f.get("understood_as"),
                "month": f.get("month"),
                "notes": f.get("notes"),
                "column_labels": _rolls_by_name(parsed_rolls).get(f.get("name") or "", {}).get("column_labels"),
            }
            for f in file_insights[:8]
        ],
        "relationships": [r.get("text") for r in relationships[:6]],
        "ambiguities": [a.get("text") for a in ambiguities[:6]],
    }
    llm = enhance_understanding_with_llm(compact)
    result = _merge_llm(result, llm or {})
    if result.get("mode") == "ai_enhanced":
        result["confidence"] = min(100.0, avg_conf + 8)
    return result
