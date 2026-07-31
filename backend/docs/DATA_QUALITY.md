# Data quality notes

## Duplicate contract rows (Google Sheets)

**Status:** Known limitation — do not change dedup logic without product sign-off.

**Source:** Google Sheets `dashboard` tab → GAS `getDashboardData_()` → lite API (`getContractsLite`, etc.).

The same physical unit can appear in multiple dashboard arrays (`units`, `expiredContracts`, `latePayments`). Backend mapping in `adapters/mappers/contracts.py` deduplicates rows by **`unit|tenant`** when merging those arrays. It does **not** deduplicate by `property_id`.

**Effect:** One property can surface as multiple contract cards if the sheet lists the same unit under different tenants, or if row keys differ slightly between arrays.

**Fix location (when approved):** Cleanse data in Google Sheets, or extend GAS `parseDashboardFromRows_` — not the Emergent frontend.

**Detection:** `python scripts/validate_gas_contracts_source.py` prints duplicate `property_id` counts when present.
