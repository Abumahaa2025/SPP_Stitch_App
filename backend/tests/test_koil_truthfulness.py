"""Acceptance tests — Koil truthfulness (Beta 13 feedback).

Reference cases from real Jan–Jun 2026 rent rolls + maintenance sheet.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from adapters.upload_analysis.intake_classifier import classify_file
from adapters.upload_analysis.intake_engine import analyze_statements_deep
from adapters.upload_analysis.intake_parser import (
    _infer_payment_status,
    normalize_saudi_phone,
    parse_expense_text,
)
from adapters.upload_analysis.upload_files_meta import (
    build_upload_file_meta,
    build_upload_files_meta_from_paths,
)

DESK = Path.home() / "Desktop"
RENT_FILES = [
    DESK / "كشف شهر 1-2026.xlsx",
    DESK / "شكشف شهر 2-2026.xlsx",
    DESK / "كشف شهر 3-2026.xlsx",
    DESK / "كشف شهر 4-2026.xlsx",
    DESK / "كشف شهر 5-2026.xlsx",
    DESK / "كشف -شهر -6-2026-.xlsx",
]
MAINT_FILE = DESK / "كشف صيانه جديد.xlsx"


def _have_real_files() -> bool:
    return all(p.is_file() for p in RENT_FILES) and MAINT_FILE.is_file()


# --- Unit tests (no Desktop files required) ---


def test_platform_payment_not_late_substring_bug():
    row = {"pay_status": "دفع عبر المنصه", "rent": 1100, "paid": 0, "late": ""}
    assert _infer_payment_status(row) == "paid"
    row2 = {"pay_status": "دفع عبر المنصة", "rent": 1300, "paid": 0, "late": ""}
    assert _infer_payment_status(row2) == "paid"


def test_vacated_not_late():
    row = {"pay_status": "اخلاء الشقه", "rent": 1700, "paid": 0, "late": ""}
    assert _infer_payment_status(row) == "vacated"


def test_empty_status_unknown_not_late():
    row = {"pay_status": "", "rent": 1800, "paid": 0, "late": ""}
    assert _infer_payment_status(row) == "unknown_requires_review"


def test_late_amount_column_alone_not_confirmed_unpaid():
    row = {"pay_status": "", "rent": 1800, "paid": 0, "late": "1800"}
    assert _infer_payment_status(row) == "unknown_requires_review"


def test_partial_before_paid_marker_substring():
    row = {"pay_status": "سداد جزئي", "rent": 2000, "paid": 500, "late": ""}
    assert _infer_payment_status(row) == "partial"


def test_confirmed_late_marker():
    row = {"pay_status": "متاخرات", "rent": 1100, "paid": 0, "late": ""}
    assert _infer_payment_status(row) == "unpaid_confirmed"


def test_soft_name_same_incomplete_arabic():
    from adapters.upload_analysis.intake_lifecycle import _soft_name_same, _same_tenant_identity, _clear_identity_switch

    assert _soft_name_same("نور محمد", "نور محمد يونس محمد")
    assert not _soft_name_same("ماجد غالب عبدالله", "مختار محرم غالب اسماعيل")
    # Bilingual same person — phone/contract required (no transliteration engine).
    a = {"tenant": "NOOR MOHAMMED YOUNOS MOHAMMED", "phone": "0577521700", "contract": "10198816953"}
    b = {"tenant": "نور محمد", "phone": "0577521700", "contract": "10198816953"}
    assert _same_tenant_identity(a, b)
    assert not _clear_identity_switch(a, b)


def test_clear_switch_requires_diverging_phone_or_contract():
    from adapters.upload_analysis.intake_lifecycle import _clear_identity_switch

    prev = {"tenant": "أ", "phone": "0501111111", "contract": "111"}
    cur = {"tenant": "ب", "phone": "0502222222", "contract": "222"}
    assert _clear_identity_switch(prev, cur)
    # Name-only flip without phone/contract evidence — not a departure.
    weak = {"tenant": "أ", "phone": "", "contract": ""}
    weak2 = {"tenant": "ب", "phone": "", "contract": ""}
    assert not _clear_identity_switch(weak, weak2)


def test_phone_normalization():
    info = normalize_saudi_phone("531695119")
    assert info["phone"] == "0531695119"
    assert info["phone_e164"] == "966531695119"
    assert info["phone_raw"] == "531695119"


def test_expense_fixture_eighteen_rows():
    csv = (
        "رقم الطلب,التاريخ,رقم الوحدة,نوع العطل,نوع المصروف,وصف العطل,تكلفة الصيانه,الحالة,الجهة الدافعه,تاريخ الاغلاق,الفني\n"
        "101,2026-01-04,شقة7,سباكة,صيانه,سباكة حمام,290,مكتمل,المالك,2026-04-01,سباك\n"
        "102,2026-01-15,الاصنصير,صيانه,كهرباء,صيانة اصنصير,150,مكتمل,المالك,2026-01-15,مهندس\n"
        "103,2026-01-23,العمارة,سداد فاتورة,مياة,فاتورة مياة,3402,مكتمل,المالك,2026-01-23,الحارس\n"
        "104,2026-01-27,العمارة,صيانه,تشغيل,شفاط دينمو,45,مكتمل,المالك,2026-01-27,الحارس\n"
        "105,2026-01-27,شقة14,سداد فاتورة,صيانه,فاتورةكهرباء,1624,مكتمل,المالك,2026-01-27,المالك\n"
        "106,2026-01-30,شقة2و20,صيانه,صيانه,بويا كهرباء سباكة,1850,مكتمل,المالك,2026-01-30,دهان\n"
        "107,2026-02-05,حمام السطوح,صيانه,صيانه,كرسي حمام بلاط دهان,500,مكتمل,المالك,2026-02-05,سباك\n"
        "108,2026-02-10,شقة2و20,صيانه,صيانه,بلاط بويا,1300,مكتمل,المالك,2026-02-10,بلاط\n"
        "109,2026-02-12,شقة2,صيانه,صيانه,نظافة,280,مكتمل,المالك,2026-02-12,عامل\n"
        "110,2026-02-15,أبو نواف,شخصية,شخصية,شخصية,1065,مكتمل,المالك,2026-02-15,-\n"
        "111,2026-02-20,العمارة,صيانه,سباكة,سباكة ماصورة خارجية,550,مكتمل,المالك,2026-02-20,سباك\n"
        "112,2026-03-01,شقة6,صيانه,كهرباء,تركيب افياش ولمبات,168,مكتمل,المالك,2026-03-01,كهربائي\n"
        "113,2026-03-05,العمارة,صيانه,تشغيل,انزال لوحة,150,مكتمل,المالك,2026-03-05,الحارس\n"
        "114,2026-03-10,العمارة,سداد فاتورة,مياة,سداد فاتورة مياه,1760,مكتمل,المالك,2026-03-10,الحارس\n"
        "115,2026-03-15,العمارة,صيانه,سباكة,مواصير خارجية ومكيفات,1700,مكتمل,المالك,2026-03-15,سباك\n"
        "116,2026-04-01,العمارة,سداد فاتورة,كهرباء,سداد فاتورة كهرباء,11215,مكتمل,المالك,2026-04-01,المالك\n"
        "117,2026-04-10,العمارة,سداد فاتورة,مياة,سداد فاتورة مياه,1165,مكتمل,المالك,2026-04-10,الحارس\n"
        "118,2026-04-15,العمارة,صيانه,زجاج,تركيب زجاج باب العمارة,1250,مكتمل,المالك,2026-04-15,زجاج\n"
        ",,,,,,\n"
        "119,2026-05-01,العمارة,صيانه,تشغيل,,1132,مكتمل,المالك,2026-05-01,الحارس\n"
    )
    exp = parse_expense_text(csv, {"name": "كشف صيانه جديد.xlsx"})
    assert exp["row_count"] == 18
    assert abs(exp["total"] - 28464.0) < 0.5
    assert exp.get("doc_type") == "maintenance_expense"


def test_maintenance_classifier_ignores_invoice_unit_words():
    cls = classify_file(
        {
            "name": "كشف صيانه جديد.xlsx",
            "textSnippet": "رقم الطلب,رقم الوحدة,نوع العطل,تكلفة الصيانه,الفني\n101,شقة7,سباكة,290,سباك\nفاتورة كهرباء,وحدة,100\n",
        }
    )
    assert cls.doc_type == "maintenance"


# --- Real-file integration ---


@pytest.fixture(scope="module")
def deep():
    if not _have_real_files():
        pytest.skip("Desktop golden xlsx files missing")
    metas = build_upload_files_meta_from_paths(RENT_FILES + [MAINT_FILE])
    return analyze_statements_deep(metas, {})


def _unit_ledger(deep: dict, unit: str) -> dict:
    matches = [
        ent
        for ent in (deep.get("payment_ledger") or {}).get("ledger", {}).values()
        if str(ent.get("unit")) == str(unit)
    ]
    assert matches, f"unit {unit} missing from ledger"
    return max(matches, key=lambda e: len(e.get("months") or []))


def _month_status(ent: dict, month: int) -> str:
    for m in ent.get("months") or []:
        if int(m.get("month") or 0) == month:
            return m.get("status") or ""
    return ""


@pytest.mark.skipif(not _have_real_files(), reason="Desktop golden xlsx files missing")
def test_maintenance_not_classified_as_rent():
    meta = build_upload_file_meta(MAINT_FILE)
    poisoned = dict(meta)
    poisoned["textSnippet"] = (meta.get("textSnippet") or "") + "\nفاتورة كهرباء,وحدة 14,100\n"
    cls = classify_file(poisoned)
    assert cls.doc_type == "maintenance"


@pytest.mark.skipif(not _have_real_files(), reason="Desktop golden xlsx files missing")
def test_maintenance_count_and_total(deep):
    assert deep["expense_rolls"], "maintenance file not parsed as expense"
    exp = deep["expense_rolls"][0]
    assert exp.get("doc_type") == "maintenance_expense"
    assert exp["row_count"] == 18
    assert abs(float(exp["total"]) - 28464.0) < 0.5
    assert len(deep["parsed_rolls"]) == 6
    for pr in deep["parsed_rolls"]:
        assert "صيانه" not in (pr.get("file_name") or "")


@pytest.mark.skipif(not _have_real_files(), reason="Desktop golden xlsx files missing")
def test_unit_14_zero_late_months(deep):
    ent = _unit_ledger(deep, "14")
    unpaid = [m for m in ent["months"] if m["status"] in ("unpaid_confirmed", "partial")]
    assert len(unpaid) == 0, f"unit 14 unpaid={unpaid}"


@pytest.mark.skipif(not _have_real_files(), reason="Desktop golden xlsx files missing")
def test_unit_13_zero_late_months(deep):
    ent = _unit_ledger(deep, "13")
    unpaid = [m for m in ent["months"] if m["status"] in ("unpaid_confirmed", "partial")]
    assert len(unpaid) == 0, f"unit 13 unpaid={unpaid}"


@pytest.mark.skipif(not _have_real_files(), reason="Desktop golden xlsx files missing")
def test_unit_18_march_not_late(deep):
    ent = _unit_ledger(deep, "18")
    assert _month_status(ent, 3) == "paid"
    assert _month_status(ent, 5) == "unknown_requires_review"
    assert _month_status(ent, 6) == "unknown_requires_review"
    unpaid = [m for m in ent["months"] if m["status"] in ("unpaid_confirmed", "partial")]
    assert all(int(m["month"]) != 3 for m in unpaid)


@pytest.mark.skipif(not _have_real_files(), reason="Desktop golden xlsx files missing")
def test_unit_6_vacate_not_arrears(deep):
    matches = [
        ent
        for ent in deep["payment_ledger"]["ledger"].values()
        if str(ent.get("unit")) == "6" and "افراح" in (ent.get("tenant") or "")
    ]
    assert matches
    ent = matches[0]
    assert _month_status(ent, 2) == "vacated"
    assert _month_status(ent, 3) == "vacated"
    unpaid = [m for m in ent["months"] if m["status"] in ("unpaid_confirmed", "partial")]
    assert len(unpaid) == 0


@pytest.mark.skipif(not _have_real_files(), reason="Desktop golden xlsx files missing")
def test_unit_11_bilingual_same_tenant(deep):
    deps = [d for d in deep["lifecycle"]["departed"] if str(d.get("unit")) == "11"]
    news = [n for n in deep["lifecycle"]["newcomers"] if str(n.get("unit")) == "11"]
    assert deps == [], f"false departures on unit 11: {deps}"
    assert news == [], f"false newcomers on unit 11: {news}"


@pytest.mark.skipif(not _have_real_files(), reason="Desktop golden xlsx files missing")
def test_unit_26_bilingual_same_tenant(deep):
    deps = [d for d in deep["lifecycle"]["departed"] if str(d.get("unit")) == "26"]
    news = [n for n in deep["lifecycle"]["newcomers"] if str(n.get("unit")) == "26"]
    assert deps == [], f"false departures on unit 26: {deps}"
    assert news == [], f"false newcomers on unit 26: {news}"


@pytest.mark.skipif(not _have_real_files(), reason="Desktop golden xlsx files missing")
def test_existing_phones_not_missing(deep):
    found = False
    for ent in deep["payment_ledger"]["ledger"].values():
        if str(ent.get("unit")) == "5":
            found = True
            assert ent.get("phone"), "phone missing for unit 5"
            assert ent.get("contract")
    assert found
    for a in deep["lifecycle"]["active"]:
        if a.get("contract") and str(a.get("unit")).isdigit():
            assert a.get("phone"), f"missing phone unit {a.get('unit')} {a.get('tenant')}"


@pytest.mark.skipif(not _have_real_files(), reason="Desktop golden xlsx files missing")
def test_ledger_matches_late_board(deep):
    ledger_unpaid = sum(float(e.get("total_unpaid") or 0) for e in deep["payment_ledger"]["ledger"].values())
    board = float((deep.get("late_by_month") or {}).get("grand_total") or 0)
    assert abs(ledger_unpaid - board) < 1.0, f"ledger={ledger_unpaid} board={board}"


@pytest.mark.skipif(not _have_real_files(), reason="Desktop golden xlsx files missing")
def test_unknown_months_block_collection_recs(deep):
    from adapters.koil.property_knowledge_engine import build_property_knowledge
    from adapters.koil.import_snapshot import snapshot_from_deep
    from adapters.koil.koil_reasoning_engine import run_koil_reasoning

    snap = snapshot_from_deep(deep)
    pk = build_property_knowledge(snap, "ar")
    lq = pk.get("ledger_quality") or {}
    assert int(lq.get("unknown_month_count") or 0) > 0
    assert lq.get("collection_recs_allowed") is False
    assert pk.get("tenants"), "tenant cards missing from Property Knowledge"
    reasoning = run_koil_reasoning(pk, "ar")
    for r in reasoning.get("recommendations") or []:
        key = r.get("action_key") or ""
        title = r.get("title") or ""
        assert "whatsapp" not in key
        if "تواصل مع" in title:
            assert False, f"collection contact should be blocked: {title}"


def test_late_view_excludes_unknown_status():
    from adapters.upload_analysis.late_report_format import build_late_payments_view_model

    vm = build_late_payments_view_model(
        late_by_month={
            "months": [
                {
                    "year": 2026,
                    "month": 5,
                    "month_label": "مايو 2026",
                    "month_total": 5000,
                    "items": [
                        {
                            "tenant": "A",
                            "unit": "1",
                            "status": "unknown_requires_review",
                            "amount": 2000,
                            "rent": 2000,
                            "paid": 0,
                        },
                        {
                            "tenant": "B",
                            "unit": "2",
                            "status": "unpaid_confirmed",
                            "amount": 1100,
                            "rent": 1100,
                            "paid": 0,
                        },
                    ],
                }
            ],
            "grand_total": 3100,
            "late_tenant_count": 2,
        },
        late_tenants_detailed=[
            {
                "tenant": "A",
                "unit": "1",
                "months": [{"month": 5, "year": 2026, "status": "unknown_requires_review", "remaining": 2000}],
                "total_unpaid": 2000,
            },
            {
                "tenant": "B",
                "unit": "2",
                "months": [{"month": 5, "year": 2026, "status": "unpaid_confirmed", "remaining": 1100}],
                "total_unpaid": 1100,
                "oldest_month": {"month": 5, "year": 2026},
            },
        ],
        total_unpaid=3100,
        late_tenant_count=2,
        lang="ar",
    )
    assert vm["summary"]["late_tenant_count"] == 1
    assert abs(vm["summary"]["total_unpaid"] - 1100) < 0.1
    assert len(vm["months"]) == 1
    assert len(vm["months"][0]["tenants"]) == 1
    assert vm["months"][0]["tenants"][0]["unit"] == "2"