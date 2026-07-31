"""Beta-safe fictional portfolio — never uses Google Sheets or real tenant names."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Literal

Persona = Literal["owner", "tenant", "technician"]

BETA_ACCOUNTS: Dict[str, Dict[str, str]] = {
    "demo.owner@spp.beta": {"password": "SPP-Owner-26", "persona": "owner"},
    "demo.tenant@spp.beta": {"password": "SPP-Tenant-26", "persona": "tenant"},
    "demo.tech@spp.beta": {"password": "SPP-Tech-26", "persona": "technician"},
}


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def beta_dataset(persona: Persona = "owner") -> Dict[str, List[dict]]:
    """Fictional UAE portfolio for external beta testers."""
    now = datetime.now(timezone.utc)

    owners = [
        {
            "id": "own_beta",
            "name": "أحمد المنصوري",
            "portfolio_value": 8_400_000,
            "properties": 3,
        },
    ]

    properties = [
        {
            "id": "prop_b1",
            "name": "برج النخيل السكني",
            "address": "شارع الشيخ زايد",
            "city": "دبي",
            "kind": "apartment",
            "units": 6,
            "occupancy": 0.83,
            "monthly_revenue": 48_000,
            "health_score": 86,
            "hero_image": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80",
            "tenant_ids": ["ten_b1", "ten_b2"],
            "owner_id": "own_beta",
        },
        {
            "id": "prop_b2",
            "name": "مجمع الواحة التجاري",
            "address": "المركز التجاري",
            "city": "أبوظبي",
            "kind": "office",
            "units": 4,
            "occupancy": 0.75,
            "monthly_revenue": 62_000,
            "health_score": 72,
            "hero_image": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200",
            "tenant_ids": ["ten_b3"],
            "owner_id": "own_beta",
        },
        {
            "id": "prop_b3",
            "name": "فilla الريف",
            "address": "منطقة الريف",
            "city": "الشارقة",
            "kind": "villa",
            "units": 1,
            "occupancy": 1.0,
            "monthly_revenue": 28_000,
            "health_score": 91,
            "hero_image": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200",
            "tenant_ids": ["ten_b4"],
            "owner_id": "own_beta",
        },
    ]

    tenants = [
        {
            "id": "ten_b1",
            "name": "سارة الخالد",
            "property_id": "prop_b1",
            "unit": "1204",
            "since": "2024-01-15",
            "rent": 12_000,
            "reliability": 96,
        },
        {
            "id": "ten_b2",
            "name": "محمد العتيبي",
            "property_id": "prop_b1",
            "unit": "805",
            "since": "2023-08-01",
            "rent": 10_500,
            "reliability": 89,
        },
        {
            "id": "ten_b3",
            "name": "شركة أفق للتجارة",
            "property_id": "prop_b2",
            "unit": "G-02",
            "since": "2022-11-20",
            "rent": 22_000,
            "reliability": 84,
        },
        {
            "id": "ten_b4",
            "name": "فاطمة الزهراني",
            "property_id": "prop_b3",
            "unit": "فيلا",
            "since": "2023-03-10",
            "rent": 28_000,
            "reliability": 98,
        },
    ]

    contracts = [
        {
            "id": "ct_b1",
            "tenant_id": "ten_b1",
            "property_id": "prop_b1",
            "start": "2024-01-15",
            "end": _iso(now + timedelta(days=120))[:10],
            "monthly_rent": 12_000,
            "status": "active",
        },
        {
            "id": "ct_b2",
            "tenant_id": "ten_b2",
            "property_id": "prop_b1",
            "start": "2023-08-01",
            "end": _iso(now + timedelta(days=45))[:10],
            "monthly_rent": 10_500,
            "status": "expiring",
        },
        {
            "id": "ct_b3",
            "tenant_id": "ten_b3",
            "property_id": "prop_b2",
            "start": "2022-11-20",
            "end": _iso(now + timedelta(days=90))[:10],
            "monthly_rent": 22_000,
            "status": "active",
        },
        {
            "id": "ct_b4",
            "tenant_id": "ten_b4",
            "property_id": "prop_b3",
            "start": "2023-03-10",
            "end": "2027-03-10",
            "monthly_rent": 28_000,
            "status": "active",
        },
    ]

    decisions = [
        {
            "id": "d_b1",
            "priority": "high",
            "kind": "maintenance",
            "title": "صيانة وقائية — نظام التكييف في برج النخيل",
            "reason": "ارتفاع استهلاك الطاقة 18% خلال 14 يومًا — نمط يشير لضعف في الفلتر.",
            "impact": "تجنب عطل مفاجئ وتكلفة طارئة ≈ 8,000 درهم.",
            "recommended_action": "جدولة فني الصيانة خلال 48 ساعة.",
            "confidence": 88,
            "property_id": "prop_b1",
            "created_at": _iso(now - timedelta(hours=5)),
        },
        {
            "id": "d_b2",
            "priority": "critical",
            "kind": "financial",
            "title": "وحدة G-02 — تأخر سداد إيجار شهرين",
            "reason": "آخر دفعة قبل 62 يومًا — العقد ساري لكن التحصيل متأخر.",
            "impact": "44,000 درهم مستحق — يؤثر على تدفق المحفظة.",
            "recommended_action": "إرسال تذكير واتساب ومراجعة خطة السداد.",
            "confidence": 94,
            "property_id": "prop_b2",
            "created_at": _iso(now - timedelta(hours=12)),
        },
        {
            "id": "d_b3",
            "priority": "medium",
            "kind": "tenant",
            "title": "تجديد عقد الوحدة 805 — 45 يومًا متبقية",
            "reason": "محمد العتيبي — موثوقية 89% — فرصة تعديل الإيجار 3–5%.",
            "impact": "≈ 3,780 درهم سنويًا إضافية عند التجديد.",
            "recommended_action": "فتح العقد وإرسال عرض تجديد.",
            "confidence": 81,
            "property_id": "prop_b1",
            "created_at": _iso(now - timedelta(days=1)),
        },
    ]

    if persona == "technician":
        decisions = [d for d in decisions if d["kind"] == "maintenance"] + [
            {
                "id": "d_b4",
                "priority": "high",
                "kind": "maintenance",
                "title": "بلاغ تسرب — فيlla الريف (مستشعر افتراضي)",
                "reason": "إشارة رطوبة غير طبيعية في منطقة المطبخ — مفتوح منذ 2 يوم.",
                "impact": "تدخل مبكر يمنع أضرار بنية.",
                "recommended_action": "إرسال فني سباكة — أولوية اليوم.",
                "confidence": 76,
                "property_id": "prop_b3",
                "created_at": _iso(now - timedelta(days=2)),
            },
        ]

    timeline = [
        {
            "id": "tl_b1",
            "property_id": "prop_b1",
            "kind": "maintenance",
            "title": "فحص دوري — مصعد",
            "subtitle": "اكتمل بنجاح",
            "at": _iso(now - timedelta(days=14)),
        },
        {
            "id": "tl_b2",
            "property_id": "prop_b2",
            "kind": "financial",
            "title": "تذكير تحصيل — G-02",
            "subtitle": "بانتظار رد المستأجر",
            "at": _iso(now - timedelta(days=3)),
        },
    ]

    sensors = [
        {
            "id": "s_b1",
            "property_id": "prop_b1",
            "kind": "temperature",
            "label": "تكييف — 1204",
            "value": 24.2,
            "unit": "°C",
            "status": "nominal",
            "trend": "flat",
        },
        {
            "id": "s_b2",
            "property_id": "prop_b3",
            "kind": "leak",
            "label": "رطوبة — مطبخ",
            "value": 78,
            "unit": "%",
            "status": "attention",
            "trend": "up",
        },
    ]

    notifications = [
        {
            "id": "n_b1",
            "title": "عقد ينتهي قريبًا",
            "body": "وحدة 805 — محمد العتيبي — 45 يومًا متبقية.",
            "priority": "high",
            "at": _iso(now - timedelta(hours=6)),
            "read": False,
        },
        {
            "id": "n_b2",
            "title": "تحصيل متأخر",
            "body": "مجمع الواحة — G-02 — شهران بدون دفعة.",
            "priority": "high",
            "at": _iso(now - timedelta(hours=10)),
            "read": False,
        },
    ]

    if persona == "tenant":
        notifications = [n for n in notifications if "805" in n.get("body", "") or "1204" in n.get("body", "")]
        tenants = [t for t in tenants if t["id"] == "ten_b1"]

    reports = [
        {
            "id": "r_b1",
            "title": "ملخص المحفظة — تجريبي",
            "summary": "3 عقارات · 83% إشغال · 2 تنبيهات تحتاجك.",
            "pages": 4,
            "at": _iso(now - timedelta(days=2)),
        },
    ]

    knowledge = [
        {
            "id": "k_b1",
            "title": "كيف يفكر SPP عن محفظتك",
            "body": "SPP يربط العقود والصيانة والتحصيل في موجز واحد.",
            "reading_minutes": 3,
        },
    ]

    guides = [
        {
            "id": "g_b1",
            "title": "ابدأ بمحفظتك التجريبية",
            "duration": "5 min",
            "kind": "video",
            "level": "Essential",
            "chapters": 3,
            "poster": "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&q=80",
        },
    ]

    return {
        "owners": owners,
        "properties": properties,
        "tenants": tenants,
        "contracts": contracts,
        "decisions": decisions,
        "timeline": timeline,
        "sensors": sensors,
        "notifications": notifications,
        "reports": reports,
        "knowledge": knowledge,
        "guides": guides,
    }


def verify_beta_login(email: str, password: str) -> Persona | None:
    key = email.strip().lower()
    entry = BETA_ACCOUNTS.get(key)
    if not entry or entry["password"] != password:
        return None
    return entry["persona"]  # type: ignore[return-value]
