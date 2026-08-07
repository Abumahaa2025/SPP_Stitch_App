# Smart Property Platform (SPP)

AI-powered **Property Operations Platform**.

This repository’s **active SPP product** is:

| Part | Directory |
|---|---|
| SPP application (Expo / React Native web) | `frontend/` |
| SPP API (FastAPI) | `backend/` |
| SPP architectural law (SSOT) | `docs/` |

## Architectural source of truth (SPP only)

| Pillar | Document |
|---|---|
| Why / identity | [`docs/SPP_CONSTITUTION.md`](docs/SPP_CONSTITUTION.md) |
| What / language | [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md) |
| How / structure | [`docs/SPP_BLUEPRINT.md`](docs/SPP_BLUEPRINT.md) |

Start here: [`docs/README.md`](docs/README.md) · Governance: [`docs/ARCHITECTURE_GOVERNANCE.md`](docs/ARCHITECTURE_GOVERNANCE.md)

Root files `SPP_BLUEPRINT.md` and `DOMAIN_MODEL.md` are redirect stubs only.

## Out of SPP architecture scope

`smart-employee/` is a **separate Arabic product** co-located in this repository. It has its own product docs and is **not** governed by SPP Constitution / Blueprint / Domain Model. SPP architecture work must not rewrite that product’s identity.

Operational runbooks for SPP agents: `HANDOFF.md`, `AGENTS.md`.
