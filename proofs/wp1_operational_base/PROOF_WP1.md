# WP-1 Practical Proof — Operational Base

Branch: `conflict_030726_0550`
Source CSVs: `benchmarks/synthetic_benchmark/files/rent_month_{1,2,3}.csv` (+ 12-unit roll for contract-cap proof)

## 1) Operational base counts (after Apply 1 = months 1+2)

| Metric | Count |
|--------|------:|
| Units | 4 |
| Tenants | 4 |
| Contracts | 4 |
| Payment Ledger | 8 |
| Payments | 5 |
| Import Batches | 1 |

## 1b) After Apply 2 (months 1+2+3 — newer)

| Metric | Count |
|--------|------:|
| Units | 5 |
| Tenants | 5 |
| Contracts | 5 |
| Payment Ledger | 13 |
| Payments | 8 |
| Import Batches | 2 |

- Unit 104 present after Apply 2: `True`
- Stable merge (4 → 5 units, not doubled): `True`
- Ledger grew without duplicate month keys on 101: 8 → 13 (unique months `True`)

## 2) Merge proof (Apply 1 then Apply 2)

- No duplicate unit ids: `True` (n=5)
- No duplicate tenant ids: `True` (n=5)
- No duplicate contract ids: `True` (n=5)
- Change log recorded (added+updated > 0): `True` → {'added': 11, 'updated': 3}
- Both import batches retained: `True` ids=['batch_ef13cc68', 'batch_df302d90']
- Unit 102 tenant updated in place (سعد → ريم): `True` → `{'id': 'ten_imp_102', 'name': 'ريم الشمري', 'phone': '0505555555', 'unitId': 'unit_imp_102', 'moveInDate': 'يناير 2026'}`
- Unit 102 still single row: `{'id': 'unit_imp_102', 'propertyId': 'prop_imp_primary', 'number': '102', 'rentAmount': 5000.0, 'status': 'occupied'}`

## 3) Persistence (close / reopen)

- After Apply 1 reload match: `True`
- After Apply 2 reload units=5, tenants=5, contracts=5, ledger=13, batch=`batch_ef13cc68`
- Store file: `proofs\wp1_operational_base\property_os_store.json`
- Batches file: `proofs\wp1_operational_base\import_batches.json`

## 4) Contracts proof (no 10-cap + real numbers)

- 12-unit analysis contracts materialised: **12** (must be 12, not capped at 10)
- All real contract numbers from CSV (`C-…`): `True` → ['C-101', 'C-102', 'C-103', 'C-104', 'C-105', 'C-106', 'C-107', 'C-108', 'C-109', 'C-110', 'C-111', 'C-112']

### Contracts after Apply 2

| number | unit | tenant | start (payload) | end (payload) |
|--------|------|--------|-----------------|---------------|
| C-101 | 101 | احمد العتيبي | يناير 2026 | مارس 2026 |
| C-102 | 102 | ريم الشمري | يناير 2026 | يناير 2026 |
| C-103 | 103 | فهد الدوسري | يناير 2026 | مارس 2026 |
| C-G01 | محل-01 | محل نور | يناير 2026 | مارس 2026 |
| C-104 | 104 | نوره الحربي | مارس 2026 | مارس 2026 |

> Apply stores payload `contract_start/end` as-is. Empty payload → empty / Requires Source Support. No ISO today invented.

## 5) Payment Ledger sample (from months[])

Tenant unit **101** — ledger row matched 1:1 to `property_knowledge.tenants[].months[]`:

```json
{
  "payload_month": {
    "month": 1,
    "year": 2026,
    "label": "يناير 2026",
    "status": "paid",
    "status_label": "مدفوع",
    "due": 5500.0,
    "paid": 5500.0,
    "remaining": 0.0,
    "pay_status_raw": "مسدد"
  },
  "ledger_row": {
    "id": "ldg_101_2026-01",
    "tenantId": "ten_imp_101",
    "unitId": "unit_imp_101",
    "unit": "101",
    "tenant": "احمد العتيبي",
    "monthKey": "2026-01",
    "monthLabel": "يناير 2026",
    "year": 2026,
    "month": 1,
    "due": 5500.0,
    "paid": 5500.0,
    "remaining": 0.0,
    "status": "paid",
    "statusLabel": "مدفوع",
    "source": "tenant_card"
  }
}
```

- Match exact (due/paid/remaining/status/label): `True`
- Source tag on ledger: `tenant_card`

### All ledger rows for unit 101

- يناير 2026: due=5500.0 paid=5500.0 remaining=0.0 status=paid source=tenant_card
- فبراير 2026: due=5500.0 paid=5500.0 remaining=0.0 status=paid source=tenant_card
- مارس 2026: due=5500.0 paid=5500.0 remaining=0.0 status=paid source=tenant_card

## 6) No invented data

- No tenant `moveInDate` defaulted to today (`2026-07-16`): `True`
- Apply does not invent: maintenance tickets, full address/city/owner, multi-property split, ISO contract dates when missing.

## Verdict

- PASS: `counts_apply1`
- PASS: `merge_no_dups`
- PASS: `merge_stable_counts`
- PASS: `merge_changelog`
- PASS: `persist_reopen`
- PASS: `contracts_no_cap_12`
- PASS: `ledger_from_months`
- PASS: `no_today_invent`

**Overall: PASS — WP-1 operational base proven**
