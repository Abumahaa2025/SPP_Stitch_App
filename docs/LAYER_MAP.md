# SPP Layer Map — Implementation Alignment

> Operational map of Clean Architecture layers for **new and migrated code paths**.  
> Normative layer definitions live in `docs/SPP_BLUEPRINT.md` §5.  
> This document does not invent boundaries; it records where code should land.

| Field | Value |
|---|---|
| Architecture | SPP Enterprise Architecture v1.0 (frozen) |
| Blueprint authority | §5.2 (app tier), §5.3 (service tier), §5.4 (review rejects) |
| Phase | Implementation Phase 2 (GAP-H02) |

---

## 1. Application tier (Expo / `frontend/`)

| Layer | Package / location | May | Must not |
|---|---|---|---|
| **Presentation** | `frontend/app/**`, `frontend/src/components/**` | Render state, capture owner intent, navigate | Compute arrears, occupancy eligibility, or money rules |
| **Application** | `frontend/src/application/**`, hooks/stores/workflow engines | Sequence operations, sync aggregates, call infrastructure | Own domain invariants |
| **Domain** | `frontend/src/domain/**`, entity types under `frontend/src/types/` (migrating) | Entity shapes, invariants, pure derivations | Read env, AsyncStorage, or network |
| **Infrastructure** | `frontend/src/api/**`, `frontend/src/utils/storage/**`, portal bridge | Persist, fetch, resolve hosts | Decide eligibility or invent money totals |

### Review rejects (Blueprint §5.4) — app tier

1. A screen computing arrears / occupancy / eligibility instead of reading `ops-truth` / domain helpers.
2. Writing vendor payload fields directly into domain records.
3. Presentation importing Infrastructure secrets or provider tokens (Phase 1).

### Current migration notes

- Arrears and ledger truth: `frontend/src/utils/ops-truth.ts` (Application/Domain derivation — not widgets).
- Building identity: `frontend/src/domain/building.ts` + Property OS `buildings[]`.
- UtilityAccount standing entity: `frontend/src/domain/utility-account.ts`.
- Historical Koil fallback modules: `kowil-*.ts` remain aliases; prefer `koil-*.ts` for new imports.

---

## 2. Service tier (FastAPI / `backend/`)

| Layer | Package / location | May | Must not |
|---|---|---|---|
| **Interface** | `backend/server.py` routers, `backend/routers/**` | Validate transport shape | Own business rules |
| **Application** | pipeline orchestration under `backend/adapters/*` engines (migrating) | Compose engines, approvals, apply flows | Read `os.environ` directly in new code |
| **Domain** | normalisation, gate, decision unifier, lifecycle | Truth and judgement | I/O, env, HTTP |
| **Infrastructure** | GAS/Sheets clients, webhook clients, Mongo, LLM provider, **`adapters/settings.py`** | Config injection, persistence, vendor translation | Decide gate outcomes |

### Configuration port (GAP-H07)

- **Port:** `backend/adapters/settings.py` → `get_settings()`.
- New engine/integration code receives settings (or booleans derived from settings), not raw `os.environ` keys.
- Legacy direct env reads are migrated incrementally; new paths must use the port.

---

## 3. Dependency rule

Dependencies point **inward** only:

```
Presentation → Application → Domain
Interface    → Application → Domain
Infrastructure adapters implement ports used by Application; Domain stays pure.
```

---

## 4. Document status

*Class:* Operating / implementation alignment (subordinate to Blueprint §5)  
*Related gaps:* GAP-H02, GAP-H07  
*Change policy:* Structural layer invention requires RFC; filling this map toward Blueprint §5 does not.
