# SPP Architecture Freeze — Enterprise Architecture v1.0

> Official architectural contract that closes the Architecture Phase of Smart Property Platform (SPP).
> After approval of this document, SPP Enterprise Architecture **v1.0** is frozen.
> This document does not redefine pillars. It freezes their adopted baseline and binds all future implementation to that baseline.
> Index: `docs/README.md`. Process law: `docs/ARCHITECTURE_GOVERNANCE.md`. Audit proof: `docs/ARCHITECTURE_AUDIT.md`.

---

# 1. Architecture Freeze Statement

**Decision:** Upon approval of this document, the Architecture Phase of SPP is **officially closed**, and Enterprise Architecture **v1.0** is **frozen**.

**Rationale:** The three pillars, supporting enterprise specifications, governance, and architecture audit form a coherent, audited Single Source of Truth under `docs/`. Continuing open-ended architectural drafting without a freeze would allow implementation to invent boundaries and dilute product identity.

**Consequence:** All future development — human or AI-agent — must follow the frozen architecture. Any structural change must be proposed through the Request for Architecture Change (RFC) process (§9) **before** implementation. Silent drift is a compliance failure.

---

# 2. Architecture Version (v1.0)

| Item | Value |
|---|---|
| Architecture version | **SPP Enterprise Architecture v1.0** |
| Freeze document version | 1.0 |
| Freeze class | Architecture Freeze / contractual governance |
| Effective upon | Approval recorded in §30 (version bump + status line on this document) |
| Supersedes | Informal architecture notes, chat summaries, and unpromoted root handoff claims as architectural law |

**Decision:** The frozen baseline is identified as **v1.0**, not as a draft or “working architecture.”  
**Rationale:** A named version enables compliance verification (§29) and evolution tracking (§20).  
**Consequence:** Amendments that change normative meaning require RFC + version increment of affected documents and an update to the freeze inventory (§4) if the set of frozen documents changes.

---

# 3. Scope of the Freeze

**In scope (frozen as architectural law):**

- Product identity, mission, and “must never become” constraints — owned by the Constitution.
- Ubiquitous language, entities, relationships, and lifecycles — owned by the Domain Model.
- Structural design: layers, pipelines, gate semantics, prepare-not-send, integrations topology, decision/OC/KB placement — owned by the Blueprint and deepened by supporting architecture docs listed in §4.
- Document precedence, naming, SSOT location, and writing rules — owned by Architecture Governance.
- Ownership, terminology aliases, conflict resolutions, and gap registry map recorded in the Architecture Audit and README index.

**Out of scope (not frozen by this document):**

- Application source code, schemas as implemented, prompts, API payloads, and runtime configuration.
- Operating-path and delivery notes (`APP_PATH.md`, beta/OTA notes, continuation notes) — they remain navigational; Blueprint status wins on conflict (Governance G-04).
- Accepted open gaps and roadmap items (Blueprint §19 and peer gap registries) — freezing architecture does **not** pretend gaps are closed; it freezes **how** they must be closed (§21).

**Decision:** Freeze the *architectural contract*, not the *implementation backlog*.  
**Rationale:** Closing Architecture Phase means boundaries and ownership are stable enough to implement against; it does not mean every capability is Implemented.  
**Consequence:** Implementation may proceed under §25 entry criteria while gaps remain explicitly tracked.

---

# 4. Documents Included in the Freeze

The following documents constitute the **frozen Enterprise Architecture v1.0 set**. Normative meaning in these documents must not be changed outside the RFC process (§9).

| # | Document | Role in freeze |
|---|---|---|
| 1 | [`SPP_CONSTITUTION.md`](./SPP_CONSTITUTION.md) | Pillar — product law |
| 2 | [`DOMAIN_MODEL.md`](./DOMAIN_MODEL.md) | Pillar — ubiquitous language |
| 3 | [`SPP_BLUEPRINT.md`](./SPP_BLUEPRINT.md) | Pillar — structural authority |
| 4 | [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md) | Supporting — end-to-end composition / security / scale / HA / DR / observability |
| 5 | [`DATA_ARCHITECTURE.md`](./DATA_ARCHITECTURE.md) | Supporting — data classes / stores / sync / retention / privacy / AI memory planes |
| 6 | [`KNOWLEDGE_BASE.md`](./KNOWLEDGE_BASE.md) | Supporting — institutional memory |
| 7 | [`DECISION_ENGINE.md`](./DECISION_ENGINE.md) | Supporting — decision authority / scoring / explainability |
| 8 | [`OPERATION_CENTER.md`](./OPERATION_CENTER.md) | Supporting — real-time coordination / queues / incidents |
| 9 | [`AI_PROPERTY_EMPLOYEE.md`](./AI_PROPERTY_EMPLOYEE.md) | Supporting — digital employee identity / ethics / interactions |
| 10 | [`MULTI_AGENT_ARCHITECTURE.md`](./MULTI_AGENT_ARCHITECTURE.md) | Supporting — digital workforce / specialist collaboration |
| 11 | [`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md) | Governance — precedence, naming, approval process |
| 12 | [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) | Audit companion — ownership, terminology, conflict and gap proof at freeze |

**Companion indices (bound to the freeze, not pillars):**

| Document | Role |
|---|---|
| [`README.md`](./README.md) | SSOT navigation index; ownership and terminology entry point |
| This document (`ARCHITECTURE_FREEZE.md`) | Freeze contract and Architecture Phase exit |

**Explicitly not members of the freeze set as independent law:** Engine Vision and Merge Gate Plan remain supporting under Governance classification; they deepen Koil layers and delivery intent but must not contradict the freeze set. Operating-path documents are not architectural law.

**Decision:** Freeze the audited enterprise set named above as v1.0.  
**Rationale:** Architecture Audit v1.0 verified ownership, links, and terminology for this set.  
**Consequence:** Adding a new normative architecture document to the freeze set requires RFC + README + freeze inventory update.

---

# 5. Single Source of Truth

| Rule | Statement |
|---|---|
| Location | All architectural truth lives under `docs/` |
| Precedence | Constitution → Domain Model → Blueprint → Supporting architecture → Operating path / audit notes ([`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md) §2.2) |
| No competing homes | Root stubs, `HANDOFF.md`, `AGENTS.md`, chat, and PR descriptions are not architectural law |
| No silent preference | A lower-ranked contradiction is invalid until revised; record a gap in the owning document |

**Decision:** The freeze **reaffirms** Governance §2; it does not create a second SSOT.  
**Rationale:** Duplicating SSOT rules would itself violate the no-duplication rule.  
**Consequence:** Implementers resolve doubt via README → Governance → owning pillar/supporting doc → Audit; never via informal notes.

---

# 6. Architecture Ownership

Unique ownership of concerns is normative as mapped in [`README.md`](./README.md) §2 and proven in [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) §2.

**Division of labour (binding summary — detail lives in owning docs):**

| Capability | Role |
|---|---|
| Decision Engine | **Decides** (authority classes; never a second ungoverned tip stream) |
| Operation Center | **Coordinates** (events, queues, incidents; does not redefine authority) |
| Knowledge Base | **Remembers** (institutional memory; no private agent truth stores) |
| AI Property Employee / Chief | **Faces the owner** (proposes, explains, learns; never approves) |
| Specialist agents | **Propose under the Chief** within charter ([`MULTI_AGENT_ARCHITECTURE.md`](./MULTI_AGENT_ARCHITECTURE.md)) |

**Decision:** One primary owner per architectural concern; others link.  
**Rationale:** Audit found no harmful ownership forks when this map is followed.  
**Consequence:** PRs that paste another document’s owned tables into a non-owner fail review.

---

# 7. Architecture Governance

Day-to-day document law remains [`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md):

- Writing rules (no code, no duplication, status honesty, gaps first-class, Smart Import / Sheets freeze, Executive reporting preserved, AI proposes / humans approve) — Governance §5.
- Official naming and aliases — Governance §6; Audit §4; README §3.
- Approval and change control baseline — Governance §7, extended by this freeze’s RFC (§9).

**Decision:** This freeze **extends** Governance by closing Architecture Phase; it does not replace Governance.  
**Rationale:** Separation of process law (Governance) from phase contract (Freeze) keeps each document’s responsibility clear.  
**Consequence:** Process amendments still edit Governance; phase/contract amendments edit this freeze (via RFC).

---

# 8. Change Management Policy

| Change class | May proceed without RFC? | Must update |
|---|---|---|
| Bug fix / stability / performance within existing boundaries | Yes | Tests / code only; no pillar rewrite |
| Clarifying non-normative prose, broken link repair, accepted alias documentation | Yes, if meaning unchanged | Owning doc version note if helpful |
| New feature that **implements** an already-specified Partial/Planned capability | Yes, if it does not invent new boundaries | Operating path / status honesty against Blueprint |
| Identity, entity language, layer/pipeline/gate/prepare-not-send, authority classes, OC intake model, KB taxonomy law, employee must-never, multi-agent org law | **No** | RFC (§9) before implementation |
| Closing or accepting a documented Architecture Gap that changes normative meaning | **No** (unless gap already accepted with owner and the work only implements the accepted direction) | Owning gap registry + possibly Blueprint §19 |

**Decision:** Implementation may fill Planned/Partial surfaces; it may not invent architecture.  
**Rationale:** Freeze protects boundaries while allowing delivery against known gaps.  
**Consequence:** “We needed a new subsystem” without RFC is non-compliant (§12–§14).

---

# 9. Request for Architecture Change (RFC) Process

An **Architecture RFC** is required before any change that alters normative meaning in the freeze set (§4).

## 9.1 RFC minimum content

1. **Title** and unique RFC id (e.g. `RFC-YYYY-NNN`).
2. **Problem** — what is broken or missing under frozen architecture.
3. **Affected documents** — list from §4 (and gap ids if any).
4. **Proposed change** — conceptual only; no code, prompts, or API samples.
5. **Decision / Rationale / Consequence** — mandatory triad for each normative decision.
6. **Backward compatibility** — impact on §10 rules.
7. **Identity / Executive reporting / Smart Import** — explicit statement of non-regression (or governed exception).
8. **Alternatives considered** and why rejected.
9. **Rollback / rejection path** if the RFC is denied.

## 9.2 RFC lifecycle

| Stage | Rule |
|---|---|
| Propose | RFC recorded under `docs/` (or Blueprint §18 decision register pointer) before code lands |
| Review | Architecture owner + product owner per §15 |
| Approve / Reject / Defer | Written outcome; no silent merge |
| Apply | Amend owning documents first; then allow implementation |
| Close | Version bumps on amended docs; update freeze inventory if document set changes |

**Decision:** RFC precedes implementation for structural change.  
**Rationale:** Architecture Phase is closed; post-freeze design must be deliberate and auditable.  
**Consequence:** Code PRs that smuggle architecture changes without RFC fail Architecture Compliance (§29).

---

# 10. Backward Compatibility Rules

| Rule | Statement |
|---|---|
| Sheets / Smart Import | No renaming of sheets, columns, or sheet identities; no ungovered Smart Import mapping changes (Governance §5.8; product Rule 3/4) |
| Domain language | Existing Domain Model names remain stable; renames require Domain Model RFC |
| Gate / prepare-not-send | Gate semantics and prepare-not-send remain as Blueprint; must not be weakened to enable silent outbound send |
| Reporting capability | No reduction of Executive Report, AI analysis, Owner Dashboard, or predictive insight capability |
| Decision approval | Approval remains a modeled human (or governed automatic *internal-only*) state; AI does not approve as product law |
| Client surfaces | New Presentation adapters share Domain/Application; no second domain model (`smart-employee/` Option A) |

**Decision:** Compatibility is architectural, not only binary.  
**Rationale:** Property operations data and owner trust depend on stable language and gates.  
**Consequence:** Breaking compatibility requires explicit RFC acceptance of risk (§27).

---

# 11. Documentation Update Policy

1. Facts are stated once in the owning document; others link ([`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md) §5.3).
2. Normative meaning change ⇒ document version increment + RFC when in freeze set.
3. New architecture documents require README index update and freeze §4 inventory update if they claim normative law.
4. Gap closures update the **owning** gap registry; do not fork Blueprint §19 into parallel roadmaps ([`README.md`](./README.md) §4).
5. Audit findings append as AUD-* in [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) or a successor audit; they do not silently rewrite pillars.
6. Operating-path docs that disagree with Blueprint status must be corrected or marked deferred (G-04); Blueprint wins.

**Decision:** Documentation remains SSOT under the same no-duplication law after freeze.  
**Rationale:** Freeze fails if docs fork after approval.  
**Consequence:** Doc-only PRs are still architecture-governed when they touch freeze-set meaning.

---

# 12. Implementation Compliance Rules

Implementations **must**:

1. Conform to freeze-set documents for boundaries they touch.
2. Respect Clean Architecture / layer discipline as stated in Blueprint and Governance §9.
3. Keep business rules out of UI widgets.
4. Preserve prepare-not-send and gate semantics for outbound actions.
5. Route judgements through Decision Engine concepts; coordination through Operation Center concepts; memory through Knowledge Base concepts; owner face through AI Property Employee / Chief.
6. Refuse to ship a second owner-facing “bot brand” or private specialist truth store.
7. Treat Planned/Partial/Placeholder honestly in product claims.

Implementations **must not**:

- Begin structural invention outside RFC.
- Treat operating-path “live” labels as authority over Blueprint status.
- Embed architecture-by-comment that contradicts `docs/`.

**Decision:** Code follows frozen docs; docs do not chase undocumented code.  
**Rationale:** SSOT location is `docs/`.  
**Consequence:** Undocumented structural behavior discovered in code is a defect or an RFC candidate — not a new silent law.

---

# 13. AI Agent Compliance Rules

AI coding / cloud agents operating on SPP **must**:

1. Treat `docs/` freeze set as binding contract for architectural decisions.
2. Prefer bug fix → regression → performance → stability → existing improvement → new feature (product Rule 2) unless an RFC-approved architecture task says otherwise.
3. Never redesign branding, identity, or UX philosophy unless explicitly tasked (Identity Protection).
4. Never modify Smart Import / Sheets identity unless the task explicitly targets a governed change.
5. Never write architecture docs that include code, prompts, or API samples.
6. Cross-link owning documents instead of duplicating stage/authority tables.
7. Record newly discovered contradictions as gaps in the owning document (or AUD-* / G-*), not resolve by preference.
8. Not open Architecture Phase again by rewriting pillars for convenience.

**Decision:** Agents are bound by the same contract as humans.  
**Rationale:** Most architectural drift risk post-freeze comes from autonomous edits.  
**Consequence:** Agent PRs that invent subsystems or duplicate SSOT fail review under §29.

---

# 14. Human Developer Compliance Rules

Human developers **must**:

1. Read README reading order for the area they change before implementing.
2. Stop and raise an RFC when a task requires new boundaries, entities, gates, or authority classes.
3. Keep ubiquitous language aligned with the Domain Model in UI copy and module naming where product-facing.
4. Not use chat agreement as architecture approval.
5. Update owning docs when an RFC is approved — **before** or **with** the implementation PR, never “docs later” for normative meaning.

**Decision:** Humans own RFC authorship and product-owner escalation.  
**Rationale:** Freeze is a contract; contracts need accountable parties (§28).  
**Consequence:** “Implemented first, architecture later” is non-compliant for structural change.

---

# 15. Review and Approval Process

| Artifact | Approvers (minimum) | Evidence |
|---|---|---|
| This freeze (Architecture Phase exit) | Product owner + designated architecture owner | Status line §30 |
| Architecture RFC | Product owner + architecture owner | Written approve/reject/defer |
| Pillar normative amendment | Same as RFC + explicit pillar version bump | PR + RFC link |
| Supporting normative amendment | Architecture owner; product owner if identity/reporting/Smart Import touched | PR + RFC when required by §8 |
| Implementation within frozen boundaries | Normal engineering review | Tests; no architecture invention |
| Gap accept-as-risk | Product owner | Gap row: Accepted + owner + date |

**Decision:** Freeze approval is a distinct ceremony from ordinary doc edits.  
**Rationale:** Closing Architecture Phase must be intentional and attributable.  
**Consequence:** Unapproved freeze text is draft only and does not bind Implementation Phase entry (§25).

---

# 16. Architectural Integrity Rules

1. **Three pillars remain independent** — none absorbs another.
2. **No harmful duplication** — Audit §5 standard remains the bar.
3. **No unresolved contradictions** at Constitution level; residual aliases only as documented (Audit §4 / §6).
4. **Gaps are first-class** — silence is forbidden (Governance §5.7).
5. **Extensibility** — decisions remain valid as SPP grows from single AI Employee to multi-agent Operation Center capabilities (Blueprint §17; Multi-Agent Architecture).
6. **Identity** — SPP remains a Property Operations Platform, not a chatbot, CRM, or dashboard-only product (Constitution).

**Decision:** Integrity is verified continuously via compliance checks (§29), not only at freeze day.  
**Rationale:** Freeze is a starting contract for Implementation Phase, not a one-time ceremony.  
**Consequence:** Integrity violations reopen RFC, not informal patches.

---

# 17. Architectural Constraints

The following constraints are **non-negotiable** without Constitution-level RFC:

| Constraint | Source (link, do not restate full text) |
|---|---|
| AI proposes; humans approve | Constitution; Decision Engine; AI Property Employee |
| Prepare-not-send for outbound | Blueprint; Operation Center |
| One institutional Knowledge Base | Knowledge Base; Multi-Agent (no private truth) |
| Chief / AI Employee is the owner-facing face | AI Property Employee; Multi-Agent |
| Smart Import / Sheets identity freeze | Governance §5.8 |
| Executive reporting capability preserved | Governance §5.9; Blueprint Executive Report pipeline |
| `smart-employee/` is experimental surface under one Constitution (Option A) | Governance §6.3 |
| `docs/` is SSOT | Governance §2; this freeze §5 |

**Decision:** Constraints above are freeze-hard.  
**Rationale:** They encode product identity and trust.  
**Consequence:** Workarounds that weaken them are rejected unless a Constitution-class RFC is approved.

---

# 18. Enterprise Quality Standards

Architecture and implementation under the freeze must uphold:

| Standard | Expectation |
|---|---|
| Status honesty | Implemented / Partial / Placeholder / Planned used truthfully |
| Observability / HA / DR / security framing | As owned by System Architecture — implement toward, do not contradict |
| Data privacy / retention / sync classes | As owned by Data Architecture |
| Explainability of decisions | As owned by Decision Engine |
| Provenance of knowledge | As owned by Knowledge Base |
| Incident / escalation clarity | As owned by Operation Center |
| Ethics / must-never for the digital employee | As owned by AI Property Employee |
| Specialist charter boundaries | As owned by Multi-Agent Architecture |
| Release / quality intent | Blueprint quality & release architecture; Merge Gate Plan for delivery intent only |

**Decision:** Quality is defined by owning architecture docs, not reinvented per feature.  
**Rationale:** Enterprise consistency requires shared bars.  
**Consequence:** Feature PRs that lower these bars without RFC are non-compliant.

---

# 19. Long-Term Vision Protection

The freeze protects the long-term vision that SPP is an **AI-powered Property Operations Platform** whose core loop is: understand portfolio → decide with authority classes → coordinate operations → remember institutionally → face the owner as an AI Property Employee — extensible to a specialist digital workforce.

**Decision:** Vision protection is enforced by Constitution + freeze constraints (§17), not by marketing copy.  
**Rationale:** Identity Protection and AI-First product rules fail if Implementation Phase optimizes for short-term UI shortcuts.  
**Consequence:** Shortcuts that create a chatbot-shaped product, dashboard-only product, or second constitution are out of policy.

---

# 20. Future Architecture Evolution

Architecture **will** evolve after v1.0 — only through controlled change:

1. Close accepted gaps in Blueprint §19 and peer registries without forking roadmaps.
2. Advance multi-agent phases per Blueprint §17.5 and Multi-Agent Architecture status honesty.
3. Deepen Partial → Implemented surfaces without inventing parallel subsystems.
4. Issue RFCs for true structural evolution; bump architecture version when the freeze set’s normative meaning materially changes (e.g. v1.1 / v2.0 declaration).
5. Re-audit when supporting set grows or conflicts accumulate (successor to Architecture Audit).

**Decision:** Freeze ≠ forever immutability; freeze = **no ungovered mutation**.  
**Rationale:** Enterprise platforms need both stability and evolution.  
**Consequence:** “Architecture Phase reopened casually” is forbidden; “Architecture Evolution via RFC” is required.

---

# 21. Known Accepted Gaps

Freezing architecture **accepts that open gaps remain**. They are not defects of the freeze; they are the Implementation / roadmap backlog under architectural control.

| Class | Where tracked | Freeze stance |
|---|---|---|
| Governance open | G-04 (APP_PATH vs Blueprint status); G-07 → Blueprint §19 | Remain Open; Blueprint wins on status |
| Governance accepted | G-05 (ADR index = Blueprint §18) | Accepted — do not scatter decisions |
| Blueprint roadmap | Blueprint §19 (event bus, outbound rails, longitudinal memory, …) | Link only; do not fork |
| Supporting registries | SA-*, DA-*, DE-*, OC-*, KB-*, AIE-*, MA-* | Owned by respective docs; Implementation closes without inventing law |
| Audit | AUD-G2 tracks G-04 | Open until G-04 closes |

Detail and IDs: [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) §8; [`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md) §8; [`README.md`](./README.md) §4.

**Decision:** Known gaps are explicitly carried into Implementation Phase.  
**Rationale:** Pretending completeness would force dishonest “Implemented” labels.  
**Consequence:** Closing a gap that changes normative meaning still requires documentation update (and RFC when structural).

---

# 22. Architecture Milestones

| Milestone | Evidence | Status at freeze |
|---|---|---|
| M1 — Three pillars under `docs/` | Constitution, Domain Model, Blueprint | Complete |
| M2 — Architecture Governance + README SSOT index | Governance, README | Complete |
| M3 — Enterprise supporting set | System, Data, Knowledge Base, Decision Engine, Operation Center, AI Property Employee, Multi-Agent | Complete (as freeze set §4) |
| M4 — Architecture Audit | Architecture Audit v1.0; README v1.9 map | Complete |
| M5 — Architecture Freeze v1.0 | This document approved (§30) | **Pending approval** → then Complete |
| M6 — Implementation Phase entry | §25 criteria satisfied | After M5 |

**Decision:** M5 is the Architecture Phase exit gate.  
**Rationale:** Audit without freeze leaves phase status ambiguous.  
**Consequence:** Until §30 approval, Implementation Phase entry criteria are not formally opened by this contract (engineering may still do Rule-2 stability work under Governance §7.1 interim rules).

---

# 23. Architecture Completion Checklist

| # | Checklist item | Done when |
|---|---|---|
| 1 | Pillars exist and agree under `docs/` | Linked and precedence-ordered |
| 2 | Supporting enterprise specs exist with clear ownership | README §2 + Audit §2 |
| 3 | Governance adopted (precedence, naming, writing rules) | Governance v1.2+ |
| 4 | Architecture Audit completed (links, conflicts, gaps) | Audit v1.0 |
| 5 | Terminology unified / aliases documented | README §3 + Audit §4 |
| 6 | Gap registries mapped; open gaps explicit | README §4 + §21 |
| 7 | No harmful duplication / no material contradiction | Audit §§5–6 |
| 8 | Cross-references healthy | Audit §7 (0 broken in architecture set) |
| 9 | Freeze document written with Decision/Rationale/Consequence | This document |
| 10 | Freeze approved by product + architecture owners | §30 |

Items 1–9 are satisfied by the freeze-set content on the architecture stack; item 10 is the remaining ceremonial gate.

---

# 24. Exit Criteria for Architecture Phase

Architecture Phase **exits** when all are true:

1. Freeze set (§4) is published under `docs/`.
2. Architecture Audit has recorded ownership, terminology, link health, and gaps.
3. Open gaps are inventoried (§21) — not necessarily closed.
4. This freeze document is **approved** (§15 / §30).
5. README indexes the freeze as Architecture Phase exit.

**Decision:** Exit is document-and-approval based, not “all SA/DA/… gaps closed.”  
**Rationale:** Many gaps are Implementation targets by design (Blueprint §19).  
**Consequence:** After exit, structural invention without RFC is prohibited.

---

# 25. Entry Criteria for Implementation Phase

Implementation Phase **enters** when Architecture Phase has exited (§24) and teams agree to:

1. Build only within frozen boundaries or via approved RFC.
2. Prefer Rule-2 stability ordering unless product prioritization says otherwise **within** architecture.
3. Use Blueprint status legends for honesty in release claims.
4. Close gaps by implementing toward owning specs, updating gap status when done.
5. Keep `docs/` updated when normative meaning changes (RFC path).

**Allowed immediately after entry:** features that realize already-specified Partial/Planned capabilities; bug/regression/performance work; documentation clarifications without meaning change.

**Not allowed without RFC:** new pillars of structure, new authority classes, new owner-facing agent brands, Smart Import identity changes, Constitution-level identity shifts.

**Decision:** Implementation Phase is architecture-constrained delivery.  
**Rationale:** That is the purpose of closing Architecture Phase.  
**Consequence:** Roadmaps that require new architecture must budget RFC first.

---

# 26. Architecture Success Metrics

| Metric | Target at freeze / ongoing |
|---|---|
| Broken references in freeze-set docs | **0** (Audit §7 baseline) |
| Unowned normative concerns | **0** (ownership map complete) |
| Undocumented material conflicts | **0** Constitution-level; aliases documented |
| Harmful duplicated stage/authority tables | **0** new forks post-freeze |
| Structural PRs without RFC | **0** |
| Gap registry discipline | New gaps filed in owning doc with id |
| Identity / Smart Import / reporting regressions via architecture | **0** ungovered |
| SSOT violations (law outside `docs/`) | **0** accepted |

**Decision:** Success is compliance and integrity, not feature count.  
**Rationale:** Architecture Phase measures contract quality.  
**Consequence:** Implementation KPIs remain separate; they must not override these metrics.

---

# 27. Risk Acceptance

| Risk | Acceptance | Owner |
|---|---|---|
| Open Blueprint §19 / G-07 structural gaps | Accepted for Implementation Phase entry; tracked only in Blueprint §19 | Architecture |
| G-04 operating-path status drift | Accepted as Open; Blueprint status wins until reconciled | Architecture + delivery |
| Residual naming aliases (Operations Center, Collection/Utilities agent spelling) | Accepted — documented aliases | Architecture |
| Kowil historical spelling in older notes/code | Accepted as historical only; new normative prose uses Koil | Architecture |
| Engine Vision / Merge Gate Plan outside freeze inventory as peer law | Accepted — subordinate supporting; must not contradict freeze set | Architecture |
| Automatic decision class exists | Accepted within Decision Engine limits (internal non-outbound); does not void “AI never approves” product law | Architecture |

**Decision:** Risks above are consciously accepted at freeze.  
**Rationale:** Audit already classified them; freeze must not hide them.  
**Consequence:** New risks of equal class require explicit acceptance rows or RFC.

---

# 28. Governance Responsibilities

| Role | Responsibility |
|---|---|
| Product owner | Approves freeze, RFCs touching identity/reporting/Smart Import, gap risk acceptance |
| Architecture owner | Maintains freeze set integrity, RFC review, precedence enforcement, audit follow-ups |
| Engineering leads | Enforce §12 in delivery; stop structural invention; escalate to RFC |
| AI agent operators / reviewers | Enforce §13; reject non-compliant agent output |
| All contributors | File gaps; follow README; do not treat HANDOFF/chat as law |

**Decision:** Responsibilities are role-based, not personality-based.  
**Rationale:** Continuity beyond a single author.  
**Consequence:** Vacancy of a role does not suspend the freeze; approvals wait for the role, not the other way around.

---

# 29. Compliance Verification

Verification methods (lightweight, continuous):

1. **PR architecture checklist** — Does this change invent boundaries? Touch freeze-set meaning? Need RFC?
2. **Doc link check** — Freeze-set references resolve.
3. **Ownership check** — Normative text lands in the owning document.
4. **Gap check** — New contradictions create gap ids; Blueprint §19 not forked.
5. **Terminology check** — Canonical terms / documented aliases only.
6. **Periodic audit** — Successor Architecture Audit when drift suspected.
7. **Status honesty review** — Release claims vs Blueprint legends.

**Decision:** Compliance is verified in review, not only by ceremony.  
**Rationale:** Contracts fail without enforcement.  
**Consequence:** Failed checks block merge of structural changes.

---

# 30. Final Architecture Declaration

**Declaration:**

> Smart Property Platform Enterprise Architecture **v1.0** is hereby declared the **frozen architectural baseline**.
>
> The Architecture Phase is **closed** upon approval of this document.
>
> All future development must follow the frozen architecture referenced in §4.
>
> Any structural change must be proposed through the RFC process (§9) before implementation.
>
> This document is the **official architectural contract** for SPP Version 1.0.

| Field | Value |
|---|---|
| Declaration status | **Pending formal approval** — content complete; binds upon product owner + architecture owner approval |
| Architecture version | v1.0 |
| Freeze document version | 1.0 |
| SSOT root | `docs/` |
| Process law | [`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md) |
| Audit proof | [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md) |
| Index | [`README.md`](./README.md) |

**Decision:** Approval flips declaration status from Pending to **Approved** (record approver names/dates in a follow-up version note).  
**Rationale:** The contract must be attributable (§15).  
**Consequence:** After approval, Architecture Phase exit criteria (§24) and Implementation Phase entry (§25) are formally met.

---

# 31. Document status

*Document Status:* Official Architecture Freeze (pending approval)

*Version:* 1.0

*Class:* Architecture Freeze / contractual governance

*Project:* Smart Property Platform (SPP)

*Architecture version frozen:* SPP Enterprise Architecture v1.0

*Related:*

- [`SPP_CONSTITUTION.md`](./SPP_CONSTITUTION.md)
- [`DOMAIN_MODEL.md`](./DOMAIN_MODEL.md)
- [`SPP_BLUEPRINT.md`](./SPP_BLUEPRINT.md)
- [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md)
- [`DATA_ARCHITECTURE.md`](./DATA_ARCHITECTURE.md)
- [`KNOWLEDGE_BASE.md`](./KNOWLEDGE_BASE.md)
- [`DECISION_ENGINE.md`](./DECISION_ENGINE.md)
- [`OPERATION_CENTER.md`](./OPERATION_CENTER.md)
- [`AI_PROPERTY_EMPLOYEE.md`](./AI_PROPERTY_EMPLOYEE.md)
- [`MULTI_AGENT_ARCHITECTURE.md`](./MULTI_AGENT_ARCHITECTURE.md)
- [`ARCHITECTURE_GOVERNANCE.md`](./ARCHITECTURE_GOVERNANCE.md)
- [`ARCHITECTURE_AUDIT.md`](./ARCHITECTURE_AUDIT.md)
- [`README.md`](./README.md)

*Change policy:* Normative changes to this freeze require RFC (§9) and version increment. Approval of §30 is recorded by updating Declaration status and adding an approval note under this section.
