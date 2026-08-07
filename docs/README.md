# SPP Documentation — Single Source of Truth

> Official index for **Smart Property Platform (SPP)** under `docs/`.
> Scope: SPP only (`frontend/`, `backend/`, and these documents).
> Architectural truth starts here. Do not treat root handoff notes or chat summaries as competing law.
> Do not apply this index to the separate Arabic product in `smart-employee/`.

For writing rules, precedence, naming, scope, and approval: see [`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md).

---

# 1. Pillars (normative)

| Document | Answers | Path |
|---|---|---|
| Constitution | Why SPP exists; what it must never become | [`SPP_CONSTITUTION.md`](./SPP_CONSTITUTION.md) |
| Domain Model | What entities mean, how they relate, how they live | [`DOMAIN_MODEL.md`](./DOMAIN_MODEL.md) |
| Blueprint | How layers, pipelines, engines, and integrations are structured | [`SPP_BLUEPRINT.md`](./SPP_BLUEPRINT.md) |

These three are independent. None absorbs another. Conflicts resolve by the precedence in Architecture Governance §2.2.

---

# 2. Supporting architecture

| Document | Scoped subject | Defers to |
|---|---|---|
| [`SPP_ENGINE_VISION.md`](./SPP_ENGINE_VISION.md) | Koil engine layers: deterministic, AI understanding, learning | Constitution (identity), Blueprint (AI Employee), Domain Model (Knowledge) |
| [`MERGE_GATE_PLAN.md`](./MERGE_GATE_PLAN.md) | Merge / gate delivery intent | Blueprint (gate semantics, quality) |
| [`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md) | Document law, SSOT, naming, approval | All pillars |

---

# 3. Operating path (non-pillar)

These help delivery teams navigate the running system. They must not redefine identity, entities, or boundaries. Where status disagrees with the Blueprint, the Blueprint wins.

| Document | Use |
|---|---|
| [`APP_PATH.md`](./APP_PATH.md) | End-to-end intake → employee → actions → integrations map |
| [`DATA_SPINE_AUDIT.md`](./DATA_SPINE_AUDIT.md) | Historical audit of upload → apply → Property OS fields |
| [`ENGINE_APPLY_CONTINUATION.md`](./ENGINE_APPLY_CONTINUATION.md) | Continuation notes for apply work |
| [`STITCH_SCREEN_MAP.md`](./STITCH_SCREEN_MAP.md) | Screen map reference |
| [`EXPO_BETA_TESTING.md`](./EXPO_BETA_TESTING.md) | Beta testing notes |
| [`OTA_AUTO_UPDATE.md`](./OTA_AUTO_UPDATE.md) | OTA channel notes |

---

# 4. Outside `docs/` (not architectural law)

| Location | Role |
|---|---|
| `HANDOFF.md` | Operational handoff; may drift; not SSOT |
| `AGENTS.md` | Cloud agent runbook |
| `memory/`, `proofs/`, `test_reports/` | Product memory and evidence |
| `backend/docs/` | Backend-local technical notes (e.g. data quality) |
| `smart-employee/` | **Separate Arabic product** — out of SPP architecture scope (Governance §6.3) |

---

# 5. How to use this index

1. Product identity question → Constitution.
2. Entity or language question → Domain Model.
3. Boundary, pipeline, integration, or gate question → Blueprint.
4. Koil layer placement (rules vs understanding vs learning) → Engine Vision.
5. “May we implement yet?” → Architecture Governance §7.
6. Discovered contradiction → record as a gap; propose a resolution; do not silently pick a side.

---

*Document Status:* Official Documentation Index

*Version:* 1.2

*Project:* Smart Property Platform (SPP)

*v1.2:* Clarify scope — SPP docs govern SPP only; Arabic product folder is out of scope.
