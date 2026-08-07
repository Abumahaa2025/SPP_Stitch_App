# SPP Documentation — Single Source of Truth

> Official index for Smart Property Platform (`docs/`).
> Architectural truth starts here. Do not treat root handoff notes or chat summaries as competing law.

For writing rules, precedence, naming, and approval: see [`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md).

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
| [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) | End-to-end enterprise system architecture: composition, security, scale, HA, DR, deployment, observability, evolution | Constitution (identity), Domain Model (language), Blueprint (layers/pipelines/gates), Engine Vision (Koil layers) |
| [`DATA_ARCHITECTURE.md`](./DATA_ARCHITECTURE.md) | Enterprise data architecture: ownership, stores, quality, sync, retention, privacy, AI memory, reporting data plane | Constitution (lifecycle), Domain Model (entities), Blueprint (§14/import/gate/events), System Architecture (topology/security/DR) |
| [`DECISION_ENGINE.md`](./DECISION_ENGINE.md) | Decision Engine: authority classes, categories, scoring, explainability, learning, governance of recommendations | Constitution (§11), Domain Model (`Decision`), Blueprint (§13 gate/pipeline), System Architecture, Data Architecture |
| [`OPERATION_CENTER.md`](./OPERATION_CENTER.md) | Operation Center: real-time monitoring, event coordination, queues, incidents, escalation, multi-party orchestration | Constitution (§10), Domain Model (`Operation`/`SmartEvent`), Blueprint (§7/§12), Decision Engine, Data Architecture |
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
| `smart-employee/` | Experimental Arabic SPP surface — Option A adopted in Governance §6.3 (G-03 closed) |

---

# 5. How to use this index

1. Product identity question → Constitution.
2. Entity or language question → Domain Model.
3. Boundary, pipeline, integration, or gate question → Blueprint.
4. End-to-end system composition, security, scale, HA, DR, deployment, or observability → System Architecture.
5. Store ownership, data classes, sync, retention, privacy, AI memory, or reporting data plane → Data Architecture.
6. Whether a recommendation may exist, must be approved, or is forbidden → Decision Engine.
7. Real-time monitoring, event coordination, queues, incidents, or escalation → Operation Center.
8. Koil layer placement (rules vs understanding vs learning) → Engine Vision.
9. “May we implement yet?” → Architecture Governance §7.
10. Discovered contradiction → record as a gap; propose a resolution; do not silently pick a side.

---

*Document Status:* Official Documentation Index

*Version:* 1.5

*Project:* Smart Property Platform (SPP)

*v1.1:* Record Option A adoption for `smart-employee/` (Governance §6.3).

*v1.2:* Index official `SYSTEM_ARCHITECTURE.md` as supporting enterprise architecture.

*v1.3:* Index official `DATA_ARCHITECTURE.md` as supporting enterprise data architecture.

*v1.4:* Index official `DECISION_ENGINE.md` as supporting Decision Engine architecture.

*v1.5:* Index official `OPERATION_CENTER.md` as supporting Operation Center architecture.
