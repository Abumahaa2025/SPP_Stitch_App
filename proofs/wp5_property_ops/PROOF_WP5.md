# WP-5 Practical Proof — Property Operations Base

## Counts
- Properties: **1**
- Units: **5**
- Occupied: 5 · Vacant: 0
- Contracts: 5
- Ledger rows: 13

## Interactive KPIs (press targets)
```json
{
  "properties": "opens properties tab",
  "units": "opens units tab",
  "occupied": "filter occupied",
  "vacant": "filter vacant",
  "contracts": "route /contracts",
  "arrears": "filter arrears on units",
  "collected": "route /operational/payments",
  "remaining": "filter arrears on units"
}
```
- All 8 KPI cards mapped: `True`

## Drill-down: property → unit → tenant → contract → ledger → maintenance
```json
{
  "property": "العقار المستورد",
  "unit": "103",
  "tenant": "فهد الدوسري",
  "contract": "C-103",
  "ledger_months": [
    {
      "label": "يناير 2026",
      "due": 6200.0,
      "paid": 0.0,
      "remaining": 6200.0
    },
    {
      "label": "فبراير 2026",
      "due": 6200.0,
      "paid": 0.0,
      "remaining": 6200.0
    },
    {
      "label": "مارس 2026",
      "due": 6200.0,
      "paid": 0.0,
      "remaining": 6200.0
    }
  ],
  "maintenance": "Requires Source Support (no tickets in Apply payload — open /maintenance)"
}
```

## No duplicates
- Unique unit/tenant/contract/ledger keys: `True`

## Totals vs summary
- Collected ledger=48400.0 summary=48400.0
- Remaining ledger=42600.0 summary=42600.0

## Verdict
- PASS: `properties_count`
- PASS: `units_count`
- PASS: `kpi_pressable`
- PASS: `drill_chain`
- PASS: `no_duplicates`
- PASS: `summary_aligned`

**Overall: PASS — WP-5 proven**
