# SPP Blueprint v1.0

> Official architecture blueprint of the Smart Property Platform (SPP).
> Independent companion to `docs/SPP_CONSTITUTION.md` and `docs/DOMAIN_MODEL.md`.
> This is an architecture document. It describes structure, boundaries and flow — not implementation.
> Document process and SSOT rules: `docs/ARCHITECTURE_GOVERNANCE.md`. Index: `docs/README.md`.

---

# 1. Purpose and document boundaries

SPP is governed by three independent documents. None of them replaces or absorbs another.

| Document | Question it answers | Authority |
|---|---|---|
| `docs/SPP_CONSTITUTION.md` | **Why** SPP exists and what it must never become | Product law |
| `docs/DOMAIN_MODEL.md` | **What** the system is made of: entities, relationships, lifecycles | Ubiquitous language |
| `docs/SPP_BLUEPRINT.md` (this document) | **How** the system is built: layers, pipelines, engines, integrations | Structural authority |

A change that contradicts the Constitution is rejected. A change that renames or redefines an entity requires a Domain Model revision. A change that moves a responsibility across an architectural boundary requires a Blueprint revision.

**Status legend used throughout** — **Implemented**: working end to end today. **Partial**: exists for some paths or as an inbound surface only. **Placeholder**: user interface or configuration exists with nothing behind it. **Planned**: designed here, not built.

---

# 2. Architecture principles

1. **The product is the engine.** Files are input, screens are surfaces. Understanding, decision quality and explanation are the product.
2. **Deterministic and AI layers stay separated.** Arithmetic, dates, arrears and contract logic are deterministic. Language, structure discovery and interpretation are AI. Neither is allowed to do the other's job.
3. **The engine is generic.** A fix that only works for one owner's file shape is an engineering failure, not a feature. Fixes become general rules or per-client learning.
4. **Owner authority is architectural, not procedural.** Approval is a modeled state with a persisted record; no code path bypasses it.
5. **Prepare, do not send.** The platform composes messages and payment instructions; dispatch happens only after an approval record exists, and delivery state is always distinguishable from preparation state.
6. **The device holds working truth.** The application remains useful without connectivity; the portfolio, tasks and operations live on the device and reconcile with the cloud.
7. **Foreign systems never enter raw.** Every external payload crosses an anti-corruption boundary and becomes SPP vocabulary before any engine sees it.
8. **Everything carries provenance and confidence.** Where a fact came from, and how much it can be trusted, travel with the fact into every consumer.
9. **Imports merge, never replace.** Owner-confirmed corrections outrank machine-derived values permanently.
10. **Incremental change over rewrites.** Backward compatibility with historical imports, Google Sheets structure and installed applications is a hard constraint.

---

# 3. System context

## 3.1 Actors

| Actor | Interface | Authority |
|---|---|---|
| Owner | Mobile application, web application | Full: approves every decision, corrects official records |
| Property agent | Application with a scoped permission set | Delegated subset of owner authority |
| Tenant | HTTPS portal link, no installation required | Own unit, own payments, own maintenance requests |
| Technician | HTTPS portal link | Assigned tickets only |
| Guard | HTTPS portal link | Building follow-ups only |
| AI Employee | Runs inside the platform | Proposes; never approves |

## 3.2 External systems

| System | Direction | Role | Status |
|---|---|---|---|
| Google Sheets via Apps Script | Bidirectional | Portfolio ledger of record for many owners, import pipeline, owner report PDF | Implemented |
| Lease registry (Ejar) | Inbound webhooks | Official contract notices and expiry warnings | Partial: inbound only |
| Electricity provider | Inbound webhooks | Bills, notices, meter readings | Partial: inbound only |
| Water provider | Inbound webhooks | Bills, notices, meter readings | Partial: inbound only |
| Messaging channel | Inbound webhooks | Routed inbound messages from tenants and parties | Partial: memory-only persistence |
| Intelligence channel | Inbound webhooks | External analytical signals | Partial |
| Home Assistant | Planned | Building and unit telemetry | Placeholder: setup screen only |
| Green API / WhatsApp | Outbound | Message delivery rail | Placeholder: client deep links only, no server sending |
| Payment rails | Outbound | Utility and rent settlement | Absent by design until owner-approved |
| Maps | Outbound | Location services | Absent |
| Large language model provider | Outbound | Controlled interpretation of verified results | Implemented, disabled by default |

---

# 4. Runtime topology

## 4.1 Containers

| Container | Responsibility | Technology | Hosting | Release trigger |
|---|---|---|---|---|
| Mobile and web application | All owner and portal experiences, on-device portfolio, AI employee desk | Expo / React Native / React Native Web | Installed Android package plus over-the-air JavaScript channel | Push to the main branch touching the frontend publishes an over-the-air update on the beta channel |
| API service | Analysis pipelines, decision engines, integrations, read models | FastAPI on a single process | Managed cloud web service | Blueprint deploys from the master branch |
| Sheets engine | Owner ledger, import pipeline mirror, report PDF generation | Google Apps Script web application | Google infrastructure | Deployed independently by the script owner |
| Document store | Applied analysis state, integration events, approvals, chat history | MongoDB, optional | Managed or absent | Falls back to in-process memory |
| Portal bridge | HTTPS page that makes portal links openable from any messenger | Static HTML published from the repository documentation folder | GitHub Pages, with an API route as fallback | Push to the main branch touching documentation |
| Distribution | Android package for beta installs | GitHub Releases | GitHub | Manual or configuration-triggered workflow |
| Quality gate | Benchmark regression and tests | GitHub Actions | GitHub | Push or pull request to the master branch touching backend or benchmarks |

## 4.2 Client-to-service contract

- The application resolves its API base from a public environment variable, defaulting to the production service, and rewrites local or LAN addresses to the production host so that shipped builds can never point at a developer machine.
- All API paths are composed as base plus the API prefix; a trailing slash on the base is stripped to avoid double-slash routes.
- Every call is individually fault-tolerant. There is no global connectivity layer; failure degrades one feature, never the session.

## 4.3 Known topology risks

| Risk | Description | Mitigation direction |
|---|---|---|
| Branch split | The API deploys from master while frontend automation runs on main | Unify release branches or document the promotion path explicitly |
| Single process | One web process, free tier, cold starts, no worker tier | Introduce a worker tier before any scheduled or queued work is added |
| Memory-only persistence for some events | Platform inbox events do not survive a restart | Promote to the document store with the same shape as other event streams |
| Open webhooks when secrets are unset | Verification accepts any request when the expected secret is empty | Require secrets in production configuration and fail closed |

---

# 5. Clean Architecture layers

## 5.1 The dependency rule

Dependencies point inward only. Presentation depends on Application, Application depends on Domain, Infrastructure depends on Domain. Domain depends on nothing. A domain rule that cannot be evaluated without a network call or a storage key is misplaced.

## 5.2 Layer map — application tier

| Layer | Contains | Examples of responsibility |
|---|---|---|
| Presentation | Route screens, components, portal pages, theming, localisation surfaces | Render state, capture intent, never decide eligibility or money |
| Application | Hooks, stores, workflow engines, synchronisation, orchestration | Sequence operations, coordinate aggregates, emit domain events |
| Domain | Entity types, state machines, invariants, derivation rules | Decide what a status means and which transitions are legal |
| Infrastructure | API clients, device storage adapters, secure storage, portal bridge resolution, update delivery | Move bytes, persist, resolve hosts |

## 5.3 Layer map — service tier

| Layer | Contains | Examples of responsibility |
|---|---|---|
| Interface | HTTP routers and request models | Validate transport shape, nothing more |
| Application | Pipeline orchestration, engine composition, approval flows | Run analysis end to end, assemble read models |
| Domain | Normalisation rules, decision unification, consistency gate, lifecycle rules | Own truth and judgement |
| Infrastructure | Sheets client, webhook clients, document store access, language model provider | Anti-corruption translation and persistence |

## 5.4 Boundary violations to reject in review

- A screen computing arrears, occupancy or eligibility instead of reading a derived value.
- A store writing vendor payload fields directly into a domain record.
- A router containing business rules rather than delegating to an engine.
- An engine reading environment variables or storage keys directly.
- A read model being treated as a source of truth and written back.

---

# 6. AI Employee architecture

The AI Employee is the product's centre of gravity: a virtual property employee that reads the portfolio, proposes work, explains itself and learns from the owner's judgement. It is composed of six cooperating parts.

## 6.1 Components

| Component | Responsibility | Runs where |
|---|---|---|
| Context builder | Assemble a bounded snapshot of the portfolio: properties, tenants, contracts, decisions, reports | Service tier |
| Intent classifier | Classify what the owner is asking about: property, tenant, contract, finance, maintenance, decision, general | Service tier |
| Memory retriever | Select only the facts relevant to the classified intent, keeping context small and auditable | Service tier |
| Task generator and ranker | Produce the working agenda: arrears collection, renewals, vacancies, maintenance follow-up, portal sharing, data gaps, daily brief, escalation | Application tier, on device |
| Enrichment | Attach external context from lease, utility and messaging events to the relevant tasks | Application tier |
| Controlled interpreter | Turn verified engine results into owner-language explanation, under strict validation | Service tier, disabled by default |

## 6.2 Reasoning loop

Portfolio change, applied import, or inbound event triggers recomputation. The task list is rebuilt, previously settled items are preserved, snoozed items reopen when due, and the agenda is ranked by urgency and impact. Each surfaced item carries the reason and the evidence behind it. Owner action — accept, edit, dismiss, snooze — is recorded and feeds ranking preferences for the next cycle.

## 6.3 Controlled interpretation guardrails

The language layer is an explainer, never a calculator. Its context is built exclusively from persisted, already-verified analysis state; it never reads raw uploaded files.

| Guardrail | Enforcement |
|---|---|
| No invented numbers | Financial values in the answer must exist in the supplied context |
| No invented entities | Tenant names and unit labels must exist in the supplied context |
| No invented decisions | Cited decision identifiers must exist in the unified decision list |
| No claimed execution | Language asserting that an action was performed is rejected |
| Respect the gate | When the consistency gate blocks, definitive claims are rejected and review language is required |
| Non-empty, attributable answers | Responses carry the context sections they drew from |

Failure of any rule replaces the generated answer with a deterministic fallback built only from trusted context. When the language layer is disabled, missing a key, or failing, the system still answers — deterministically, from engine output.

## 6.4 Degraded and offline behaviour

A local reasoning fallback answers common owner questions from on-device portfolio state when the service is unreachable, and integration synchronisation failures are swallowed silently rather than blocking the desk. The employee is never unavailable; it is only less informed.

---

# 7. Operations Center

Constitution §10 requires that every external event pass through the operation engine before reaching users. The Operations Center is that engine.

## 7.1 Processing stages

| Stage | Responsibility | Output |
|---|---|---|
| Intake | Receive a webhook or a client-initiated pull; authenticate the source | Raw payload accepted or rejected |
| Normalisation | Translate the vendor payload into SPP vocabulary at the anti-corruption boundary | Normalised event with subject references, priority, audiences, bilingual summary |
| Deduplication | Reject or overwrite by source identity so redelivery is harmless | One event per real-world occurrence |
| Interpretation | Classify urgency, resolve the affected unit, tenant or contract, and decide whether action is warranted | Tasks and decision candidates |
| Routing | Determine which audiences the event concerns | Audience-scoped notification drafts |
| Approval | Queue a pending action when the response requires the owner | Pending action with kind, label and payload |
| Preparation | Compose the exact message or payment instruction on approval | Approval record with prepared content and unsent delivery state |
| Logging | Append an immutable operation entry | Auditable operations timeline |

## 7.2 Pending action kinds

Approvals are modeled explicitly rather than implied by a button: message dispatch, renewal, technician assignment, owner alert, lease notice, utility payment, platform message, and tenant payment confirmation. Each pending action must be resolvable by exactly one owner decision, and its resolution appends an operation entry.

## 7.3 Current versus target shape

Today each integration keeps its own normalised event stream, its own deduplication set, and its own approval endpoint, and the device pulls them when the employee desk gains focus. The target is one intake path and one event model behind a shared bus (section 12), with the same approval semantics unchanged.

---

# 8. Integrations architecture

## 8.1 The anti-corruption pattern

Every integration is built from the same five parts: a client that knows the vendor protocol, an event normaliser that produces SPP vocabulary, a store with identity-based deduplication, a read surface for the application, and an approval endpoint that prepares — never executes — the response. No vendor field name is allowed past the normaliser.

## 8.2 Integration inventory

| Integration | Direction | Transport | Authentication | Status |
|---|---|---|---|---|
| Google Sheets via Apps Script | Bidirectional | Signed action calls and lightweight read endpoints with short-lived caching | Shared API key parameter | Implemented |
| Lease registry | Inbound | Webhook | Shared secret header | Partial: notices and expiry only; no outbound registration |
| Electricity | Inbound | Webhook per utility kind | Shared secret header, per kind or shared | Partial: bills and notices; payment prepared only |
| Water | Inbound | Webhook per utility kind | Shared secret header | Partial |
| Messaging channel | Inbound | Webhook per channel | Shared secret header | Partial: in-memory persistence |
| Intelligence channel | Inbound | Webhook per channel | Shared secret header | Partial |
| Home Assistant | Planned inbound | Not built | Not built | Placeholder: configuration screen writes only to device state |
| Green API and messaging providers | Planned outbound | Not built | Not built | Placeholder: the application opens native messenger deep links instead |
| Payment rails | Planned outbound | Not built | Not built | Absent: approvals stop at prepared instructions |
| Maps | Planned | Not built | Not built | Absent |
| Sensor and IoT ingestion | Planned inbound | Not built | Not built | Absent: sensor readings are demonstration data |
| Language model provider | Outbound | Provider API | API key | Implemented, disabled by default |

## 8.3 Contract for adding an integration

1. Define the SPP-side entity or event it feeds; never introduce a vendor-shaped record.
2. Authenticate at the boundary and fail closed when the expected secret is missing.
3. Deduplicate by source identity; redelivery must be a no-op.
4. Produce bilingual, owner-readable summaries at normalisation time, not at render time.
5. Declare the audiences the event concerns and route accordingly.
6. Prepare responses; require an approval record before any dispatch.
7. Ship a status surface so the owner can see whether the connection is healthy, degraded or disconnected.

## 8.4 Configuration boundary

Connection secrets live in the service environment, never in the application. The in-app service setup screens capture owner intent and local configuration state; they are deliberately not a credential channel. Any future self-service connection must add a verification endpoint rather than trusting local state.

---

# 9. Smart Import pipeline

Smart Import is a protected subsystem. Its behaviour may not be modified unless the change explicitly targets it, and any change must preserve CSV, Excel and Google Sheets compatibility, historical imports and column and sheet naming stability.

## 9.1 Dual engine

Two engines implement the same contract and produce the same response shape: the Sheets pipeline, preferred when the Sheets engine is configured, and the service-side pipeline used otherwise. The response shape, the identifiers and the apply semantics are identical from the application's point of view, which is what makes the fallback safe.

## 9.2 Stages

| Stage | Input | Responsibility | Output |
|---|---|---|---|
| 1. Intake | Uploaded files with names and content snippets | Classify document type, month, year and unit with a confidence score | Classified file set |
| 2. Parsing | Classified files | Extract rows, amounts, dates and payment states without interpretation | Structured rows |
| 3. Deep analysis | Structured rows plus live portfolio context | Build the monthly index, ledger, arrears, maintenance aggregate and quality log | Deep analysis snapshot |
| 4. Property knowledge | Deep analysis | Consolidate verified facts: units, collection, arrears, lifecycle, contracts, quality, tenant cards | Knowledge object |
| 5. Understanding | Files and knowledge | Explain what the files are, how they relate, and what is ambiguous | Understanding object |
| 6. Reasoning | Knowledge | Produce the brief, what happened, why, risks and recommendations | Reasoning object |
| 7. Consistency gate | Deep analysis and knowledge | Detect contradictions: paid marked overdue, ledger versus board mismatch, collected exceeding due, departed yet active, duplicate payments, filename-only lifecycle, low classification confidence | Gate verdict with conflicts |
| 8. Gate normalisation | Raw gate verdict | Convert to the authoritative status, cap confidence, mark affected outputs and blocked entities | Normalised gate |
| 9. Lifecycle and decisions | Normalised analysis | Derive departures, arrivals and tenant changes; generate lifecycle decisions; unify all decision sources; apply the gate | Ranked, gated decision list |
| 10. Canonical projection | Analysis artifacts | Produce the canonical portfolio, asset memory and executive intelligence | Knowledge graph inputs |
| 11. Preview | Full analysis | Show the owner what will change before anything is written | Nothing persisted |
| 12. Apply | Owner confirmation | Merge into existing identities, write the change log, persist analysis state, record the batch | Committed import |

## 9.3 Apply semantics

Apply merges by stable identity. Properties reuse the primary portfolio identity, contracts derive identity from the unit, ledger rows derive identity from tenant and month. Records marked as owner-confirmed official are never overwritten by a statement. Every difference is written to the change log as added, updated or conflicting, with a note explaining amount drift. Occupancy churn is captured as a movement snapshot for reporting.

## 9.4 Protections

- Never invent a date, a contract number or an identifier that the source did not contain.
- A blocked gate verdict prevents execution of decisions derived from that batch.
- Applied analysis state is retained per batch so that any later fact can be traced back to the import that produced it.

---

# 10. Executive Report pipeline

Executive reporting is a core capability under Constitution §12 and may never be reduced.

## 10.1 Two products, one source

| Product | Purpose | Composition |
|---|---|---|
| Executive report | The structured document: sectioned facts with labels, values and evidence | Files, unit summary, months, departures, arrivals, arrears, revenue, expenses, contracts, quality, portfolio, plus understanding and reasoning sections |
| Executive brief | The narrative the owner reads first | Property status, story, what happened, what changed, who left, who entered, biggest problem, top decision, today's actions, arrears, critical cases, key numbers, confidence and review flags |

Both are computed from property knowledge and reasoning, never from free-form generated text, which is what makes the numbers defensible.

## 10.2 Live read models

Beyond the import-time report, four read surfaces serve the running portfolio: the morning briefing, the executive brain with its ranked agenda and opportunities, per-screen verdicts, and report cards. All four are rewritten by the gate when data confidence is capped, so a blocked batch cannot produce a confident-sounding dashboard.

## 10.3 Document generation and delivery

Portable document generation is performed by the Sheets engine against the applied batch identity; the service requests it and returns the hosted link. There is no service-side renderer, so document generation is unavailable when the Sheets engine is not configured — a deliberate trade that keeps one formatting authority.

## 10.4 Truthfulness rules

1. Report numbers come from engines, never from the language layer.
2. When the gate blocks, risks and recommendations are replaced by review items rather than softened.
3. Collection recommendations are permitted only when ledger quality supports them.
4. Confidence is capped by gate status and displayed, not hidden.
5. Decision identifiers survive gate rewriting so that every narrative statement remains traceable.

---

# 11. Knowledge Graph

## 11.1 Layers

| Layer | Content | Built from | Lifetime |
|---|---|---|---|
| Canonical portfolio | Settings, units, assets, life events, maintenance rows in one normalised shape | Import and Sheets ingest | Per applied batch |
| Property knowledge | Verified facts about units, collection, arrears, lifecycle, contracts, quality and tenant cards | Deep analysis | Per applied batch, promoted to current |
| Asset memory | Asset profiles with age, fault count, cumulative cost, life consumed, warranty window and risk level | Canonical assets and life events | Cumulative across batches |
| Decision memory | What was proposed, approved, prepared, rejected, and what followed | Approval records and operation log | Cumulative |
| Editorial knowledge | Guidance articles and guides shown to users | Curated content | Static |

## 11.2 Graph shape

Nodes are the entities of the Domain Model; edges are the relationships it defines. The load-bearing traversals are: property to building to unit; unit to contract to tenant to ledger; unit to asset to life event; and any node to the batch or event that asserted it. That last edge — provenance — is what separates a knowledge graph from a cache.

## 11.3 Query patterns the graph must serve

- Which units repeat the same fault, and is the asset still under warranty?
- Which tenants are late, for how many months, and with what confidence in the ledger?
- Which contracts expire inside the renewal window, and what did comparable units renew at?
- What changed between this statement and the previous one?
- Which facts support this decision, and which import asserted them?

## 11.4 Current versus target

Today knowledge is snapshotted per applied batch, with asset memory and executive intelligence layered on top. The target adds longitudinal memory across batches and explicit preference learning from owner behaviour, so that the platform's understanding compounds instead of resetting each import.

---

# 12. Event Bus

## 12.1 Current state

There is no message broker, queue, scheduler or background worker. Inbound events are written to per-integration stores on receipt; the application pulls them when the employee desk gains focus; deduplication is performed twice, once by source identity on the server and once by a seen-identity set on the device. This is honest about what exists: a pull-based fan-out, not a bus.

It works because event volume is low and every consequential action requires human approval anyway. It stops working as soon as scheduled work, retries or multiple consumers appear.

## 12.2 Target design

| Aspect | Target |
|---|---|
| Envelope | One event shape for all sources: identity, source, type, occurred at, received at, subject references, bilingual summary, priority, audiences, processing status, raw reference |
| Topics | Portfolio changes, financial events, maintenance events, integration events, decision events, notification events |
| Delivery | At-least-once with mandatory consumer idempotency by event identity |
| Ordering | Per subject, not global; consumers must tolerate out-of-order arrival across subjects |
| Retention | Full envelope for the audit window, then summary retained and raw payload discarded |
| Outbound | An outbox for prepared actions so that dispatch is retryable without duplicating owner approval |
| Observability | Every event traceable from intake through interpretation, approval and dispatch |

## 12.3 Consumers

The AI Employee subscribes to raise tasks, the Decision Engine to generate candidates, the Notification service to route audience messages, the Knowledge Graph to accumulate history, and the Operations log to record what happened.

## 12.4 Migration path

Introduce the unified envelope first, behind the existing integration surfaces. Then move the per-integration stores onto it without changing their read APIs. Then add the outbox for prepared actions. Only then introduce a worker tier for retries and scheduled work — which also requires resolving the single-process topology constraint in section 4.3.

---

# 13. Decision Engine

## 13.1 Pipeline

| Stage | Responsibility |
|---|---|
| Generation | Four independent sources produce candidates: import reasoning, lifecycle analysis, live portfolio state, and executive intelligence |
| Unification | Candidates describing the same real-world action are merged by deduplication key into one decision |
| Scoring | Each decision receives a priority, a score and a tier: now, today, this week, or follow-up |
| Gating | The normalised gate caps confidence and blocks decisions whose underlying data is contradictory |
| Proposal | The ranked list is presented as one agenda with reason, evidence and expected financial impact |
| Approval | The owner approves; an approval record captures the actor, the moment and the exact prepared content |
| Preparation | Messages or payment instructions are composed and held in an unsent state |
| Execution | A dispatch rail delivers the prepared action and updates delivery state |
| Learning | Approvals, edits and dismissals adjust future ranking |

## 13.2 Gate semantics

| Gate status | Meaning | Confidence ceiling | Effect on decisions |
|---|---|---|---|
| Ok | No blocking contradictions found | Full | Decisions may be approved and executed |
| Warning | Non-critical conflicts present | Reduced | Decisions proceed with visible caution and capped confidence |
| Blocked for review | Critical contradictions in the underlying data | Strongly reduced | Affected decisions cannot be executed; recommendations become review items |

Blocking is entity-aware: a conflict confined to one unit blocks decisions about that unit, while global conflicts such as classification failure or ledger mismatch block the batch. The gate verdict is persisted with the analysis and reapplied at read time to briefings, verdicts and the executive brain, so a stale confident view cannot survive.

## 13.3 Execution guarantee

Approval produces a prepared action, not a delivered one. Delivery state is explicit and starts as unsent; utility payments are marked as awaiting a payment rail that does not yet exist. This is a deliberate architectural boundary: the platform cannot spend money or speak to a tenant without a dispatch rail that the owner has explicitly enabled.

---

# 14. Data architecture

## 14.1 Sources of truth

| Domain | Primary source | Fallback | Notes |
|---|---|---|---|
| Portfolio structure and ledger | Owner's Sheets ledger when connected, otherwise applied import state | Document store, then in-memory | Routing is configurable per domain |
| Working portfolio on device | Device store | Rebuilt from a re-applied import | Survives offline use |
| Applied analysis state | Document store keyed by analysis identity | In-memory | Feeds all live read models |
| Integration events | Document store per stream | In-memory | One stream is memory-only today |
| Approvals and operations | Document store and device log | In-memory | Append-only |

## 14.2 Routing modes

Reads resolve per domain in one of three modes: document store only, Sheets only, or hybrid — Sheets first with an automatic fallback to the document store on failure. Beta mode overrides all of them and forces local sources, which is what makes demonstration and offline testing deterministic.

## 14.3 Conflict resolution order

1. Owner-confirmed official records.
2. Most recent applied import for derived facts.
3. External platform assertions for their own domain, such as official lease status.
4. Machine inference, always marked as inference.

## 14.4 Migration policy

Device stores are versioned by shape, not by number: readers tolerate missing fields, writers never remove a field that an older build reads, and one-shot migrations repair persisted data on startup. Sheet and column names are frozen; a rename is a breaking change to every historical import.

---

# 15. Security and access architecture

| Concern | Approach |
|---|---|
| Portal access | Opaque per-actor tokens embedded in HTTPS bridge links, revocable without deleting the person or their history |
| Role scoping | Persona and permission checks applied continuously at navigation level, not only at login |
| Delegation | Agent permissions are an explicit subset of owner authority and revocable at any time |
| Webhook authentication | Shared-secret comparison at the boundary; an unset secret currently accepts any request and must be treated as a production defect |
| Credential storage | Connection secrets live in the service environment; the application never holds provider credentials |
| Audience scoping | A notification may never carry information its audience is not entitled to see |
| Auditability | Every approval records actor, time and exact prepared content |
| Data minimisation in context | The language layer receives a bounded, capped context, never raw files |

---

# 16. Quality and release architecture

## 16.1 Quality gates

| Gate | Scope | When |
|---|---|---|
| Level one benchmark | Synthetic files through the production analysis entry point | Every backend change |
| Level two benchmark | Owner golden file set with expected metrics and required report sections | When the golden set is present |
| Level three benchmark | Client variants: messy headers, English columns, incomplete data | Every backend change |
| Engine assertions | Reasoning must be non-generic, evidence-bearing and correctly versioned; the report must contain its required sections | With every benchmark level |
| Service tests | Import, decision approval, gate and controlled interpretation contracts | Continuous integration |
| Application checks | Type checking and linting | Before merge |
| Proof artifacts | Recorded evidence that a work package behaves as specified | Per work package |

The benchmark set is a lens, not a specification: passing it proves the generic engine understood real files, and a fix that only satisfies one owner's files is treated as an engine maturity failure.

## 16.2 Release matrix

| Change type | Reaches installed applications how | New install required |
|---|---|---|
| JavaScript, screens, engines, on-device rules | Over-the-air update on the beta channel | No |
| Native configuration such as link handling, permissions, package identity | New Android package build | Yes |
| Service behaviour | Service deployment | No |
| Sheets engine behaviour | Independent script deployment | No |
| Portal bridge page | Documentation site publish | No |

Over-the-air compatibility depends on the runtime version tracking the application version: changing the application version without shipping a matching build breaks update delivery to installed applications.

---

# 17. Future multi-agent architecture

The current AI Employee is one generalist. The target is a small team of specialists under one accountable coordinator — the same operating model an owner would hire.

## 17.1 Specialist agents

| Agent | Owns | Primary inputs | Typical proposals |
|---|---|---|---|
| Collection agent | Arrears and cash recovery | Ledger, payment events, tenant reliability history | Reminder sequences, settlement plans, escalation |
| Leasing agent | Occupancy and renewals | Contracts, expiry windows, vacancy duration, market context | Renewal pricing, vacancy marketing, transfer handling |
| Maintenance agent | Asset condition and repair economics | Tickets, asset memory, warranty windows, sensor signals | Preventive work, replace versus repair, technician assignment |
| Utilities agent | Metered services and recharges | Utility events, meters, responsibility matrix | Payment preparation, responsibility transfer, consumption anomalies |
| Data quality agent | Trustworthiness of the portfolio record | Gate conflicts, import change logs, missing contacts | Corrections to request, imports to redo, gaps to fill |
| Reporting agent | Owner communication | Knowledge graph, decision memory | Executive report assembly, monthly narrative, forecast commentary |

## 17.2 Coordinator responsibilities

The coordinator owns the owner relationship and the single agenda. It receives specialist proposals, resolves overlaps into one action per real-world subject, enforces the global ranking, applies the consistency gate, and presents one prioritised list. The owner never negotiates with six agents.

## 17.3 Delegation protocol

Every delegated task carries: the subject entity, the goal, the scope of allowed actions, the evidence already gathered, the confidence required to proceed, the escalation condition, and the deadline. Every returned proposal carries: the recommendation, the reason, the evidence, the expected outcome, the risk level, and whether owner approval is mandatory.

## 17.4 Coordination rules

1. **One owner per subject.** Two agents may read the same entity; only one may propose action on it in a cycle.
2. **Shared memory, private reasoning.** All agents read the same knowledge graph; none keeps a private version of the truth.
3. **Conflicts escalate, they do not vote.** When specialists disagree, the coordinator presents the trade-off to the owner rather than silently picking a winner.
4. **Gate applies to every agent equally.** No specialist may act on data the gate has blocked.
5. **Approval remains singular and human.** Multi-agent autonomy increases the quality of proposals, never the authority to execute.
6. **Every agent is observable.** What it read, what it proposed and why must be reconstructable after the fact.

## 17.5 Rollout phases

| Phase | Capability | Prerequisite |
|---|---|---|
| One | Internal specialisation: distinct task generators behind one employee identity | Current architecture |
| Two | Explicit specialist boundaries with the coordinator merging agendas | Unified event envelope |
| Three | Independent agent execution with the outbox and retry semantics | Worker tier and event bus |
| Four | Continuous autonomous operation within owner-defined policy budgets | Dispatch rails, longitudinal memory, accuracy tracking |

---

# 18. Architecture decisions

| Decision | Rationale | Consequence |
|---|---|---|
| Dual import engine with identical contracts | Owners live in Google Sheets; the platform must work with and without it | Two implementations must be kept in shape parity, enforced by benchmarks |
| Device-first portfolio state | Property work happens on site, often without connectivity | Merge and migration logic on the device is a permanent cost |
| Prepare-not-send for all outbound actions | Trust is the product; a wrong automated message is unrecoverable | Dispatch rails are deliberately absent until explicitly enabled |
| Authoritative consistency gate over engine self-reporting | Confident wrong output is worse than cautious output | Every read model must reapply the gate |
| Language model as explainer only | Numbers must be defensible | A validation layer and deterministic fallback are mandatory |
| Unified decision list across four engines | The owner needs one agenda, not four opinions | Deduplication keys and scoring are load-bearing |
| Static HTTPS bridge for portal links | Portal recipients must not install anything | Bridge hosting must serve real HTML; content type is a functional requirement |
| Optional document store with in-memory fallback | Beta and demonstration must run with zero infrastructure | Some streams currently lose history on restart |
| `smart-employee/` is an experimental Arabic SPP surface, not a second product (Governance Option A) | Constitution allows one product law; locale and clarity experiments must not fork identity or domain language | Shared Domain Model and engines; Presentation may explore a lighter Saudi daily-use palette without amending brand law for `frontend/` |

---

# 19. Architecture gaps and roadmap

| Gap | Impact today | Required work |
|---|---|---|
| No event bus, queue or worker tier | No retries, no scheduled work, client-pull only | Unified envelope, then outbox, then worker tier |
| Outbound rails absent | Approved actions stop at prepared content | Messaging rail and payment rail behind owner-enabled policy |
| Telemetry ingestion absent | Sensor readings are demonstration data; preventive maintenance lacks signal | Device registry, ingestion endpoint, thresholds, staleness handling |
| Placeholder connection screens | Owners can configure services that are not wired | Verification endpoints or removal of the promise |
| Webhook secrets optional | Unauthenticated ingestion when misconfigured | Fail closed in production configuration |
| Memory-only event stream | History lost on restart | Promote to the document store |
| Branch split between service and application releases | Confusing promotion path | Unify or document the release train |
| Document generation depends on the Sheets engine | No report document without it | Service-side renderer as a fallback |
| No longitudinal memory | Understanding resets each import | Cross-batch knowledge and preference learning |

Every item above must be closed without reducing reporting capability, without breaking Smart Import compatibility, and without changing Google Sheets structure.

---

# 20. Document status

*Document Status:* Official Architecture Blueprint

*Version:* 1.1

*Project:* Smart Property Platform (SPP)

*v1.1:* Record Option A — `smart-employee/` experimental Arabic SPP surface (Governance §6.3).

*Independent companion documents:* `docs/SPP_CONSTITUTION.md`, `docs/DOMAIN_MODEL.md`

*Supporting documents:* `docs/SYSTEM_ARCHITECTURE.md`, `docs/DATA_ARCHITECTURE.md`, `docs/SPP_ENGINE_VISION.md`, `docs/MERGE_GATE_PLAN.md`, `docs/ARCHITECTURE_GOVERNANCE.md`, `docs/README.md`

*Technical notes outside architectural law:* `backend/docs/DATA_QUALITY.md`

*Change policy:* Layer boundaries, pipeline stages, gate semantics and the prepare-not-send guarantee are normative. Moving a responsibility across a boundary, adding an outbound rail, or changing gate semantics requires a blueprint revision. Adding an integration requires only that it satisfies the integration contract in section 8.3.
