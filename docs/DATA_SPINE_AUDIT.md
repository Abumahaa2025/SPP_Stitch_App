# Data spine audit — Upload → Analyze → Apply → Property OS → Kowil

Date: 2026-08-03  
Scope: phone, contract number, monthly ledger. Smart Import column/sheet IDs untouched.

## Path

```
CSV/Excel → intake_parser (phone, contract, months)
  → property_knowledge.tenants[].{phone,contract,months[]}
  → lifecycle.active.{phone,contract}
  → late_payments.*.{phone,contract,months[]}
  → apply-analysis-to-os buildOperationalRows
  → TenantRecord.phone / ContractRecord.number / paymentLedger[]
  → Kowil local brain + Smart Employee
```

## Findings

| Field | Client Apply | Gap |
|-------|--------------|-----|
| Phone | From PK cards → lifecycle active overwrite → late backfill | Re-Apply can wipe with empty; multi-card unit last-write-wins |
| Contract number | From PK cards + late backfill only | Lifecycle `active.contract` never applied; type omitted `contract` |
| Monthly ledger | From PK `months[]` + late unpaid/partial | Empty PK → weak ledger; month de-dupe only at merge |

## Fixes applied (this batch)

1. `LifecycleActiveRow.contract` + Apply reads active contract into `contractNumber`
2. Preserve non-empty phone/contract on tenant/contract merge when next is empty
3. De-dupe `OpRow.months` by year-month while assembling
4. Server `build_local_apply_commit`: pass contract number; remove 10-contract cap

See also: [APP_PATH.md](./APP_PATH.md)
