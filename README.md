# Smart Property Platform (SPP)

AI-powered **Property Operations Platform** — not a traditional property-management app.

## Architectural source of truth

All architectural law lives under **`docs/`**:

| Pillar | Document |
|---|---|
| Why / identity | [`docs/SPP_CONSTITUTION.md`](docs/SPP_CONSTITUTION.md) |
| What / language | [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md) |
| How / structure | [`docs/SPP_BLUEPRINT.md`](docs/SPP_BLUEPRINT.md) |

Start here: [`docs/README.md`](docs/README.md) · Governance: [`docs/ARCHITECTURE_GOVERNANCE.md`](docs/ARCHITECTURE_GOVERNANCE.md)

Root files `SPP_BLUEPRINT.md` and `DOMAIN_MODEL.md` are redirect stubs only.

## Runtime entry points

| Surface | Directory | Notes |
|---|---|---|
| SPP application (Expo) | `frontend/` | Primary product surface |
| SPP API (FastAPI) | `backend/` | Pipelines, engines, integrations |
| Experimental Arabic surface | `smart-employee/` | Option A adopted — SPP surface under one Constitution (`docs/ARCHITECTURE_GOVERNANCE.md` §6.3) |

Operational runbooks: `HANDOFF.md`, `AGENTS.md`.
