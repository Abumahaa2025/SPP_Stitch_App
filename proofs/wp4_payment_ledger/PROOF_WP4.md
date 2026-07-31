# WP-4 Practical Proof — Payment Ledger

## 1) Month rows from real CSV (months 1–3)
- After merge: **13** month rows
- Apply1 rows: 8 → Apply2 merged: 13 (added changes: 5)

## 2) Examples
### Paid
```json
{
  "id": "ldg_ten_imp_101_2026-01",
  "tenantId": "ten_imp_101",
  "monthKey": "2026-01",
  "monthLabel": "يناير 2026",
  "unit": "101",
  "tenant": "احمد العتيبي",
  "due": 5500.0,
  "paid": 5500.0,
  "remaining": 0.0,
  "status": "paid",
  "derived": "paid"
}
```
### Partial
```json
{
  "id": "ldg_ten_imp_101_2026-02",
  "tenantId": "ten_imp_101",
  "monthKey": "2026-02",
  "monthLabel": "فبراير 2026",
  "unit": "101",
  "tenant": "احمد العتيبي",
  "due": 5500,
  "paid": 2000,
  "remaining": 3500,
  "status": "partial",
  "derived": "partial"
}
```
### Late
```json
{
  "id": "ldg_ten_imp_103_2026-01",
  "tenantId": "ten_imp_103",
  "monthKey": "2026-01",
  "monthLabel": "يناير 2026",
  "unit": "103",
  "tenant": "فهد الدوسري",
  "due": 6200.0,
  "paid": 0.0,
  "remaining": 6200.0,
  "status": "unpaid_confirmed",
  "derived": "late"
}
```
### Needs review
```json
{
  "id": "ldg_ten_imp_102_2026-02",
  "tenantId": "ten_imp_102",
  "monthKey": "2026-02",
  "monthLabel": "فبراير 2026",
  "unit": "102",
  "tenant": "ريم الشمري",
  "due": 5000.0,
  "paid": 5500.0,
  "remaining": 0.0,
  "status": "paid",
  "derived": "needs_review"
}
```

## 3) No duplicate tenant+month after newer upload
- Unique keys: `True` (n=13)

## 4) Totals vs analysis.summary
- Ledger paid=48400.0 vs summary.collected=48400.0 → `True`
- Ledger remaining=42600.0 vs summary.remaining=42600.0 → `True`

## 5) Drill-down sample (late tenant)
```json
{
  "month_row": {
    "id": "ldg_ten_imp_103_2026-01",
    "tenantId": "ten_imp_103",
    "monthKey": "2026-01",
    "monthLabel": "يناير 2026",
    "unit": "103",
    "tenant": "فهد الدوسري",
    "due": 6200.0,
    "paid": 0.0,
    "remaining": 6200.0,
    "status": "unpaid_confirmed",
    "derived": "late"
  },
  "tenant_months": [
    {
      "id": "ldg_ten_imp_103_2026-01",
      "tenantId": "ten_imp_103",
      "monthKey": "2026-01",
      "monthLabel": "يناير 2026",
      "unit": "103",
      "tenant": "فهد الدوسري",
      "due": 6200.0,
      "paid": 0.0,
      "remaining": 6200.0,
      "status": "unpaid_confirmed",
      "derived": "late"
    },
    {
      "id": "ldg_ten_imp_103_2026-02",
      "tenantId": "ten_imp_103",
      "monthKey": "2026-02",
      "monthLabel": "فبراير 2026",
      "unit": "103",
      "tenant": "فهد الدوسري",
      "due": 6200.0,
      "paid": 0.0,
      "remaining": 6200.0,
      "status": "unpaid_confirmed",
      "derived": "late"
    },
    {
      "id": "ldg_ten_imp_103_2026-03",
      "tenantId": "ten_imp_103",
      "monthKey": "2026-03",
      "monthLabel": "مارس 2026",
      "unit": "103",
      "tenant": "فهد الدوسري",
      "due": 6200.0,
      "paid": 0.0,
      "remaining": 6200.0,
      "status": "unpaid_confirmed",
      "derived": "late"
    }
  ],
  "tenant": "فهد الدوسري",
  "unit": "103"
}
```

## Verdict
- PASS: `rows_from_real`
- PASS: `no_dup_month`
- PASS: `paid_example`
- PASS: `partial_example`
- PASS: `late_example`
- PASS: `review_example`
- PASS: `summary_paid`
- PASS: `summary_remaining`
- PASS: `drill_down`

**Overall: PASS — WP-4 proven**
