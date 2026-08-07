# SPP Knowledge Base Architecture v1.0

> Official Knowledge Base architecture specification for the Smart Property Platform (SPP).
> This is a core enterprise architecture document. It defines the institutional memory and trusted knowledge layer of the platform — not how graphs, indexes, or embeddings are coded.
> Document process and SSOT rules: `docs/ARCHITECTURE_GOVERNANCE.md`. Index: `docs/README.md`.

---

# 0. Document authority and boundaries

## 0.1 Role in the document set

| Document | Owns | This document must |
|---|---|---|
| `docs/SPP_CONSTITUTION.md` | Product identity; Property Knowledge list (§9); data lifecycle (§8); AI principles | Obey; never redefine identity |
| `docs/DOMAIN_MODEL.md` | Meaning of `KnowledgeBase` and related entities | Use names; not restate attribute catalogs |
| `docs/SPP_BLUEPRINT.md` | Knowledge Graph layers, query patterns, gate coupling | Link structural rules; not copy layer tables |
| `docs/SYSTEM_ARCHITECTURE.md` | Enterprise KB interaction matrix and placement | Align system composition; deepen knowledge semantics here |
| `docs/DATA_ARCHITECTURE.md` | Store planes, AI memory storage, retention, vectors as retrieval aids | Align persistence; not redefine store technology choices |
| `docs/DECISION_ENGINE.md` | How knowledge becomes decisions | Supply evidence; never absorb authority classes |
| `docs/OPERATION_CENTER.md` | How live events enrich operational memory | Accept operational facts; not become the event bus |
| `docs/KNOWLEDGE_BASE.md` (this document) | What trusted knowledge is, how it is taxonomised, validated, versioned, governed, and consumed | Be the knowledge architecture reference for the entire platform |

**Conflict rule:** Precedence follows Architecture Governance §2.2. This document deepens Blueprint §11, Domain Model `KnowledgeBase`, System Architecture §6, and Data Architecture §7. It may not weaken gate semantics, prepare-not-send, Smart Import freezes, or Decision Engine authority classes.

## 0.2 Division of labour (normative)

| Capability | Role relative to knowledge |
|---|---|
| Knowledge Base | Holds trusted, provenance-bearing institutional memory |
| Smart Import | Primary builder of portfolio knowledge snapshots (after apply) |
| Operation Center | Enriches operational/historical knowledge from live events |
| Decision Engine | Reads knowledge to propose; writes decision memory after judgement |
| AI Property Employee / Koil | Reads bounded slices; explains; never invents facts into KB |
| Executive Report | Projects knowledge into defensible narratives and sections |
| Data stores | Persist knowledge artifacts; are not themselves the meaning of knowledge |

**Decision:** Every AI recommendation, operational workflow, executive report, and business decision must **originate from or enrich** the Knowledge Base. **Rationale:** Constitution §§7–9; Domain Model KnowledgeBase responsibility. **Consequence:** Features that invent standalone “insight stores” outside KB governance are architectural defects.

## 0.3 Status legend

Aligned with Blueprint: **Implemented** · **Partial** · **Placeholder** · **Planned**.

## 0.4 Decision record format

Every architectural choice below states **Decision**, **Rationale**, and **Consequence**. Gaps are first-class in §37 as **KB-***.

---

# 1. Knowledge Vision

The Knowledge Base is SPP’s **institutional memory**: the engine-readable, owner-auditable understanding of the portfolio that lets the Property Employee answer the same question twice from knowledge — not by re-parsing spreadsheets.

It compounds over time: imports promote verified facts; operations append what happened; decisions record judgement; learning captures owner corrections as client-profile memory — without forking private agent truths.

**Decision:** Knowledge is the centre of gravity for intelligence, reporting, and decision evidence. **Rationale:** Constitution §9 Property Knowledge; Blueprint “product is the engine.” **Consequence:** UI caches and LLM contexts are consumers, never competing memories.

---

# 2. Knowledge Philosophy

| Decision | Rationale | Consequence |
|---|---|---|
| Knowledge is derived, not hand-authored as free-text truth | Domain Model KnowledgeBase invariants | Corrections enter through entities/official flags; KB rebuilds |
| Provenance is mandatory | Blueprint §2.8; Data Architecture truth classes | Facts without asserting batch/event/owner confirmation are incomplete |
| Quality travels with facts | Gate and data-quality passengers | Consumers that strip flags are defects |
| Shared memory, private reasoning | Blueprint §17.4 | Agents may filter views; they may not fork ledgers |
| Understanding compounds | Blueprint §11.4 target | Longitudinal memory before multi-agent autonomy |
| Numbers stay deterministic | Engine Vision; Blueprint §10.4 | Language may narrate knowledge; it may not invent totals into KB |

**Philosophy statement:** Trusted knowledge makes SPP a Property Employee; unverifiable content is at best evidence, never authority.

---

# 3. Knowledge Principles

| # | Principle | Normative effect |
|---|---|---|
| K1 | One Knowledge Base per portfolio scope | No shadow insight databases |
| K2 | Provenance edge on every assertion | Node → asserting batch/event/confirmation |
| K3 | Official owner confirmation outranks derived knowledge | Conflict order respects Blueprint §14.3 |
| K4 | Gate caps confidence of knowledge-backed outputs | Blocked entities cannot drive confident decisions |
| K5 | Presentation never writes domain knowledge as free text | Screens capture intent; pipelines write |
| K6 | Read models are disposable projections of knowledge | Reports/caches rebuild; they do not originate truth |
| K7 | External knowledge enters only via ACL | Vendor shapes stop at normalisation |
| K8 | Learning updates profile memory, not one-off global hacks | Engine Vision layer 3 |
| K9 | Privacy class binds knowledge slices | Audience-scoped retrieval |
| K10 | Versioned supersession, not silent rewrite | Prior snapshots remain auditable |
| K11 | Query obligations are contractual | Blueprint §11.3 traversals must remain answerable |
| K12 | Enrichment must not reduce reporting capability | Governance §5.9 |

---

# 4. Single Source of Truth

## 4.1 Knowledge SSOT versus operational SSOT

| Kind | Authority |
|---|---|
| Architectural SSOT for knowledge meaning | This document under `docs/` |
| Operational SSOT for portfolio facts | Per Data Architecture / Blueprint §14 routing (Sheets, applied import, device) |
| Knowledge snapshot SSOT for engines | Promoted Knowledge Base current pointer for a portfolio scope |

**Decision:** The Knowledge Base is the SSOT for **engine-readable understanding**, not a second ledger that invents money. **Rationale:** Ledger truth remains finance/master stores; KB consolidates verified understanding with provenance. **Consequence:** KB must not be written back as a competing payment ledger.

## 4.2 Non-SSOT surfaces

LLM context windows, UI caches, vector retrieval hits, dashboard cards, and chat transcripts are **not** knowledge SSOT. They may only reference KB document/entity identities.

---

# 5. Knowledge Domains

Aligned to Domain Model bounded contexts, expressed as knowledge domains:

| Knowledge domain | Holds understanding about | Primary writers |
|---|---|---|
| Property Registry | Properties, buildings, units, owners | Import apply; owner corrections |
| Leasing | Tenants, contracts, occupancy movements | Import; lease events via OC |
| Finance | Collection, arrears, payments, invoices | Import; confirmed payments |
| Maintenance | Assets, tickets, technicians, costs | Import; maintenance operations |
| Utilities & IoT | Utility accounts, meters, sensor signals | Utility/sensor events (target mature) |
| Intelligence | Decisions, predictions, preferences | Decision Engine; learning layer |
| Operations | Timeline, incidents, rail outcomes | Operation Center |
| Ingestion | Import batches, gate, change logs as knowledge about trust | Smart Import |
| Editorial | Guides and curated education | Content stewardship |

**Decision:** Domains partition understanding, not separate products. **Rationale:** One Property Employee. **Consequence:** Cross-domain queries are first-class (Blueprint §11.3).

---

# 6. Knowledge Taxonomy

| Taxon | Definition | Examples |
|---|---|---|
| Fact | Verified or official assertion about a subject | Unit occupied; rent due amount from ledger |
| Observation | Operational signal not yet elevated to fact | Sensor spike; inbound message |
| Inference | Machine-derived judgement marked as inference | Likely vacancy risk |
| Assessment | Quality/gate/confidence package | Ledger reliability; gate warning |
| Memory | Cumulative longitudinal record | Asset fault counts; decision outcomes |
| Preference | Owner/client learning | Ranking habits; note-parsing corrections |
| Narrative projection | Report/brief sections derived from facts | Executive brief story (not SSOT) |
| Editorial | Curated guidance | How-to guides |

**Decision:** Taxonomy prevents treating observations and inferences as official facts. **Rationale:** Truth classes (Data Architecture §5.2). **Consequence:** Promotion rules are required before observation → fact.

---

# 7. Knowledge Graph

Structural layers, graph shape, and required traversals are normative in Blueprint §11. This document states **enterprise obligations** only.

| Obligation | Statement |
|---|---|
| Nodes | Domain Model entities (and knowledge assessment nodes) |
| Edges | Domain relationships + provenance edges |
| Provenance | Separates a knowledge graph from a cache |
| Traversals | Blueprint §11.3 remain contractual query patterns |
| Shared read | Multi-agent specialists share the same graph |
| Current pointer | One promoted “current” understanding per portfolio scope |

**Decision:** Breaking provenance edges is a rejected change. **Rationale:** System Architecture §6.3. **Consequence:** Refactors must migrate provenance, not drop it.

---

# 8. Knowledge Entities

Knowledge entities are **not a second domain model**. They are knowledge projections/annotations over Domain Model aggregates.

| Knowledge focus | Anchored domain entities (names only) | Status |
|---|---|---|
| Portfolio understanding | `KnowledgeBase` aggregate | Partial |
| Structure | `Property`, `Building`, `Unit`, `Owner` | Building still Planned as first-class |
| Parties | `Tenant`, `Technician`, portal actors | Implemented / Partial |
| Commercial | `Contract`, `Payment`, `Invoice` | Implemented / Partial |
| Work & assets | `Maintenance`, `MaintenanceTicket`, asset memory | Implemented / Partial |
| External | `LeasePlatform`, `UtilityAccount`, `Sensor`, `SmartEvent` | Partial / Placeholder |
| Judgement | `Decision`, `Prediction` | Implemented / Partial |
| Ingestion trust | `ImportJob`, gate verdict packages | Implemented |

Entity meaning remains Domain Model authority.

---

# 9. Knowledge Relationships

| Relationship class | Purpose |
|---|---|
| Structural | Property → building → unit |
| Commercial | Unit → contract → tenant → ledger |
| Asset | Unit → asset → life event / ticket |
| Operational | Subject → SmartEvent / Operation |
| Judgement | Subject → Decision / Prediction |
| Provenance | Any node → asserting batch/event/confirmation |
| Temporal | Current vs superseded knowledge snapshots |
| Preference | Owner → preference memory items |

**Decision:** Relationship integrity is required for explainability and audit. **Rationale:** Decision Engine evidence links; Executive Report traceability. **Consequence:** Orphan knowledge nodes without subject or provenance fail validation (§30).

---

# 10. Knowledge Sources

| Source class | Enters KB as | Gate/ACL |
|---|---|---|
| Applied Smart Import | Canonical + property knowledge + asset inputs | After owner apply; gate attached |
| Owner official confirmation | Fact promotion / correction | Highest precedence |
| Google Sheets hybrid reads | Context refresh into understanding when routed | Not a free-form write API into KB |
| Operation Center events | Operational/historical enrichment | After normalisation |
| Decision outcomes | Decision memory | Append-only |
| Predictions & accuracy feedback | Intelligence memory | Marked evaluative |
| Editorial curation | Static guides | Content governance |
| Learning / client profile | Preference memory | Not global rules |
| External platforms | Observations/facts in their domain only | ACL required |

**Forbidden sole sources for authoritative facts:** raw uploads in LLM prompts, vendor field dumps, UI guesses, cache hits without revalidation.

---

# 11. Internal Knowledge

Internal knowledge is produced inside SPP pipelines:

- Applied analysis artifacts and promoted property knowledge  
- Gate assessments and change logs as trust knowledge  
- Decision and preference memory  
- Operation and incident history (as knowledge enrichment)  
- Editorial guides  

**Decision:** Internal knowledge still requires provenance. **Rationale:** “We computed it” is not enough without batch/engine trail. **Consequence:** Every internal assertion cites analysis id, operation id, or editorial version.

---

# 12. External Knowledge

External knowledge originates outside SPP and becomes usable only after anti-corruption:

| External origin | Knowledge role | Status |
|---|---|---|
| Ejar / lease registry | Lease notices, expiry observations | Partial |
| Electricity / water | Bills, readings, notices | Partial |
| Green API / messaging | Inbound conversational observations; outbound delivery outcomes (target) | Partial / Placeholder |
| Home Assistant / sensors | Telemetry observations | Placeholder / demo |
| Payment providers | Settlement observations updating delivery memory (target) | Absent |
| Sheets ledger | External-but-owner ledger of record for many portfolios | Implemented when connected |

**Decision:** External knowledge never dictates internal schema names. **Rationale:** Blueprint §8; Data Architecture §10. **Consequence:** Mapping lives at adapters; KB speaks Domain Model language.

---

# 13. Property Knowledge

Understanding of a managed real-estate asset as the owner thinks about it: identity, type, location, declared vs actual structure, health indicators as projections.

**Writers:** Import apply; owner setup corrections.  
**Readers:** Reports, AI Employee, Decision Engine, OC correlation context.  
**Constraint:** Declared unit/building counts diverging from records are quality findings, not silent overwrites (Domain Model Property invariants).

---

# 14. Building Knowledge

Target understanding of physical structures inside a property: floors, shared services, common-area responsibility, building-scoped guards/sensors/utilities.

**Status:** Planned as first-class (Domain Model Building).  
**Decision:** Until Building is first-class, building-count and building-scoped actors must not invent fake building identities. **Rationale:** Identity stability. **Consequence:** KB may hold provisional building facets explicitly marked incomplete (KB-04).

---

# 15. Unit Knowledge

Per-unit occupancy, linkage to contracts/tenants, assets, utility points, and unit-level quality flags.

**Load-bearing:** Unit identity stability across imports (Domain Model §4).  
**Decision:** Unit knowledge is the primary subject key for many decisions and operations. **Rationale:** Blueprint traversals. **Consequence:** Unit identity bugs are knowledge-critical defects.

---

# 16. Tenant Knowledge

Tenant cards, contacts, reliability/collection history views, portal activation state, official-record flags.

**Constraint:** Portal tokens are access, not tenant master identity (Data Architecture §4).  
**Privacy:** PII class; audience-scoped retrieval mandatory (§34).

---

# 17. Owner Knowledge

Portfolio membership, ownership shares, preference memory, approval habits, policy constraints relevant to ranking and automation allowlists.

**Decision:** Owner preference knowledge influences ranking and interpretation profiles — not ledger arithmetic. **Rationale:** Engine Vision separation. **Consequence:** Preferences never “fix” rent due by learning.

---

# 18. Contract Knowledge

Agreement terms, renewal windows, status, linkage to unit/tenant, lifecycle movements (arrivals/departures) as knowledge about change.

**External lease assertions** enrich contract knowledge in the lease domain only; they do not blindly overwrite owner-official records.

---

# 19. Financial Knowledge

Collection, arrears, payment behaviours, invoice states, expected financial impacts as **projections from deterministic finance facts**.

**Decision:** Financial knowledge numbers originate from deterministic engines/ledger facts, never from LLM narration. **Rationale:** Blueprint §10.4; Decision Engine financial rules. **Consequence:** Narrative may cite financial knowledge only when values exist in verified context.

---

# 20. Maintenance Knowledge

Ticket histories, technician performance facets, asset memory (age, faults, cost, warranty, risk), preventive signals.

**Decision:** Replace-vs-repair style understanding requires asset memory depth when available; else confidence limited. **Rationale:** Decision Engine §21. **Consequence:** Missing asset memory is a knowledge gap, not fabricated ROI.

---

# 21. Utility Knowledge

Utility accounts, responsibility matrix, bill/reading history, anomalies, prepared payment memory (unsent vs settled).

Status follows Blueprint integration inventory (Partial inbound; payment rail absent).

---

# 22. Sensor Knowledge

Device registry facets, reading streams, thresholds, staleness, derived anomaly observations.

**Decision:** Demo readings are not production knowledge authority. **Rationale:** Blueprint sensor status. **Consequence:** Sensor knowledge marked demonstration until intake + ACL mature (KB-05).

---

# 23. Smart Import Knowledge

Knowledge about trust of ingestion: classification confidence, gate verdicts, change logs, batch provenance, churn snapshots.

**Decision:** Import knowledge is first-class because it explains why portfolio understanding is reliable or not. **Rationale:** Gate reapplied at read time. **Consequence:** Consumers must read gate/quality with facts.

Smart Import behavioural freezes remain Governance/Blueprint — this section does not alter mapping.

---

# 24. Executive Report Knowledge

Report/brief sections are **projections** from property knowledge, reasoning, and gate — not a separate truth store.

**Decision:** Executive Report knowledge must remain rebuildable from KB + engines. **Rationale:** Constitution §12; Data Architecture analytical rules. **Consequence:** Storing only a PDF without batch/knowledge linkage is insufficient institutional memory.

---

# 25. Decision Knowledge

Decision memory: proposed, approved, prepared, dismissed, outcomes; evidence links; risk/confidence as recorded with decisions.

Owned in judgement semantics by Decision Engine; **stored/retained** under Data Architecture; **meaning in KB** is longitudinal institutional memory of judgement.

**Decision:** Decision knowledge is append-oriented. **Rationale:** Learning and disputes. **Consequence:** Overwriting approval history is forbidden.

---

# 26. Operational Knowledge

Timeline, incident bags, rail health history, notification outcomes, pending-action resolutions — as knowledge of what the platform supervised.

Writers: Operation Center (§31 knowledge update flow there).  
**Decision:** Operational knowledge enriches; it does not replace registry/ledger SSOT. **Rationale:** OC division of labour. **Consequence:** A SmartEvent is not automatically an official rent payment fact.

---

# 27. Historical Knowledge

Superseded snapshots, prior batches, compact summaries after retention windows, longitudinal asset/decision memories.

**Decision:** History prefers reconstructability of money and judgement first. **Rationale:** Data Architecture retention. **Consequence:** Raw vendor payloads summarise earlier than approvals/knowledge snapshots.

---

# 28. AI Learning Knowledge

| Learning kind | Stores | May change | Must not change |
|---|---|---|---|
| Preference memory | Ranking/snooze/edit habits | Future ranking weights | Deterministic money rules silently |
| Client profile | Per-owner interpretation corrections | Understanding of that client’s files/notes | Global one-off hardcodes for one spreadsheet |
| Prediction accuracy | Evaluative feedback | Escalation thresholds (governed) | Invented outcomes |
| Explanation patterns | Validated phrasing preferences | Wording | Risk reclassification |

Status: Partial / Planned (Engine Vision learning layer underspecified in runtime — align DA-05 / DE-03).

---

# 29. Knowledge Lifecycle

Maps Constitution §8 onto knowledge specifically:

| Stage | Knowledge action |
|---|---|
| Import | Analysis artifacts prepared (not yet portfolio KB) |
| Validation / Normalisation | Quality + gate assessments formed |
| Storage | Apply persists batch-scoped knowledge |
| Knowledge | Snapshot built and optionally promoted to current |
| Analysis | Reasoning objects derived from knowledge |
| Decision | Evidence drawn from KB; decision memory written back |
| Execution | Delivery outcomes enrich operational knowledge |
| Learning | Preferences/profiles updated |
| Supersession | New apply retains prior snapshot for compare/audit |

**Decision:** Preview does not promote knowledge to current. **Rationale:** Owner authority before apply. **Consequence:** Preview artifacts are non-authoritative unless retained under support/privacy rules.

---

# 30. Knowledge Validation

| Check | Failure mode |
|---|---|
| Provenance present | Reject or mark untrusted |
| Subject identity resolvable | Quarantine orphan |
| Truth class respected | Block official overwrite by derived |
| Gate coherence | Reapply ceilings on read |
| Type/taxonomy legality | Observation ≠ fact without promotion |
| Privacy tags present (target) | Design review failure (KB-09) |
| Cross-batch referential integrity | Migration/repair job |

**Decision:** Validation cannot “fix” official owner values without an explicit correction path. **Rationale:** Official truth class. **Consequence:** Validators raise conflicts; they do not mutate official records.

---

# 31. Knowledge Quality

Quality is a persisted passenger: completeness, consistency, freshness, confidence, lineage, compatibility (Data Architecture §27).

**Decision:** Quality flags are mandatory for AI Employee, Decision Engine, and Executive Report consumers. **Rationale:** Confident wrong knowledge is worse than cautious knowledge. **Consequence:** Dropping flags is an architecture defect.

Benchmark/release quality remains Blueprint §16.1 — complementary, not a substitute for runtime quality passengers.

---

# 32. Knowledge Versioning

| Asset | Versioning approach |
|---|---|
| Batch knowledge snapshots | New batch supersedes; prior retained |
| Current pointer | Explicit promotion |
| Gate packages | Versioned with analysis; reapplied on read |
| Asset/decision memory | Cumulative append |
| Editorial | Content version ids |
| Preference/profile | Append with effective time |
| Vector chunks (future) | Chunk schema + source doc version (Data Architecture §16) |

**Decision:** Prefer additive supersession over destructive edits. **Rationale:** Audit and compare-statement queries. **Consequence:** “Edit in place” of promoted knowledge is forbidden without a compensating record.

---

# 33. Knowledge Governance

| Rule | Effect |
|---|---|
| This document is knowledge-capability SSOT under `docs/` | Implementations conform or record KB-* gaps |
| Entity meaning changes | Domain Model revision |
| Graph layer/query contract changes | Blueprint §11 revision |
| Store/retention/vector changes | Data Architecture revision |
| New knowledge domain | Update §§5–6 here + privacy review |
| Smart Import / Sheets freeze | No mapping renames via KB convenience |
| Reporting capability | Must not shrink |
| Multi-agent memory | Shared KB only |

Change control also follows Architecture Governance §7.

---

# 34. Knowledge Security

| Control | Knowledge requirement |
|---|---|
| Audience isolation | Retrieval filtered by entitlement |
| PII minimisation | Especially tenant knowledge in LLM slices |
| No raw uploads in language context | Verified knowledge only |
| Secrets excluded | Never store provider credentials in KB |
| Portal scope | Technicians/guards never receive portfolio finance knowledge |
| Audit | Access-significant retrieval for sensitive slices (target hardening) |

Aligns System Architecture §13 and Data Architecture §§31–34.

---

# 35. Knowledge Synchronization

| Sync path | Behaviour |
|---|---|
| Apply → KB | Build/promote snapshot; invalidate projections |
| Sheets hybrid → context | Refresh understanding per routing mode; no inventing facts on miss |
| Device ↔ cloud | Eventual reconciliation; device working truth remains useful |
| OC events → KB enrichment | Append operational history idempotently |
| Decision outcomes → decision memory | Append |
| Vector index ↔ documents (future) | Reindex on supersession; tombstone on revoke |
| Multi-agent readers | Same current pointer; no private sync forks |

**Decision:** Sync is merge/idempotent enrichment, not portfolio wipe. **Rationale:** Import merge philosophy. **Consequence:** Last-write-wins on entire KB documents is forbidden for master-derived knowledge.

---

# 36. Future Knowledge Evolution

| Horizon | Outcome |
|---|---|
| Stabilize | Provenance universal; durable enrichment streams |
| Longitudinal | Cross-batch compounding memory + compare queries |
| Learning | Preference/client-profile runtime maturity |
| Retrieval | Optional vectors for notes/guides under Data Architecture §16 |
| Building-first-class | Promote Building knowledge out of provisional facets |
| IoT/utilities depth | Sensor/utility knowledge production-grade |
| Multi-agent | Shared KB views per specialist; still one SSOT |
| Evaluative loop | Prediction accuracy and decision outcome memory closed-loop |

Longitudinal memory remains a prerequisite before multi-agent Phase Four (System Architecture §6.4; Blueprint §17.5).

---

# 37. Architectural Gaps

| ID | Gap | Impact | Direction | Status |
|---|---|---|---|---|
| KB-01 | Longitudinal cross-batch memory incomplete | Understanding resets each import | Blueprint §11.4; Data Architecture DA-04 | Open |
| KB-02 | Preference / client-profile learning store underspecified | Weak AI learning knowledge | Engine Vision layer 3; DA-05; DE-03 | Open |
| KB-03 | Decision outcome feedback into KB incomplete | Decision knowledge lacks closed loop | Decision Engine DE-02 | Open |
| KB-04 | Building knowledge not first-class | Multi-building portfolios flattened | Domain Model Building promotion | Open |
| KB-05 | Sensor knowledge production authority absent | Preventive knowledge unreliable | OC sensor intake + ACL | Open |
| KB-06 | Vector retrieval not selected | Notes/guides retrieval path unclear | Data Architecture §16 / DA-08 under KB constraints | Open |
| KB-07 | Unified operational enrichment into KB fragmented by per-integration stores | Uneven operational knowledge | OC envelope migration | Open |
| KB-08 | Privacy tags not universal on knowledge fields | Oversharing risk in retrieval | Data Architecture DA-09 + §34 here | Open |
| KB-09 | Knowledge access audit sparse | Weak forensics on sensitive reads | Append-only access-significant log | Open |
| KB-10 | Executive report projection linkage sometimes PDF-only when Sheets-dependent | Institutional memory gap if link dies | Service renderer + object retention (Blueprint §19) | Open |
| KB-11 | Taxonomy promotion rules (observation → fact) not fully codified | Risk of treating signals as official | Codify promotion policy in §6/§30 | Open |
| KB-12 | Multi-agent shared-view filters not runtime-specified | Future fork risk | Define view filters before Phase Two specialists | Open |

Gaps owned elsewhere are linked, not forked.

---

# 38. Interaction map (required parties)

| Party / system | Knowledge Base interaction |
|---|---|
| AI Property Employee | Reads intent-scoped verified slices; explains; must not write invented facts |
| Decision Engine | Reads facts/assessments/memory; writes decision memory; gate respects KB quality |
| Operation Center | Writes operational/historical enrichment after ACL; reads subject context |
| Smart Import | Primary builder of batch knowledge; apply promotes; gate attaches trust knowledge |
| Executive Reports | Rebuildable projections from KB + engines; decision ids remain traceable |
| Google Sheets | Ledger/PDF peer may feed or reflect portfolio truth per routing; not a shadow KB |
| Databases / document store | Persist knowledge snapshots and memories (Data Architecture) |
| Vector database (future) | Retrieval hints to verified documents only — never numeric authority |
| Home Assistant | Future sensor observations into sensor knowledge |
| Ejar | Lease-domain external knowledge via SmartEvents |
| Green API | Inbound message observations; outbound delivery outcomes into operational knowledge (target) |
| Electricity / Water | Utility knowledge via normalised events |
| Payment systems | Settlement observations closing payment delivery memory (target) |
| Mobile app / Web dashboard | Presentation of knowledge projections; capture corrections as entity updates, not free-text KB edits |

---

# 39. How implementers must use this document

1. What an entity means → Domain Model.  
2. Graph layers / query patterns → Blueprint §11.  
3. Where knowledge artifacts are stored/retained/encrypted → Data Architecture.  
4. How knowledge becomes a recommendation → Decision Engine.  
5. How live events enrich memory → Operation Center.  
6. What trusted knowledge is, how it is taxonomised, validated, versioned, governed → **this document**.  
7. System placement → System Architecture §6.  
8. New gap → add **KB-***; do not invent a second institutional memory.

---

# 40. Document status

*Document Status:* Official Knowledge Base Architecture Specification

*Version:* 1.0

*Class:* Supporting architecture (core Knowledge Base) under `docs/`

*Project:* Smart Property Platform (SPP)

*Pillars:* `docs/SPP_CONSTITUTION.md`, `docs/DOMAIN_MODEL.md`, `docs/SPP_BLUEPRINT.md`

*Sibling enterprise documents:* `docs/SYSTEM_ARCHITECTURE.md`, `docs/DATA_ARCHITECTURE.md`, `docs/DECISION_ENGINE.md`, `docs/OPERATION_CENTER.md`, `docs/AI_PROPERTY_EMPLOYEE.md`

*Governance / index:* `docs/ARCHITECTURE_GOVERNANCE.md`, `docs/README.md`

*Change policy:* Knowledge taxonomy, provenance obligations, domain coverage, validation/quality/versioning/governance rules, and KB-* gaps in this document are normative for knowledge-capability work. Entity meaning remains Domain Model authority. Graph layer tables and gate semantics remain Blueprint authority. Store/vector technology choices remain Data Architecture authority. Decision authority classes remain Decision Engine authority. Real-time enrichment orchestration remains Operation Center authority.
