# Engineering note — upload Apply engines (conflict_030726_0550)

## Modified files
- `backend/adapters/gas_import_bridge.py` — phone merge from PK cards; session stores PK for Apply
- `backend/server.py` — Apply falls back to local materialise when GAS commit fails (same pattern as analyze)
- `backend/tests/test_upload_apply_engines.py` — new contract tests
- `frontend/src/utils/apply-analysis-to-os.ts` — phone fallback only (no UX change)

## Why
1. Protect engines → brief.engines → Apply → portfolio link without UI churn.
2. Fix regression: GAS available but broken returned 502 on Apply instead of local commit.
3. Accuracy: lifecycle active rows often lack phone; copy from Property Knowledge tenant cards by unit.

## API changes (additive / compatible)
- `POST /upload/apply-analysis` still returns `{ ok, analysis_id, applied_at }`.
- On local path also returns `gas: false` and `commit: { units, tenants, properties, contracts, reports, source }`.
- When GAS succeeds: unchanged (`gas: true`, `commit` from Sheets).
- `executive_brief.engines` remains additive on analysis (already present since 66ecbf1).

## How to test
```bash
cd backend
set SPP_BETA_MODE=true
python -m pytest tests/test_upload_apply_engines.py -q
python -m pytest tests/ -q
```

## Results
```
103 passed, 4 skipped (backend/tests, SPP_BETA_MODE=true)
Focused: tests/test_upload_apply_engines.py — 5 passed
```
