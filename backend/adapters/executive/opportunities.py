"""Opportunity engine — surfaces upside, not only risk."""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, List

from adapters.mappers.brain_copy import contract_renewal_guidance, days_until, fmt_money_ar


def _prop_map(properties: List[dict]) -> Dict[str, dict]:
    return {p["id"]: p for p in properties if p.get("id")}


def discover_opportunities(
    properties: List[dict],
    tenants: List[dict],
    contracts: List[dict],
    decisions: List[dict],
) -> List[dict]:
    props = _prop_map(properties)
    opportunities: List[dict] = []

    # 1) Rent uplift at renewal — healthy occupied units nearing renewal
    for contract in contracts:
        if contract.get("status") != "expiring":
            continue
        pid = contract.get("property_id")
        prop = props.get(pid or "", {})
        if prop.get("occupancy", 0) < 0.9 or prop.get("health_score", 0) < 70:
            continue
        end_days = days_until(contract.get("end", ""))
        if end_days is None or end_days < 0 or end_days > 60:
            continue
        rent = float(contract.get("monthly_rent") or prop.get("monthly_revenue") or 0)
        uplift = round(rent * 0.07)
        tenant = next((t for t in tenants if t.get("property_id") == pid), {})
        name = tenant.get("name") or prop.get("name") or "المستأجر"
        opportunities.append(
            {
                "id": f"opp_uplift_{pid}",
                "kind": "rent_uplift",
                "title": f"فرصة رفع إيجار {name}",
                "why": f"الوحدة بصحة جيدة — اقترح زيادة ٥–٧٪ عند التجديد ({contract_renewal_guidance(end_days)}).",
                "action": "جهّز عرض تجديد بسعر محدّث",
                "impact_aed": uplift * 12,
                "score": 62.0,
                "property_id": pid,
                "route": "/contracts",
            }
        )

    # 2) Batch maintenance — multiple open tickets
    maint_by_unit: Dict[str, List[dict]] = defaultdict(list)
    for d in decisions:
        if d.get("kind") != "maintenance":
            continue
        pid = d.get("property_id")
        if pid:
            maint_by_unit[pid].append(d)
    for pid, group in maint_by_unit.items():
        if len(group) < 2:
            continue
        prop = props.get(pid, {})
        opportunities.append(
            {
                "id": f"opp_maint_batch_{pid}",
                "kind": "maintenance_batch",
                "title": f"دمج صيانة {prop.get('name', 'الوحدة')}",
                "why": f"{len(group)} بلاغات مفتوحة — زيارة واحدة توفر وقت الفريق وتكلفة التنقل.",
                "action": "اجمع البلاغات في أمر عمل واحد",
                "impact_aed": 800 * (len(group) - 1),
                "score": 58.0,
                "property_id": pid,
                "route": "/maintenance",
            }
        )

    # 3) Collection campaign — multiple late payments
    financial = [d for d in decisions if d.get("kind") == "financial"]
    if len(financial) >= 3:
        total_rent = sum(
            float(props.get(d.get("property_id", ""), {}).get("monthly_revenue") or 0)
            for d in financial
        )
        opportunities.append(
            {
                "id": "opp_collection_batch",
                "kind": "collection",
                "title": "حملة تحصيل موحّدة",
                "why": f"{len(financial)} وحدة متأخرة — اتصال واحد اليوم يعيد التدفق النقدي.",
                "action": "خصص ساعة تحصيل واتصل بالقائمة كاملة",
                "impact_aed": round(total_rent),
                "score": 65.0,
                "property_id": None,
                "route": "/",
            }
        )

    # 4) Vacancy cost reduction — portfolio with multiple vacant units
    vacant = [p for p in properties if p.get("occupancy", 0) < 0.5]
    if len(vacant) >= 2:
        lost = sum(float(p.get("monthly_revenue") or 0) for p in vacant)
        opportunities.append(
            {
                "id": "opp_vacancy_push",
                "kind": "vacancy",
                "title": f"تسريع تأجير {len(vacant)} وحدة شاغرة",
                "why": "كل شهر شاغر يحرق إيراداً مباشراً — ركّز التسويق هذا الأسبوع.",
                "action": "راجع التسعير وانشر حزمة تسويق موحّدة",
                "impact_aed": round(lost * 2),
                "score": 55.0,
                "property_id": None,
                "route": "/portfolio",
            }
        )

    opportunities.sort(key=lambda o: -o["score"])
    return opportunities[:12]
