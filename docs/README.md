# SPP Documentation — Single Source of Truth

> Official index for **Smart Property Platform (SPP)** under `docs/`.
> Scope: SPP only (`frontend/`, `backend/`, and these documents).
> Architectural truth starts here. Do not treat root handoff notes or chat summaries as competing law.
> Do not apply this index to the separate Arabic product in `smart-employee/`.

For writing rules, precedence, naming, scope, and approval: see [`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md).

For writing rules, precedence, naming, and approval: see [`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md).  
For the latest architecture audit (ownership, terminology, conflicts, gaps): see [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md).  
For Architecture Phase exit and the v1.0 architectural contract: see [`ARCHITECTURE_FREEZE.md`](./ARCHITECTURE_FREEZE.md).

---

# 1. Pillars (normative)

| Document | Owns | Path |
|---|---|---|
| Constitution | Why SPP exists; what it must never become; AI and decision philosophy | [`SPP_CONSTITUTION.md`](./SPP_CONSTITUTION.md) |
| Domain Model | Entity names, responsibilities, relationships, lifecycles | [`DOMAIN_MODEL.md`](./DOMAIN_MODEL.md) |
| Blueprint | Layers, pipelines, engines, integrations, gate semantics, prepare-not-send, topology | [`SPP_BLUEPRINT.md`](./SPP_BLUEPRINT.md) |

These three are independent. None absorbs another. Conflicts resolve by Architecture Governance §2.2:

**Constitution → Domain Model → Blueprint → Supporting architecture → Operating path / audit notes.**

---

# 2. Supporting architecture (ownership map)

| Document | Unique ownership | Defers to |
|---|---|---|
| [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) | End-to-end composition; security; scale; HA; DR; deployment; observability | Constitution, Domain Model, Blueprint, Engine Vision |
| [`DATA_ARCHITECTURE.md`](./DATA_ARCHITECTURE.md) | Data classes; stores; sync; retention; privacy; AI memory planes | Constitution lifecycle, Domain Model, Blueprint §14, System Architecture |
| [`DECISION_ENGINE.md`](./DECISION_ENGINE.md) | Decision authority classes; scoring; explainability; decision learning | Constitution §11, Domain Model `Decision`, Blueprint §13 |
| [`OPERATION_CENTER.md`](./OPERATION_CENTER.md) | Real-time monitoring; event coordination; queues; incidents; escalation | Constitution §10, Domain Model `Operation`/`SmartEvent`, Blueprint §§7/12, Decision Engine |
| [`KNOWLEDGE_BASE.md`](./KNOWLEDGE_BASE.md) | Institutional memory; taxonomy; provenance; knowledge governance | Constitution §9, Domain Model `KnowledgeBase`, Blueprint §11 |
| [`AI_PROPERTY_EMPLOYEE.md`](./AI_PROPERTY_EMPLOYEE.md) | Digital employee identity; can/must-never; ethics; human interactions | Constitution §§3–7, Domain Model `AIEmployee`, Blueprint §6 |
| [`MULTI_AGENT_ARCHITECTURE.md`](./MULTI_AGENT_ARCHITECTURE.md) | Digital workforce org; agent registry; specialist charters; collaboration | Blueprint §17, AI Property Employee, Decision/OC/KB |
| [`SPP_ENGINE_VISION.md`](./SPP_ENGINE_VISION.md) | Koil layers: deterministic / AI understanding / learning | Constitution, Blueprint AI Employee, Domain Model Knowledge |
| [`MERGE_GATE_PLAN.md`](./MERGE_GATE_PLAN.md) | Merge / gate delivery intent | Blueprint gate semantics |
| [`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md) | Document law, SSOT, naming, approval | All pillars |
| [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) | Ownership / terminology / conflict / gap proof | Does not redefine pillars |
| [`ARCHITECTURE_FREEZE.md`](./ARCHITECTURE_FREEZE.md) | Architecture Phase exit; Enterprise Architecture v1.0 contract; RFC gate | Freeze set in Freeze §4 |

**Division of labour (quick):** Decision Engine **decides** · Operation Center **coordinates** · Knowledge Base **remembers** · AI Property Employee / Chief **faces the owner** · Specialists **propose under the Chief**.

---

# 3. Canonical terminology

| Use this | Meaning | Do not |
|---|---|---|
| AI Property Employee / AI Employee | Product role: proposes, explains, learns; never approves | Treat as a chatbot product |
| Chief AI Property Employee | Same employee as coordinator of the digital workforce | Create a second owner-facing bot brand |
| Koil | Intelligence system behind the AI Employee | Write **Kowil** in new normative prose (historical alias only) |
| Smart Employee desk | UI workplace surface name | Treat `smart-employee/` as a second constitution (Option A) |
| Operation Center | Real-time operations capability (Constitution §10) | Invent a separate subsystem named only “Operations Center” — Blueprint title is an alias for the same capability |
| Knowledge Base | Institutional memory | Parallel ungoverned insight stores |
| Knowledge Graph | Structural view of KB (Blueprint §11) | Confuse graph shape with a second SSOT |
| Decision Engine | Judgement / authority classes / unified agenda | Second actionable tip stream without Decision ids |
| Collections Agent | Arrears specialist (Multi-Agent) | Conflict with Blueprint “Collection agent” — same role |
| Utility Agent | Utilities specialist (Multi-Agent) | Conflict with Blueprint “Utilities agent” — same role |

Full audit notes: [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) §4.

---

# 4. Gap registries (where gaps live)

| Prefix / location | Owning document | Purpose |
|---|---|---|
| G-01… | [`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md) §8 | Governance / SSOT process gaps |
| Blueprint §19 | [`SPP_BLUEPRINT.md`](./SPP_BLUEPRINT.md) | Structural roadmap gaps (bus, rails, memory, …) |
| SA-* | [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) | Enterprise system gaps |
| DA-* | [`DATA_ARCHITECTURE.md`](./DATA_ARCHITECTURE.md) | Data-plane gaps |
| DE-* | [`DECISION_ENGINE.md`](./DECISION_ENGINE.md) | Decision capability gaps |
| OC-* | [`OPERATION_CENTER.md`](./OPERATION_CENTER.md) | Operations coordination gaps |
| KB-* | [`KNOWLEDGE_BASE.md`](./KNOWLEDGE_BASE.md) | Knowledge gaps |
| AIE-* | [`AI_PROPERTY_EMPLOYEE.md`](./AI_PROPERTY_EMPLOYEE.md) | Digital employee gaps |
| MA-* | [`MULTI_AGENT_ARCHITECTURE.md`](./MULTI_AGENT_ARCHITECTURE.md) | Multi-agent org gaps |
| AUD-* | [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) | Audit/process findings |
| Freeze §21 | [`ARCHITECTURE_FREEZE.md`](./ARCHITECTURE_FREEZE.md) | Accepted/open gaps carried into Implementation Phase (points at owning registries) |

**Rule:** Supporting docs may **link** Blueprint §19 / peer gaps; they must not fork a second conflicting roadmap for the same item.

---

# 5. How to use this index

1. Product identity → Constitution.  
2. Entity or language → Domain Model.  
3. Boundary, pipeline, integration, or gate → Blueprint.  
4. End-to-end composition / security / scale / HA / DR / observability → System Architecture.  
5. Stores, sync, retention, privacy, AI memory → Data Architecture.  
6. May we recommend / auto-act / forbid? → Decision Engine.  
7. Real-time events, queues, incidents, escalation → Operation Center.  
8. Institutional memory / taxonomy / provenance → Knowledge Base.  
9. Digital employee identity / ethics / interactions → AI Property Employee.  
10. Specialist workforce / registry / collaboration → Multi-Agent Architecture.  
11. Koil layer placement → Engine Vision.  
12. “May we implement yet?” → Architecture Freeze §25 + Architecture Governance §7.  
13. Structural change after freeze → Architecture Freeze RFC (§9) **before** code.  
14. Ownership / terminology / conflict doubt → Architecture Audit + this README.  
15. Discovered contradiction → record a gap in the **owning** document; do not silently pick a side.

---

# 6. Recommended reading order (architecture baseline)

1. Constitution → Domain Model → Blueprint  
2. Architecture Governance → this README → Architecture Audit → Architecture Freeze  
3. System Architecture → Data Architecture  
4. Knowledge Base → Decision Engine → Operation Center  
5. AI Property Employee → Multi-Agent Architecture  
6. Engine Vision (Koil layers) as needed for engine work  

---

# 7. Operating path (non-pillar)

These help delivery teams navigate the running system. They must not redefine identity, entities, or boundaries. Where status disagrees with the Blueprint, the **Blueprint wins** (see Governance G-04).

| Document | Use |
|---|---|
| [`APP_PATH.md`](./APP_PATH.md) | End-to-end intake → employee → actions → integrations map |
| [`LAYER_MAP.md`](./LAYER_MAP.md) | Clean Architecture package map for new/migrated code (Blueprint §5) |
| [`DATA_SPINE_AUDIT.md`](./DATA_SPINE_AUDIT.md) | Historical audit of upload → apply → Property OS fields |
| [`ENGINE_APPLY_CONTINUATION.md`](./ENGINE_APPLY_CONTINUATION.md) | Continuation notes for apply work |
| [`STITCH_SCREEN_MAP.md`](./STITCH_SCREEN_MAP.md) | Screen map reference |
| [`EXPO_BETA_TESTING.md`](./EXPO_BETA_TESTING.md) | Beta testing notes |
| [`OTA_AUTO_UPDATE.md`](./OTA_AUTO_UPDATE.md) | OTA channel notes |
| [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) | Architecture SSOT audit findings (also freeze-set companion) |

Governance / freeze contracts are indexed in §2 (not operating path).

---

# 8. Outside `docs/` (not architectural law)

| Location | Role |
|---|---|
| `HANDOFF.md` | Operational handoff; may drift; not SSOT |
| `AGENTS.md` | Cloud agent runbook |
| `memory/`, `proofs/`, `test_reports/` | Product memory and evidence |
| `backend/docs/` | Backend-local technical notes (e.g. data quality) |
| `smart-employee/` | **Separate Arabic product** — out of SPP architecture scope (Governance §6.3) |

---

# 9. Document status

*Document Status:* Official Documentation Index

*Version:* 1.2

*Project:* Smart Property Platform (SPP)

*v1.2:* Clarify scope — SPP docs govern SPP only; Arabic product folder is out of scope.

*Version:* 2.0

*Project:* Smart Property Platform (SPP)

*Architecture contract:* [`ARCHITECTURE_FREEZE.md`](./ARCHITECTURE_FREEZE.md) (Enterprise Architecture v1.0)

*v1.1:* Record Option A adoption for `smart-employee/` (Governance §6.3).  
*v1.2:* Index `SYSTEM_ARCHITECTURE.md`.  
*v1.3:* Index `DATA_ARCHITECTURE.md`.  
*v1.4:* Index `DECISION_ENGINE.md`.  
*v1.5:* Index `OPERATION_CENTER.md`.  
*v1.6:* Index `KNOWLEDGE_BASE.md`.  
*v1.7:* Index `AI_PROPERTY_EMPLOYEE.md`.  
*v1.8:* Index `MULTI_AGENT_ARCHITECTURE.md`.  
*v1.9:* Final architecture map — ownership matrix, terminology, gap registries, reading order, Architecture Audit link.  
*v2.0:* Index Architecture Freeze — Architecture Phase exit / v1.0 architectural contract.
