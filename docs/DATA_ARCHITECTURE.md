# SPP Data Architecture v1.0

> Official data architecture specification for the Smart Property Platform (SPP).
> This is a core architecture document. It defines how property truth is classified, owned, stored, validated, secured, retained, synchronised, and evolved — not how storage clients are coded.
> Document process and SSOT rules: `docs/ARCHITECTURE_GOVERNANCE.md`. Index: `docs/README.md`.

---

# 0. Document authority and boundaries

## 0.1 Role in the document set

| Document | Owns | This document must |
|---|---|---|
| `docs/SPP_CONSTITUTION.md` | Product identity; data lifecycle intent; Property Knowledge list | Obey; never redefine identity |
| `docs/DOMAIN_MODEL.md` | Entity meaning, relationships, lifecycles, ubiquitous language | Use names and aggregates without restating catalogs |
| `docs/SPP_BLUEPRINT.md` | Layer boundaries; Smart Import stages; gate semantics; sources-of-truth table; Knowledge Graph layers; event envelope | Link for structural rules; not copy stage tables |
| `docs/SYSTEM_ARCHITECTURE.md` | End-to-end composition; security/HA/DR/ops framing | Align storage and data-plane decisions with system strategy |
| `docs/DATA_ARCHITECTURE.md` (this document) | Data classes, ownership, stores, quality, sync, retention, privacy, governance of data | Be the reference for every future database, integration payload store, AI memory, reporting store, and Smart Import persistence choice |

**Conflict rule:** Precedence follows Architecture Governance §2.2. This document may deepen Blueprint §14 and System Architecture data sections; it may not contradict Constitution, Domain Model, or Blueprint gate/import semantics.

## 0.2 Status legend

Aligned with Blueprint: **Implemented** · **Partial** · **Placeholder** · **Planned**.

## 0.3 Decision record format

Every architectural decision below states: **Decision**, **Rationale**, and **Consequence**. Gaps are first-class in §38.

---

# 1. Data Philosophy

| Decision | Rationale | Consequence |
|---|---|---|
| Data exists to make SPP a better Property Employee, not to feed dashboards | Constitution §§4–5, §9 | Storage choices are judged by decision quality, explainability, and operations readiness |
| Truth is provenance-bearing | Domain Model §2.3; Blueprint §2.8 | Every durable fact carries origin (import batch, platform event, owner confirmation, or inference) and a trust signal |
| Merge beats replace | Blueprint §2.9 | Re-imports and sync jobs update by identity; they never wipe portfolio history |
| Official human confirmation outranks machines | Blueprint §14.3 | Owner-confirmed records are a protected truth class |
| Derived views are disposable | Domain Model read-model rule | Reports, briefs, and caches may be rebuilt; they are never authoritative write targets |
| Device working truth is legitimate | Blueprint §2.6 | Offline usefulness is a data-plane requirement, not a UI nicety |
| Foreign data never enters raw | Blueprint §2.7 | Vendor payloads stop at the anti-corruption boundary |

**Philosophy statement:** SPP data architecture optimises for **defensible property operations** — facts that can be traced, gated, explained, and acted on under owner authority.

---

# 2. Single Source of Truth

## 2.1 Architectural SSOT versus operational SSOT

| Kind | Location | Role |
|---|---|---|
| Architectural SSOT | `docs/` under Architecture Governance | What data *means* and which store *may* own it |
| Operational SSOT (per domain) | The primary source named for that domain | What the running system reads as authoritative at a moment |

This document governs architectural SSOT for data. Operational sources of truth by domain remain those stated in Blueprint §14.1; routing modes in Blueprint §14.2.

## 2.2 Operational SSOT map (enterprise view)

| Data concern | Operational primary | Secondary / fallback | Notes |
|---|---|---|---|
| Owner ledger when Sheets connected | Google Sheets via Apps Script | Document store | Hybrid routing allowed |
| Portfolio after file import (no Sheets) | Applied import state | Document store → memory | Analysis identity is the audit key |
| Working portfolio on device | Device store | Rebuild from re-apply | Survives offline |
| Applied analysis artifacts | Document store by analysis identity | In-memory | Feeds live read models |
| Integration / SmartEvent streams | Document store per stream | In-memory (defect if production-critical) | One stream still memory-only today |
| Approvals and operations | Document store + device operation log | In-memory | Append-only |
| Editorial guides | Curated static content | — | Not portfolio truth |

## 2.3 Non-SSOT surfaces

| Surface | Why it is not SSOT |
|---|---|
| Executive Report / brief projections | Rebuilt from knowledge and engines |
| AI Employee task lists | Ranked agenda derived from portfolio + events |
| Caches | Performance aids with TTL/invalidation |
| LLM context windows | Ephemeral, bounded, never authoritative |
| Vendor raw payloads | Evidence behind normalised events, not domain truth |

**Decision:** A fact may have only one write authority at a time. **Rationale:** Dual writers without merge rules create silent corruption. **Consequence:** Sync and import must declare writer roles before they touch an aggregate.

---

# 3. Data Ownership

## 3.1 Ownership by bounded context

Context ownership follows Domain Model §3. Data ownership below is the **stewardship** model for persistence and change control.

| Owner (steward) | Owns writes to | Must not write |
|---|---|---|
| Ingestion (`ImportJob`) | Merged registry, leasing, finance facts from owner files; analysis artifacts | External vendor-shaped records; silent official overwrites |
| Operations Center | `SmartEvent`, `Operation`, integration-normalised streams | Property Registry identity creation bypassing import/owner flows |
| Intelligence | `Decision`, `Prediction`, Knowledge projections, preference memory | Money totals; ledger rows as calculator |
| Owner (human via Application) | Official confirmations, approvals, revocations, manual corrections | Bypassing gate for blocked batches |
| Presentation | Local UI state only | Domain eligibility, arrears, or vendor credentials |
| Infrastructure adapters | Bytes in stores; translation at boundaries | Business judgement |

## 3.2 Cross-context write rules

1. External Integrations feed Operations Center only — never the registry directly (Domain Model §3).
2. Intelligence reads widely; writes only intelligence artifacts.
3. Executive reporting reads; it does not originate portfolio truth.
4. Portal actors write only audience-scoped submissions (e.g. payment proof, ticket notes) that enter as pending facts until owner confirmation where required.

**Decision:** Stewardship is context-based, not store-based. **Rationale:** The same Mongo collection or device key may hold multiple contexts; ownership must follow domain meaning. **Consequence:** Reviews reject “the database owns this field” as a design argument.

---

# 4. Master Data

Master data are slow-changing identities that other records hang from.

| Master set | Domain entities (names only) | Identity rule home | Status |
|---|---|---|---|
| Portfolio structure | `Owner`, `Property`, `Building`, `Unit` | Domain Model §§4–5 | Building still Planned as first-class |
| Parties | `Tenant`, `Technician`, portal actors | Stable ids + opaque portal tokens | Implemented / Partial |
| Commercial anchors | `Contract` lineage per unit | Unit-derived contract identity | Implemented |
| Integration subjects | `LeasePlatform`, `UtilityAccount`, `Sensor` registrations | SPP vocabulary identities | Partial / Placeholder |

**Decision:** Master data is identity-stable across imports. **Rationale:** Statement re-import must update, not duplicate (Domain Model §4). **Consequence:** Master keys are assigned at creation and never reused for a different real-world thing.

**Decision:** Portal tokens are not master identity. **Rationale:** Access must be revocable without deleting the person. **Consequence:** Token rotation must not cascade-delete history.

---

# 5. Transactional Data

Transactional data record agreements, money movement, and work execution.

| Class | Examples | Mutation style | Status |
|---|---|---|---|
| Ledger & settlements | `Payment` records, monthly ledger rows, tenant payment proofs | Append-only for confirmed money; corrections add records | Implemented |
| Billing | `Invoice` issuance and balances | State transitions with history | Partial |
| Maintenance work | `MaintenanceTicket` timeline, cost proposals | Evented lifecycle | Implemented |
| Approvals | Decision approval records; prepared outbound content | Append-only; delivery state explicit | Implemented |
| Import commits | `ImportJob` apply batch + change log | Append-only audit of merge | Implemented |

**Decision:** Financial and approval records are append-only. **Rationale:** Rewriting money or approval history destroys auditability and learning. **Consequence:** Corrections create new records; reports must understand supersession.

**Decision:** Prepared actions are transactional intents, not deliveries. **Rationale:** Prepare-not-send (Blueprint §2.5, §13.3). **Consequence:** Outbox (target) retries delivery without re-creating approval.

---

# 6. Analytical Data

Analytical data are derived structures optimised for understanding, not for writing truth.

| Analytical product | Built from | Rebuildable? | Normative home |
|---|---|---|---|
| Property knowledge snapshot | Deep analysis + apply | Yes, from batch artifacts | Blueprint §11 |
| Executive Report / Brief | Knowledge + reasoning | Yes | Blueprint §10; Constitution §12 |
| Morning briefing / executive brain | Live portfolio + gate | Yes | Blueprint §10.2 |
| Asset risk aggregates | Asset memory + tickets | Yes | Blueprint §11.1 |
| Occupancy churn snapshots | Apply movement | Retained for reporting | Domain Model ImportJob |
| Predictions | Knowledge + history | Yes; accuracy feedback returns to knowledge | Domain Model `Prediction` |

**Decision:** Analytical stores may be materialised for speed but remain projections. **Rationale:** Prevents “dashboard tables” becoming a second ledger. **Consequence:** Materialised analytics must declare invalidation keys (analysis id, event id, gate version).

**Decision:** Analytical numbers come from deterministic engines, never from the language layer. **Rationale:** Blueprint §10.4 truthfulness. **Consequence:** LLM output cannot be persisted as an analytical metric authority.

---

# 7. AI Knowledge Data

AI Knowledge data is the engine-readable understanding that lets Koil reason without re-parsing files.

| Knowledge kind | Content intent | Lifetime | Status |
|---|---|---|---|
| Canonical portfolio projection | Normalised settings, units, assets, life events | Per applied batch | Implemented |
| Property knowledge | Verified facts: units, collection, arrears, lifecycle, contracts, quality, tenant cards | Per batch, promoted to current | Implemented |
| Asset memory | Cumulative fault/cost/warranty/risk | Cumulative | Partial |
| Decision memory | Proposed / approved / prepared / rejected / followed | Cumulative | Partial |
| Preference memory | Owner ranking and correction habits | Cumulative | Planned / Partial |
| Editorial knowledge | Guides shown to users | Static curated | Implemented |
| Client profile learning | Per-owner interpretation corrections (Engine Vision layer 3) | Cumulative per client | Planned |

Graph shape and required traversals: Blueprint §11. Entity responsibility: Domain Model `KnowledgeBase`. Interaction matrix: System Architecture §6.

**Decision:** Knowledge is derived, not hand-authored as free text truth. **Rationale:** Domain Model KnowledgeBase invariants. **Consequence:** Corrections enter through entities and official flags; knowledge rebuilds.

**Decision:** Longitudinal memory is mandatory before multi-agent autonomy. **Rationale:** System Architecture §6.4; Blueprint §17.5. **Consequence:** Do not advertise continuous autonomous agents while knowledge resets each import.

---

# 8. Operational Data

Operational data is the time-ordered record of what happened in the Operations Center.

| Store / stream | Holds | Write path | Status |
|---|---|---|---|
| Normalised integration events | Bills, lease notices, messages, intel signals | Webhook → ACL → store | Partial |
| Operations log | Immutable operation entries | Approval and workflow transitions | Partial |
| Notifications | Audience-scoped tellings | Derived from events/decisions | Implemented / Partial |
| Pending actions | Owner-resolvable action items | Interpretation stage | Implemented |
| Connection health | Healthy / degraded / disconnected | Integration adapters | Partial |
| Desk pull cursors / seen ids | Client dedup aids | Device | Implemented (pull model) |

Processing stages: Blueprint §7. Event bus target: Blueprint §12. System placement: System Architecture §§10–11.

**Decision:** Operational data uses one conceptual event shape even before one physical bus exists. **Rationale:** Prevents permanent per-vendor schemas. **Consequence:** New integrations must normalise to the envelope fields in Blueprint §12.2.

---

# 9. Historical Data

| History kind | Retention intent | Query purpose |
|---|---|---|
| Applied analysis batches | Long-lived | Trace any fact to asserting import |
| Import change logs | Long-lived | Explain merges and conflicts |
| Ledger / payment history | Long-lived | Collection, disputes, reports |
| Ticket timelines | Long-lived | Maintenance economics, technician performance |
| Approval / preparation history | Long-lived | Accountability and learning |
| Superseded knowledge snapshots | Audit window then summary | Compare statement-over-statement |
| Raw vendor payloads | Audit window then discard/summarise | Dispute and replay |
| Ephemeral LLM contexts | None beyond request | Not historical truth |

**Decision:** History is append-oriented; deletion is exceptional and governed. **Rationale:** Property operations are dispute-prone and learning-dependent. **Consequence:** “Hard delete” of financial or approval history requires an explicit governance exception (§36).

---

# 10. External Data Sources

| Source | Enters as | Becomes in SPP | Status |
|---|---|---|---|
| Owner CSV / Excel uploads | `ImportJob` files | Master + transactional merges | Implemented |
| Google Sheets / Apps Script | Ledger + analysis mirror + PDF | Portfolio / report artifacts | Implemented |
| Lease registry (Ejar) | Webhook payloads | `SmartEvent` / lease notices | Partial |
| Electricity / water providers | Webhook payloads | Utility `SmartEvent`, prepared payments | Partial |
| Messaging / intelligence channels | Webhook payloads | Routed inbound events | Partial |
| Home Assistant / IoT | Telemetry (target) | `Sensor` readings → `SmartEvent` | Placeholder |
| Payment providers | Settlement callbacks (target) | Delivery state on prepared actions | Absent |
| LLM provider | Model responses | Validated explanations only | Implemented, off by default |
| Future APIs | Vendor protocol | SPP vocabulary via ACL | Planned |

Admission contract for any new source: Blueprint §8.3; System Architecture §12.3.

**Decision:** External sources never dictate internal schema names. **Rationale:** Anti-corruption and Smart Import freeze. **Consequence:** Mapping tables live at adapters; domain stores speak Domain Model language only.

---

# 11. Google Sheets Architecture

## 11.1 Role of Sheets in the data plane

| Role | Description | Status |
|---|---|---|
| Owner ledger of record (many owners) | Primary for portfolio structure and ledger when connected | Implemented |
| Import pipeline peer | Dual engine with service-side import; identical application contract | Implemented |
| Report PDF authority | Portable document generation for applied batch | Implemented when configured |
| Not a free-form app database | Sheet/column identities are frozen contracts | Binding |

## 11.2 Decisions

| Decision | Rationale | Consequence |
|---|---|---|
| Dual import engines with contract parity | Owners live in Sheets; platform must work without Sheets | Benchmarks enforce shape parity (Blueprint §18) |
| Sheet and column names are frozen | Historical imports and owner ledgers break on rename | Rename is a governed breaking change only |
| Hybrid read routing allowed | Resilience when Sheets is slow or down | Fallback to document store must not invent facts |
| Apps Script remains an independent deployable | Different release cadence and trust boundary | API treats Scripts as an external system with ACL |
| Credentials never enter the mobile app | System Architecture security boundary | Sheets secrets stay in service environment |

Structural integration detail: Blueprint §§3.2, 8, 9, 14. Smart Import protection: Governance writing rule on Sheets freeze.

---

# 12. Database Architecture (current and future)

## 12.1 Current data plane

| Store | Technology posture | Used for | Status |
|---|---|---|---|
| Document store | Optional MongoDB-compatible service | Applied analysis, events, approvals, chat/history | Implemented optional |
| In-process memory | Fallback when store absent | Beta/demo and degraded paths | Implemented |
| Device keyed store | On-device persistence (`spp.*` family) | Working portfolio, portals tokens, local logs | Implemented |
| Sheets engine | Google infrastructure | Ledger + PDF | Implemented when configured |

**Decision:** Document store is optional with explicit fallback. **Rationale:** Beta and demonstration must run with zero infrastructure (Blueprint §18). **Consequence:** Production-critical streams must not remain memory-only (gap DA-01).

## 12.2 Future database architecture

| Plane | Target | Rationale |
|---|---|---|
| System of record (cloud) | Managed document database, multi-instance safe | Durability for approvals, analysis, events |
| Working set (edge) | Device store with shape-tolerant migrations | Offline Property Employee |
| Analytical materialisations | Rebuildable collections or views keyed by batch/event | Report performance without second truth |
| Job / outbox store | Durable work items for workers | Retries without duplicate approval |
| Optional relational projection (Planned) | Only if strong reporting joins demand it | Must remain a projection, not a competing ledger |

**Decision:** Do not introduce a second system of record for the same aggregate without a declared sync authority. **Rationale:** Split-brain portfolios destroy trust. **Consequence:** New DB technology requires an ownership amendment in this document.

**Decision:** Prefer document + device + Sheets triad before adding warehouses. **Rationale:** Current scale and merge semantics fit documents; warehouses are analytical. **Consequence:** A warehouse, if added, is analytical-only (§6).

---

# 13. Document Storage

“Document storage” here means **structured documents** (JSON-like aggregates), not PDFs.

| Document family | Keying | Durability requirement |
|---|---|---|
| Applied analysis state | Analysis identity | High — feeds AI and reports |
| Gate verdict packages | Analysis identity | High — reapplied at read time |
| Unified decision lists | Analysis / portfolio scope | High |
| Approval records | Decision + approval identity | Critical |
| Integration event documents | Source + source identity | High in production |
| Chat / controlled interpreter traces | Session / message identity | Medium — privacy capped |

**Decision:** Analysis identity is the spine for import-derived documents. **Rationale:** Links preview, apply, audit, and AI state (Domain Model §4). **Consequence:** Orphan analysis documents without identity are rejected at design review.

---

# 14. Object Storage

Object storage holds **opaque blobs**: uploads, media, generated files.

| Object class | Examples | Current | Target |
|---|---|---|---|
| Import uploads | CSV/Excel bytes, snippets used in analysis | Service upload path / transient | Durable object bucket with retention |
| Maintenance media | Photos/video on tickets | Device / portal submissions | Object store with ticket-scoped access |
| Generated PDFs | Executive report documents | Sheets-hosted links when configured | Object store or Sheets; service fallback renderer later |
| Raw webhook bodies (optional) | Vendor payloads for audit window | Often inline in event docs | Object pointers from event envelope |

**Decision:** Object storage is evidence, not domain truth. **Rationale:** Engines consume normalised facts; blobs support proof and replay. **Consequence:** Access control on objects must match audience of the referencing entity.

**Decision:** LLM context must not load raw upload objects. **Rationale:** Blueprint §6.3; System Architecture §13. **Consequence:** Interpreters read verified analysis documents only.

---

# 15. AI Memory Storage

| Memory tier | Stores | Write authority | Read consumers |
|---|---|---|---|
| Working context | Bounded snapshot for one question/task cycle | Context builder | Controlled interpreter / local Koil |
| Portfolio knowledge | Promoted knowledge snapshot | Import apply + enrichment | AI Employee, Decision, Report |
| Decision memory | Outcomes of owner judgement | Approval flows | Ranker, learning |
| Preference / client profile | Repeated corrections and ranking habits | Learning layer (target) | Import understanding, ranker |
| Asset memory | Cumulative asset economics | Apply + maintenance events | Maintenance agent (future), reports |

**Decision:** Separate working context from durable memory. **Rationale:** Prevents prompt residue from becoming portfolio truth. **Consequence:** Working context is ephemeral and capped.

**Decision:** Multi-agent specialists share memory stores; they do not keep private ledgers. **Rationale:** Blueprint §17.4. **Consequence:** Specialist “memory” is filtered views over shared knowledge, not forked databases.

---

# 16. Vector Database Strategy

| Decision | Rationale | Consequence |
|---|---|---|
| No vector database is required for the current deterministic Koil path | Core property maths and gate logic are not similarity search | Do not block Smart Import or Decision Engine on embeddings |
| Vectors are **Planned** only for retrieval over editorial knowledge, long notes, and longitudinal narratives | Helps AI understanding layer without touching deterministic totals | Vector hits are hints to fetch verified documents — never numeric authorities |
| Embeddings must reference durable document ids with provenance | Otherwise retrieval invents ungrounded context | Every chunk points to analysis id, entity id, or editorial id |
| PII-bearing chunks inherit privacy classification of source (§34) | Portal and tenant text may enter notes | Indexing pipelines enforce audience filters |
| Deletion/revocation must remove or tombstone vectors | Token revoke and official corrections change what may be retrieved | Vector store is not exempt from retention and access rules |

**Gap:** No production vector store selection yet (DA-08). Selection must follow §12 future plane rules and privacy classification.

---

# 17. Cache Strategy

| Cache | Purpose | Invalidation | Allowed to serve as truth? |
|---|---|---|---|
| Sheets lightweight read cache | Reduce Apps Script latency | Short TTL + error fallback to document store | No — revalidate on hybrid miss |
| Device portfolio cache | Offline working set | Apply, owner edit, sync pull | Working truth locally; reconciles to cloud |
| API response caches (if any) | Performance | Per-resource ETag/TTL; never for approvals | No |
| Read model materialisations | Briefings, cards | Gate version + analysis id + event cursor | No |
| LLM response cache | Cost control | Hash of bounded verified context only | No — explanatory only |

**Decision:** Caches are performance and offline aids, never conflict winners. **Rationale:** Conflict order is Blueprint §14.3. **Consequence:** Cache hit cannot override official or gated facts.

**Decision:** Beta mode forces local sources and disables non-deterministic remote cache dependence. **Rationale:** Deterministic demos and tests. **Consequence:** Cache strategies must honour beta overrides.

---

# 18. Event Storage

## 18.1 Current

Per-integration stores; pull-based consumption; dual deduplication (server source identity + device seen set). Blueprint §12.1.

## 18.2 Target event store properties

| Property | Requirement |
|---|---|
| Envelope completeness | Fields in Blueprint §12.2 |
| Idempotent writes | Source + source identity |
| Ordering | Per subject |
| Retention | Full envelope for audit window; then summary; raw discarded/pointed |
| Outbox co-location | Prepared actions durable with approval linkage |
| Traceability | Correlation from intake → dispatch |

**Decision:** Unify envelope before introducing a broker. **Rationale:** System Architecture §11.4 migration order. **Consequence:** Buying a queue without envelope normalisation is rejected.

---

# 19. Audit Log Architecture

| Audit stream | Minimum record | Integrity |
|---|---|---|
| Import change log | Entity type, identity, added/updated/conflicting, reason | Append-only per batch |
| Approval audit | Actor, time, decision id, exact prepared content | Append-only |
| Operations timeline | Operation entry for consequential transitions | Append-only |
| Access-significant portal acts | Token use class, actor type, resource scope (no secrets) | Append-only / Planned hardening |
| Admin/config changes | Who changed routing mode, connection intent | Planned |

**Decision:** Product audit is distinct from infrastructure logs. **Rationale:** System Architecture §19 — observability pillars include audits as product reconstructability. **Consequence:** Log shipping tools do not replace approval and change-log stores.

**Decision:** Audit records omit secrets and raw credential material. **Rationale:** Data security §31. **Consequence:** Redaction is part of the audit schema, not an afterthought.

---

# 20. Data Relationships

Relationship meaning lives in Domain Model. This section states **persistence relationship rules** only.

| Rule | Statement | Rationale |
|---|---|---|
| Identity edges | Every transactional row references master identity, never only a display label | Stable merges |
| Provenance edges | Every asserted fact references asserting batch or event | Blueprint §11.2 |
| Audience edges | Notifications reference audience + entitlements | No cross-audience leak |
| Approval edges | Prepared content references decision + approval | Prepare-not-send |
| Projection edges | Analytical docs reference source knowledge/gate versions | Rebuild safety |
| No vendor edges in domain stores | Vendor ids may appear only as ACL metadata on events | Anti-corruption |

Load-bearing traversals the stores must support remain those in Blueprint §11.3.

---

# 21. Data Lifecycle

Constitution §8 defines the product lifecycle. Data-plane mapping:

| Stage | Data-plane action | Durability |
|---|---|---|
| Import | Creation of `ImportJob` + raw/object intake | Transient objects → analysis docs |
| Validation | Classification confidence, schema/type checks | Findings on analysis |
| Normalisation | ACL + deterministic normalisation | Normalised rows in analysis |
| Storage | Apply merge to master/transactional stores | Durable |
| Knowledge | Build/promote knowledge documents | Durable snapshots |
| Analysis | Reasoning + gate verdict persistence | Durable with batch |
| Decision | Unified decisions + scores | Durable proposals |
| Execution | Approval + prepared content + future dispatch state | Critical durable |
| Learning | Preference / accuracy signals | Cumulative durable (target) |

**Decision:** Preview stage persists nothing to portfolio truth. **Rationale:** Owner authority before merge. **Consequence:** Preview artifacts are disposable unless retained for support under privacy rules.

---

# 22. Import Data Flow

Normative stages: Blueprint §9. Entity: Domain Model `ImportJob`. Enterprise contracts: System Architecture §7.

Data-architecture view of the flow:

1. **Intake objects** land in upload/object handling with file metadata.
2. **Analysis documents** accumulate classified rows, deep analysis, knowledge, reasoning, decisions, gate.
3. **Preview** exposes a diff against current master/transactional data — no merge yet.
4. **Apply** merges by stable identity; writes change log; persists analysis state; records batch.
5. **Promotion** updates current knowledge pointer; invalidates analytical caches/read models.
6. **Trace** leaves provenance edges from entities to analysis identity.

**Decision:** Apply is the only import path that mutates portfolio SSOT. **Rationale:** Prevents partial automated writes. **Consequence:** Background “helpful sync” cannot bypass apply semantics for file imports.

---

# 23. Export Data Flow

| Export | Source of numbers | Channel | Constraint |
|---|---|---|---|
| Executive PDF | Applied batch via Sheets engine (current) | Hosted link | Unavailable without Sheets until service renderer exists |
| Share messages | Prepared content after approval | Future messaging rail / current deep links | Prepare-not-send |
| Portal-scoped views | Audience-filtered projections | HTTPS portal bridge | No portfolio-wide finance for technicians/guards |
| Owner backups (Planned) | Master + transactional + approvals | Controlled export package | Privacy classification enforced |
| Analytics extract (Planned) | Analytical projections only | Warehouse/export job | Not a second ledger |

**Decision:** Exports never elevate a projection to write-back authority. **Rationale:** Round-tripping dashboard CSV into SSOT without ImportJob would bypass the gate. **Consequence:** Re-import of exports must enter Smart Import as a governed path.

---

# 24. Executive Reporting Data Flow

Constitution §12; Blueprint §10; System Architecture §8.

| Step | Data input | Data output |
|---|---|---|
| 1 | Applied knowledge + reasoning + gate | Structured report sections |
| 2 | Same | Narrative brief with review flags when gated |
| 3 | Live portfolio + gate reapplication | Briefing / brain / cards |
| 4 | Applied batch identity | PDF generation request (Sheets) |
| 5 | Decision identifiers | Traceable narrative claims |

**Decision:** Gate status is a reporting input, not a cosmetic badge. **Rationale:** Blocked data must surface as review items. **Consequence:** Reporting stores must persist enough gate context to reapply at read time.

**Decision:** New operational streams are incomplete until report-projectable. **Rationale:** System Architecture §8.3 continuity. **Consequence:** Integration designs include reporting field mapping in the same change set.

---

# 25. Data Synchronization

| Sync path | Model | Conflict rule |
|---|---|---|
| Sheets ↔ document store | Hybrid read; configurable per domain | Blueprint §14.2–14.3 |
| Device ↔ cloud | Eventual reconciliation; device useful offline | Official records win; merge by identity |
| Integration ingress → device desk | Client pull of normalised events | Server dedup + device seen set |
| Dual import engines | Contract parity, not live dual-write of apply | One apply commit authority per batch |
| Future outbox → providers | At-least-once delivery | Idempotent provider keys; approval not duplicated |
| Multi-agent consumers (future) | Shared event envelope | One proposer per subject per cycle |

**Decision:** Sync is merge-based and identity-stable. **Rationale:** Same as import philosophy. **Consequence:** Last-write-wins on whole portfolio documents is forbidden for master/transactional data.

**Decision:** Beta mode pins local sources. **Rationale:** Determinism for demos/tests. **Consequence:** Sync to external ledgers is disabled or simulated under beta flags.

---

# 26. Data Validation

Validation is layered; each layer has a different failure mode.

| Layer | Validates | Failure mode |
|---|---|---|
| Transport | Request/webhook shape | Reject at interface |
| ACL normalisation | Vendor → SPP types | Quarantine / reject event |
| Deterministic domain rules | Money, dates, statuses, identities | Analysis findings; no silent coerce of official facts |
| Consistency gate | Cross-fact contradictions | Ok / Warning / Blocked (Blueprint §13.2) |
| Controlled interpreter validation | No invented numbers/entities/decisions | Deterministic fallback |
| Access validation | Audience entitlement | Deny / empty scoped view |

**Decision:** Validation may not “fix” official owner values without an explicit owner correction path. **Rationale:** Official truth class. **Consequence:** Validators raise conflicts; they do not overwrite official records.

---

# 27. Data Quality Rules

Quality is a persisted property of data, not only a CI concern.

| Rule class | Examples of intent | Travels with |
|---|---|---|
| Completeness | Missing contacts, incomplete unit counts vs declared | Knowledge quality flags |
| Consistency | Ledger vs board mismatch; paid marked overdue | Gate conflicts |
| Freshness | Stale sensor/utility signals (target) | Connection health + event times |
| Confidence | Classification confidence; gate ceilings | Analysis + decisions |
| Lineage | Missing provenance edge | Reject or mark inference |
| Compatibility | Sheet/column mapping stability | Import pipeline contract |

Benchmark and engine quality gates for releases: Blueprint §16.1. Backend-local notes outside architectural law may exist under `backend/docs/` but cannot redefine these rules.

**Decision:** Quality flags are mandatory passengers to AI Employee, Decision Engine, and Executive Report. **Rationale:** Confident wrong output is worse than cautious output (Blueprint §18). **Consequence:** Consumers that drop quality flags are architecture defects.

---

# 28. Data Versioning

| Asset | Versioning approach | Rationale |
|---|---|---|
| Device store shapes | Shape-tolerant; writers never remove fields older builds need | Blueprint §14.4; OTA diversity |
| Analysis / knowledge snapshots | New batch supersedes; old retained | Compare and audit |
| Gate verdict | Persisted with analysis; reapplied on read | Prevent stale confidence |
| Event envelope | Additive field evolution | Consumers ignore unknown fields |
| API read models | Backward compatible with installed clients | System Architecture deployment rules |
| Sheet contracts | Frozen names; explicit governed version only if ever unavoidable | Smart Import protection |
| Vector chunk schemas (future) | Chunk schema version + source doc version | Safe reindex |

**Decision:** Prefer additive evolution over renames. **Rationale:** Installed clients and historical imports. **Consequence:** Renames require migration plans and document revision.

---

# 29. Backup Strategy

| Tier | What | Backup expectation |
|---|---|---|
| Critical | Approvals, applied analysis, official records, operations/event stores | Automated backups; restore-tested |
| Important | Device cannot be solely relied on for cloud truth | Cloud backup independent of device |
| External ledger | Owner Sheets | Owner-controlled; platform must not assume it is the only copy when it is primary, nor assume platform alone when Sheets is primary — declare mode |
| Objects | Uploads/media | Bucket versioning / lifecycle |
| Ephemeral | LLM contexts, UI state | No backup requirement |

**Decision:** Backups are per durability tier, not a single undifferentiated dump. **Rationale:** Recovery prioritises approvals and ledger integrity first (System Architecture §20). **Consequence:** Restore runbooks name tier order.

---

# 30. Disaster Recovery

Aligns with System Architecture §20; data-specific rules:

| Scenario | Data response |
|---|---|
| Document store loss | Restore critical tier; rebuild analytical projections; replay idempotent events |
| Sheets outage | Hybrid fallback to document store; PDF export degraded |
| Object store loss | Portfolio truth survives if facts were normalised; evidence/media may be incomplete |
| Region loss (future) | Fail over with outbox idempotency to prevent double dispatch |
| Bad apply | Compensate via change log + official precedence; no silent history rewrite |
| Memory-only process crash | Accept loss only in beta; production gap if critical streams were memory-only |

**Decision:** Numeric RPO/RTO remain Planned until durable production posture exists. **Rationale:** System Architecture SA-02. **Consequence:** No marketing SLA until restore drills pass.

---

# 31. Data Security

Security objectives at system level: System Architecture §13. Data-plane controls:

| Control | Data requirement |
|---|---|
| Confidentiality | Audience-scoped documents; encrypted secrets; no provider credentials on device |
| Integrity | Append-only financial/approval history; provenance required |
| Availability | Device working set; degraded deterministic AI |
| Least privilege | Portal tokens and agent subsets |
| Boundary enforcement | Webhooks fail closed when secrets missing in production |

**Decision:** Security is enforced at data access paths, not only at login screens. **Rationale:** Continuous persona checks (Blueprint §15). **Consequence:** Each read model declares its audience.

---

# 32. Encryption Strategy

| Layer | Strategy | Status |
|---|---|---|
| In transit | TLS for API, portals, provider calls | Expected in production deployments |
| Secrets at rest | Platform secret store / environment — never in git or app binaries | Implemented pattern |
| Device sensitive fields | Platform secure storage for tokens/secrets where used | Partial by platform |
| Document store at rest | Managed provider encryption | Depends on hosting |
| Object store at rest | Bucket encryption | Planned with object store |
| Field-level encryption (selective) | High-sensitivity PII fields if regulatory need demands | Planned evaluation |
| Backups | Encrypted backups for critical tier | Planned with backup program |

**Decision:** Prefer platform-managed encryption plus strict secret hygiene over custom crypto in application engines. **Rationale:** Engines should not own key management complexity. **Consequence:** Custom field crypto only with explicit key lifecycle design.

**Decision:** Encrypted blobs still require access control. **Rationale:** Encryption is not authorisation. **Consequence:** Key access ≠ audience entitlement.

---

# 33. Access Control

| Subject | Data scope |
|---|---|
| Owner | Full portfolio truth and approvals |
| Property agent | Explicit subset of owner permissions |
| Tenant | Own unit, own payments, own maintenance requests |
| Technician | Assigned tickets only — never portfolio finance |
| Guard | Building follow-ups only |
| AI Employee | Read knowledge; write proposals/learning signals; never approve |
| Integration caller | Write only to its normalised event intake after auth |
| Beta/demo identities | Isolated seeded data; not production portfolios |

Portal token model: Domain Model identity conventions; Blueprint §15.

**Decision:** Access control is data-scoped, not merely route-scoped. **Rationale:** Same API shape may serve multiple personas. **Consequence:** Queries filter by entitlement before projection.

---

# 34. Privacy Classification

| Class | Examples | Handling |
|---|---|---|
| Public product | Editorial guides, non-personal UX copy | Freely cacheable |
| Operational internal | Gate metrics aggregates without PII | Restricted to owner/ops |
| PII | Tenant names, phones, portal tokens, addresses | Audience-scoped; minimised in LLM context |
| Financial sensitive | Ledger, arrears, payment proofs | Owner/agent as permitted; not technicians/guards |
| Credentials | API keys, webhook secrets | Service environment only |
| Regulated external | Official lease registry payloads | ACL + retention window |

**Decision:** Privacy class is stored or implied with data families, not inferred ad hoc in UI. **Rationale:** Prevents accidental oversharing in notifications and AI context. **Consequence:** New fields must declare a privacy class in design review.

**Decision:** LLM context is privacy-minimised and verified-only. **Rationale:** Constitution AI principles + Blueprint guardrails. **Consequence:** Raw uploads and full ledgers are out of scope for prompts.

---

# 35. Retention Policy

| Data family | Default retention intent | Disposition |
|---|---|---|
| Official records, ledger, approvals | Life of portfolio relationship + legal hold capability | Archive; exceptional delete under governance |
| Applied analysis + change logs | Long-lived for provenance | Archive superseded snapshots |
| Knowledge snapshots | Current + prior for compare; older summarise | Compact |
| SmartEvent raw payloads | Audit window | Summarise; drop raw |
| Portal media | Tied to ticket/entity life | Delete with entity policy |
| LLM logs | Short | Purge aggressively |
| Memory-only beta data | Process life | Accept loss |

**Decision:** Retention favours reconstructability of decisions and money. **Rationale:** Property Employee learning and dispute readiness. **Consequence:** Storage cost is managed by summarising raw/vendor layers first, not by deleting approval history.

Exact statutory periods are **Planned** per jurisdiction and must be added without weakening Executive Report capability.

---

# 36. Data Governance

## 36.1 Governance principles

1. `docs/` remains architectural SSOT (Architecture Governance §2).
2. Entity renames require Domain Model revision.
3. Store ownership changes require this document’s revision.
4. Smart Import and Sheets freezes require explicit governed exceptions.
5. Gaps are recorded in §38; silence is invalid.
6. Operational notes (`HANDOFF.md`, `backend/docs/`) cannot override this document.

## 36.2 Change control triggers

| Change | Required updates |
|---|---|
| New database / object store / vector store | This document §§12–16 + System Architecture if topology shifts |
| New external data source | This document §10 + Blueprint integration contract |
| New master entity | Domain Model + this document §4 |
| Retention / privacy regulation change | §§34–35 |
| Backup/DR numeric SLO | §§29–30 + System Architecture |

## 36.3 Stewardship roles (logical)

| Role | Accountability |
|---|---|
| Product owner / architect | Approves document versions |
| Context steward | Quality of data in a bounded context |
| Integration steward | ACL correctness and secret hygiene |
| Intelligence steward | Knowledge/memory purity (no numeric invention) |

---

# 37. Future Data Evolution

| Horizon | Data outcome | Dependencies |
|---|---|---|
| Stabilize | All production-critical streams durable; fail-closed secrets; no memory-only approvals/events | System Architecture Phase A |
| Unify | Single event envelope store + outbox documents | Blueprint §12.4 |
| Enrich | Object store for uploads/media; service report renderer fallback | Blueprint §19 |
| Compound | Longitudinal knowledge + preference memory + optional vectors for retrieval | Engine Vision learning layer |
| Distribute | Worker-owned job data; multi-instance safe writes; optional analytical warehouse as projection | System Architecture cloud phases |
| Multi-agent | Shared memory views per specialist; still one SSOT | Blueprint §17 |

**Decision:** Evolution is additive and gated by prerequisites. **Rationale:** Incremental change over rewrites (Blueprint §2.10). **Consequence:** Skipping durability to chase vectors or warehouses is rejected.

---

# 38. Architecture gaps

| ID | Gap | Impact | Direction | Status |
|---|---|---|---|---|
| DA-01 | Memory-only persistence for some event/approval paths in degraded setups | History loss on restart | Require durable document store for production-critical streams | Open (aligns Blueprint §19) |
| DA-02 | No formal numeric RPO/RTO for data tiers | DR unproven | Define after backup drills | Open |
| DA-03 | Object storage not yet a first-class durable plane for all uploads/media | Evidence loss risk; uneven media life | Introduce bucket + pointer model §14 | Open |
| DA-04 | Longitudinal knowledge incomplete | Understanding resets across imports | Cross-batch memory before multi-agent Phase Four | Open |
| DA-05 | Preference / client-profile learning store underspecified in runtime | Learning layer cannot mature | Specify schema ownership under §15 | Open |
| DA-06 | Service-side report document store/renderer absent | PDF depends on Sheets | Fallback renderer + object placement | Open |
| DA-07 | Unified event store not implemented | Per-integration drift | Envelope-first migration | Open |
| DA-08 | Vector database not selected | Unclear retrieval path for notes/guides | Choose only under §16 constraints | Open |
| DA-09 | Field-level privacy tags not universal | Oversharing risk in new fields | Mandatory privacy class in design reviews §34 | Open |
| DA-10 | Access audit for portal actors incomplete as a durable product stream | Weak forensic trail | Append-only access-significant log §19 | Open |
| DA-11 | Jurisdictional retention schedules unspecified | Legal retention ambiguity | Add jurisdiction table to §35 without cutting report history | Open |
| DA-12 | `SYSTEM_ARCHITECTURE.md` cross-link lag while that document was on a parallel track | Temporary index/companion lag | Reconciled on rebase onto `main` after PR #38 merge | Closed |

Gaps already listed in Blueprint §19 or Governance §8 are not forked here; DA-* items deepen data-plane concerns or track dependence.

---

# 39. How implementers must use this document

1. What an entity means → Domain Model.
2. Whether a pipeline stage or gate may change → Blueprint.
3. Whether a store, sync path, retention rule, or privacy class may change → **this document**.
4. How stores sit in the running system topology → System Architecture.
5. Whether the change serves the Property Employee → Constitution.
6. Document process / naming → Architecture Governance.
7. Discovered data contradiction → add a DA-* gap; do not silently pick a store.

---

# 40. Document status

*Document Status:* Official Data Architecture Specification

*Version:* 1.0

*Class:* Supporting architecture (core enterprise data) under `docs/`

*Project:* Smart Property Platform (SPP)

*Pillars:* `docs/SPP_CONSTITUTION.md`, `docs/DOMAIN_MODEL.md`, `docs/SPP_BLUEPRINT.md`

*Sibling enterprise documents:* `docs/SYSTEM_ARCHITECTURE.md`, `docs/DECISION_ENGINE.md`, `docs/OPERATION_CENTER.md`, `docs/KNOWLEDGE_BASE.md`

*Governance / index:* `docs/ARCHITECTURE_GOVERNANCE.md`, `docs/README.md`

*Change policy:* Data classes, ownership, store planes, retention, privacy classification, sync conflict rules, and DA-* gaps in this document are normative for data-plane decisions. Entity meaning remains Domain Model authority. Gate semantics, Smart Import stages, and prepare-not-send remain Blueprint authority. Topology/HA/DR numeric SLOs remain coordinated with System Architecture.
