# WP-6 Practical Proof — Operational Experience

Branch: `conflict_030726_0550`
Base: `a6eadacf27254e1303bc98f7915607ef5f7ebf80`

## User journey

1. **Upload** rent statement → analysis wizard
2. **Apply** → success screen: properties / units / tenants / contracts / paid months / late months / needs review
3. Tap **فتح تشغيل العقار** → `/operational/base` (today briefing)
4. Tap property → `/operational/property` (summary + tabs)
5. Unit → tenant card → contract → month ledger → maintenance
6. Executive report numbers → same ops routes (arrears / contracts / units)

## Screens delivered

| Screen | Route | Role |
|--------|-------|------|
| Ops home (today) | `/operational/base` | Status, arrears, contracts follow-up, vacant, tickets, last import, completeness |
| Property file | `/operational/property` | Occupancy/revenue/remaining/quality + tabs |
| Apply success | Upload wizard stage 5 | Counts + deep links |
| Executive drill | UploadExecutiveReport | Pressable key numbers |
| Nav chrome | OpsNavChrome | Back + breadcrumb + property + count |

## Interactive KPIs / numbers

- Today focus cards → filtered property tabs
- Quality % → reasons modal
- Exec arrears box → payments arrears filter
- Exec key_numbers → units / contracts / payments / maintenance

## No new engines / backend / Render / master

Frontend UX only on PropertyOS + existing analysis payload.
