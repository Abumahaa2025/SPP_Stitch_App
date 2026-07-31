# WP-3 Practical Proof — Contracts Registry

Branch: `conflict_030726_0550`
Base: `9b0cd88dedce7c65c100973660a5248a3b020ab2`

## 1) Contracts from real synthetic rent rolls (months 1–3)

- Contracts materialised / displayed: **5**
- Units: 5 · Tenants: 5

## 2) No 10-contract cap

- 12-unit roll → contracts: **12** (must be 12)

## 3) No invented IMP-* numbers

- No `IMP-*` in any materialised number: `True`
- Incomplete CSV (no عقد column) shows: `Requires Source Support` for unit `201`

## 4) Example with legal ISO dates

```json
{
  "number": "C-101",
  "number_missing": false,
  "tenant": "احمد العتيبي",
  "phone": "0501111111",
  "unit": "101",
  "rent": 5500.0,
  "legal_start": "2026-04-08",
  "legal_end": "2027-02-02",
  "appearance_start": "",
  "appearance_end": "",
  "lifecycle": "active",
  "lifecycle_label": "نشط",
  "paid_months": 3,
  "late_months": 0,
  "arrears": 0.0,
  "claimed_active_without_legal": false
}
```
- Lifecycle: `نشط` (legal dates present → may be نشط/منتهٍ/قريب)

## 5) Example without legal dates (period labels only) — not claimed Active/Expired

```json
{
  "number": "C-102",
  "number_missing": false,
  "tenant": "ريم الشمري",
  "phone": "0505555555",
  "unit": "102",
  "rent": 5000.0,
  "legal_start": "",
  "legal_end": "",
  "appearance_start": "يناير 2026",
  "appearance_end": "يناير 2026",
  "lifecycle": "appearance_in_statements",
  "lifecycle_label": "ظاهر في فترة الكشوف",
  "paid_months": 3,
  "late_months": 0,
  "arrears": 0.0,
  "claimed_active_without_legal": false
}
```
- Displayed as: `ظاهر في فترة الكشوف`
- Not falsely Active: `True`

## 6) Late contract with months + arrears

```json
{
  "number": "C-103",
  "number_missing": false,
  "tenant": "فهد الدوسري",
  "phone": "0503333333",
  "unit": "103",
  "rent": 6200.0,
  "legal_start": "",
  "legal_end": "",
  "appearance_start": "يناير 2026",
  "appearance_end": "مارس 2026",
  "lifecycle": "appearance_in_statements",
  "lifecycle_label": "ظاهر في فترة الكشوف",
  "paid_months": 0,
  "late_months": 3,
  "arrears": 18600.0,
  "claimed_active_without_legal": false
}
```

## 7) No false Active without legal dates

- All views: `True`

## Verdict

- PASS: `count_from_real`
- PASS: `no_cap_12`
- PASS: `no_imp`
- PASS: `legal_example`
- PASS: `period_not_active`
- PASS: `late_example`
- PASS: `missing_number_rss`
- PASS: `no_false_active`

**Overall: PASS — WP-3 proven**
