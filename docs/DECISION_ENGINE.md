# SPP Decision Engine Architecture v1.0

> Official Decision Engine architecture specification for the Smart Property Platform (SPP).
> This is a core architecture document. It defines how trusted knowledge becomes explainable, ranked, gated, and owner-governed business decisions — not how ranking functions are coded.
> Document process and SSOT rules: `docs/ARCHITECTURE_GOVERNANCE.md`. Index: `docs/README.md`.

---

# 0. Document authority and boundaries

## 0.1 Role in the document set

| Document | Owns | This document must |
|---|---|---|
| `docs/SPP_CONSTITUTION.md` | Product identity; AI proposes / humans approve; required decision fields | Obey; never grant silent autonomy |
| `docs/DOMAIN_MODEL.md` | Meaning of `Decision`, `Prediction`, `KnowledgeBase`, related lifecycles | Use entity names; not restate attribute catalogs |
| `docs/SPP_BLUEPRINT.md` | Pipeline stages, gate semantics, prepare-not-send, unification sources | Link structural rules; not copy stage tables |
| `docs/SYSTEM_ARCHITECTURE.md` | Enterprise placement of the Decision Engine in the running system | Align performance, scale, multi-agent coordination |
| `docs/DATA_ARCHITECTURE.md` | Decision memory, audit durability, provenance, privacy of decision data | Align persistence and retention; not redefine stores |
| `docs/DECISION_ENGINE.md` (this document) | Decision philosophy, categories, authority classes, scoring, explainability, learning, governance of decisions | Be the reference for every AI recommendation and business decision inside SPP |

**Conflict rule:** Precedence follows Architecture Governance §2.2. This document deepens Blueprint §13 and System Architecture §9. It may not weaken Constitution §11, Domain Model `Decision` invariants, gate semantics, or prepare-not-send.

## 0.2 Status legend

Aligned with Blueprint: **Implemented** · **Partial** · **Placeholder** · **Planned**.

## 0.3 Decision record format

Every architectural choice below states **Decision**, **Rationale**, and **Consequence**. Gaps are first-class in §37 as **DE-***.

## 0.4 Naming

| Term | Meaning here |
|---|---|
| Decision Engine | Platform capability that generates, unifies, scores, gates, proposes, and learns from decisions |
| Decision | Domain aggregate defined in Domain Model §5.15 |
| Prediction | Forward-looking statement; not itself an executable decision (Domain Model §5.16) |
| AI Employee / Koil | Product role / intelligence system that presents and explains the agenda (Governance §6) |
| Gate | Consistency gate controlling confidence and executability (Blueprint §13.2) |

---

# 1. Decision Philosophy

| Decision | Rationale | Consequence |
|---|---|---|
| Decisions exist to make SPP a better Property Employee | Constitution §§4–5 | Every proposal must advance organised operations, analysis, or owner-controlled action |
| Trusted knowledge in; explainable judgement out | Purpose of this engine | Raw uploads, vendor payloads, and ungated inference are invalid decision inputs |
| One agenda, many generators | Blueprint §18 unified decision list | Owner never negotiates four competing engines |
| Authority stays human for consequential action | Constitution §11; Governance §5.10 | Approval is a modeled state; silence is not consent |
| Caution beats confident error | Blueprint gate philosophy | Blocked or low-quality data yields review items, not polished false certainty |
| Learning improves ranking, not sovereignty | Constitution AI principles | Feedback changes priority and wording quality; it never self-approves |

**Philosophy statement:** The Decision Engine turns **defensible property knowledge** into **owner-governed recommendations** that always carry reason, evidence, expected outcome, and risk.

---

# 2. Decision Principles

| # | Principle | Normative effect |
|---|---|---|
| P1 | Evidence or silence | No recommendation without concrete supporting facts |
| P2 | Reason in owner language | Why must be intelligible without engineer jargon |
| P3 | Expected outcome stated | Owner sees what should change if approved |
| P4 | Risk level mandatory | Every decision carries an explicit risk class (§8) |
| P5 | Gate before glory | Confidence and executability obey the consistency gate |
| P6 | Prepare ≠ send | Approval creates prepared content; delivery needs an enabled rail |
| P7 | Identity-stable unification | Same real-world action → one decision id |
| P8 | Provenance travels | Originating analysis/engine/event remains attached |
| P9 | Quality flags are passengers | Dropping gate or data-quality signals is a defect |
| P10 | Predictions propose futures; decisions propose actions | Do not conflate the two aggregates |
| P11 | Forbidden means impossible, not “hidden” | §11 classes have no executable path |
| P12 | Override is recorded | Owner edits/dismissals become learning and audit, not silent deletes |

Entity-level invariants remain in Domain Model §5.15. Pipeline ownership remains Blueprint §13.

---

# 3. Decision Lifecycle

Product lifecycle stages for the `Decision` aggregate: Domain Model §5.15. Engine-level lifecycle (enterprise):

| Stage | Engine responsibility | Durable output |
|---|---|---|
| Trigger | Detect actionable condition from import, live state, event, or prediction escalation | Candidate seed |
| Generate | Produce candidate from a lawful source (§4) | Candidate with provisional evidence |
| Unify | Merge duplicates by real-world action key | Single decision identity |
| Score & prioritise | Assign score, tier, priority (§7) | Rank inputs |
| Gate | Apply entity-aware consistency verdict | Confidence ceiling; block/warn/ok |
| Classify authority | Automatic vs human-approval vs forbidden (§§9–11) | Authority class |
| Propose | Surface on one agenda with Constitution fields | Owner-visible decision |
| Owner judgement | Approve / edit / dismiss / snooze | Judgement signal |
| Prepare | Compose exact message or payment instruction | Approval record + unsent delivery state |
| Execute (conditional) | Dispatch only via enabled rail | Delivery state update |
| Close / learn | Resolve condition or retain dismissal | Decision memory + ranking update |

**Decision:** Preview and proposal never mutate money or outbound channels. **Rationale:** Owner authority. **Consequence:** Side effects before approval are architectural defects.

**Decision:** A blocked gate decision cannot be approved for execution. **Rationale:** Domain Model invariant. **Consequence:** UI and APIs must refuse execution paths for blocked items (review-only).

---

# 4. Decision Inputs

Only **trusted, classified** inputs may drive generation.

| Input class | Examples | Trust rule | Status |
|---|---|---|---|
| Property knowledge | Units, arrears, collection, contracts, quality flags | From applied/promoted knowledge | Implemented |
| Ledger & finance facts | Payments, due amounts, official flags | Deterministic; official outranks statement | Implemented |
| Lifecycle signals | Arrivals, departures, renewals | From gated analysis / live state | Implemented |
| Live portfolio state | Occupancy, vacancies, ticket states | Device/cloud working truth | Implemented |
| Executive intelligence | Ranked opportunities, brief risks | Gate-reapplied read models | Implemented |
| SmartEvents / operations | Lease notices, utility bills, messages | After ACL normalisation | Partial |
| Predictions | Arrears trajectory, vacancy risk, repeat repair | Escalate to decision only when action warranted | Partial |
| Decision memory | Prior approvals, dismissals, outcomes | Learning input, not sole evidence | Partial |
| Owner policy / preferences | Ranking habits, snooze windows | Constrain ranking; never invent facts | Partial / Planned |

**Forbidden as sole evidence:** raw uploaded files, vendor field names, LLM free text without verified context, caches without revalidation, ungated contradictions.

**Decision:** Inputs must carry provenance and quality/gate context. **Rationale:** Data Architecture truth classes and Blueprint §2.8. **Consequence:** Generators that strip provenance are rejected in review.

Cross-refs: Data Architecture §§5–8; Blueprint §§9–12; System Architecture §§5–6.

---

# 5. Decision Outputs

| Output | Meaning | Downstream consumer |
|---|---|---|
| Unified decision record | Ranked, gated recommendation with Constitution fields | AI Employee desk, approval queue |
| Authority class | Automatic / human-approval / forbidden | Enforcement layer |
| Prepared content | Exact message or payment instruction after approval | Outbox / rails (when enabled) |
| Operation entry | Immutable “what was decided” | Operations audit |
| Notification drafts | Audience-scoped tellings | Notification service |
| Executive recommendation slice | Report/brief sections | Executive Report pipeline |
| Learning signals | Accept / edit / dismiss / snooze / outcome | Ranking & preference memory |
| Invalidation notices | Decision withdrawn because condition resolved or data superseded | Agenda refresh |

**Decision:** Outputs never include claimed execution unless delivery state is actually sent. **Rationale:** Controlled interpretation guardrails; prepare-not-send. **Consequence:** Language layer and UI copy must distinguish prepared vs dispatched.

Required fields on every owner-visible decision: reason, evidence, expected outcome, risk (Constitution §11) plus priority/tier, confidence, affected entities, gate verdict, provenance (Domain Model §5.15).

---

# 6. Decision Categories

Categories organise the agenda; they are not separate products.

| Category | Typical kinds | Primary evidence domains |
|---|---|---|
| Collection / financial | Arrears reminders, settlement plans, payment confirmation | Ledger, payments, tenant reliability |
| Leasing | Renewal, vacancy fill, transfer, expiry notice | Contracts, occupancy, lease events |
| Maintenance | Assign tech, preventive work, replace-vs-repair | Tickets, asset memory, sensors (target) |
| Utilities | Bill pay preparation, responsibility transfer, anomaly follow-up | Utility events, meters |
| Data quality | Request correction, re-import, fill gaps | Gate conflicts, change logs |
| Portal / communication | Share portal link, owner alert, platform message | Contacts, portal tokens, pending actions |
| Emergency / safety | Urgent hazard response proposals | High-priority events, critical tickets |
| Portfolio / executive | Cross-property capital, policy, attention shifts | Aggregated knowledge, predictions |

**Decision:** Category is a classification attribute on one Decision aggregate, not a fork of engines into siloed apps. **Rationale:** One agenda principle. **Consequence:** Multi-agent specialists (Blueprint §17) still emit into this category model under one coordinator.

---

# 7. Decision Priorities

| Tier (time) | Intent | Typical use |
|---|---|---|
| Now | Immediate owner attention | Emergencies, severe arrears, critical gate blocks needing review |
| Today | Same-day operational work | Collection touches, assignment, expiring notices |
| This week | Planned operational cycle | Renewals inside window, preventive maintenance |
| Follow-up | Deferred but tracked | Soft opportunities, snoozed items due later |

Priority bands (critical → low) combine with tier and score for ranking (Blueprint §13.1 Scoring).

**Decision:** Priority expresses **attention**, not automatic execution rights. **Rationale:** High urgency must not bypass approval or gate. **Consequence:** “Now” + blocked gate ⇒ urgent review item, not auto-dispatch.

**Decision:** Snooze preserves identity and reopen conditions. **Rationale:** Owner judgement is temporary deferral, not deletion. **Consequence:** Ranking must restore snoozed items when due without duplicating ids.

---

# 8. Decision Risk Levels

| Risk level | Meaning | Typical constraints |
|---|---|---|
| Low | Limited downside; reversible communication or internal note | Still auditable; may still require approval per policy |
| Medium | Financial or relationship impact if wrong | Human approval default |
| High | Significant money, legal, or tenant harm potential | Human approval mandatory; stronger evidence bar |
| Critical | Safety, legal breach, or irreversible external effect | Human approval mandatory; often emergency category; forbidden if evidence insufficient |

**Decision:** Risk is mandatory and independent of priority. **Rationale:** Constitution §11; a low-urgency high-risk item must not look “safe” because it is “follow-up.” **Consequence:** Ranking UI and reports show both dimensions.

**Decision:** Risk cannot be lowered by the language layer. **Rationale:** Explainer ≠ calculator/judge. **Consequence:** LLM may phrase risk but not reclassify it.

---

# 9. Automatic Decisions

“Automatic” in SPP means **machine-concluded without owner click** — and is **narrowly scoped**.

| Allowed automatic effects (target policy) | Examples | Guard |
|---|---|---|
| Internal agenda maintenance | Re-rank, expire resolved candidates, reopen snoozes | No outbound side effect |
| Derived projection refresh | Update briefings after gate reapply | Read models only |
| Deterministic labelling | Mark decision as stale when contract already renewed | No money movement |

| Not automatic | Examples |
|---|---|
| Any outbound message | WhatsApp / SMS / email send |
| Any payment | Utility or rent settlement |
| Official record mutation | Overwriting owner-confirmed facts |
| Portal revocation cascades | Mass access changes without owner intent |

**Decision:** Default authority class is human-approval for consequential actions. **Rationale:** Trust architecture; Blueprint prepare-not-send. **Consequence:** Expanding automatic class requires Decision Governance amendment (§33) and Constitution alignment.

**Decision:** Automatic class never includes blocked-gate execution. **Rationale:** Domain Model invariant. **Consequence:** Automation may only produce review items when blocked.

Status: true outbound automation **Absent/Planned**; current system proposes and prepares under owner approval (**Implemented** path).

---

# 10. Human Approval Decisions

| Rule | Statement |
|---|---|
| Modeled approval | Actor, timestamp, exact prepared content persisted |
| One decision, one resolution | Ambiguous multi-intent buttons forbidden |
| Edit is first-class | Owner may edit prepared content before commit; edit is a learning signal |
| Dismiss is first-class | Reason retained when available |
| Delegation | Agents may approve only within explicit permission subset |
| Gate respect | Blocked decisions are not approvable for execution |
| Prepare-not-send | Approval ⇒ prepared + unsent unless rail enabled and policy allows |

**Decision:** Human approval is the normal path for money, messaging, assignments that notify externals, and official corrections. **Rationale:** Constitution §11. **Consequence:** Product flows that hide approval are defects.

Cross-refs: Blueprint §§7.2, 13.3; System Architecture §9; Data Architecture approval durability.

---

# 11. Forbidden Decisions

Forbidden means **no executable path**, including no “approve anyway” for that class.

| Forbidden class | Why | Correct alternative |
|---|---|---|
| Invented financial totals | Deterministic layer owns money | Surface data-quality / review decision |
| Execution claiming without rail | Prepare-not-send | Prepare only; mark awaiting rail |
| Silent official overwrite | Official truth class | Conflict / request owner confirmation |
| Cross-audience data disclosure | Privacy / access control | Audience-scoped notification decisions only |
| Ungrounded entity actions | No evidence of subject | Do not propose; or propose data-gap fill |
| Bypassing blocked gate | Integrity | Review-only items |
| Autonomous multi-agent execution without policy budget | Blueprint §17 | Coordinator proposes; human approves |
| Vendor-shaped actions | Anti-corruption | Normalise first, then decide in SPP vocabulary |

**Decision:** Forbidden is enforced in the engine authority classifier, not merely omitted from UI. **Rationale:** Hidden UI still leaves API risk. **Consequence:** Service and client must share the same authority rules.

---

# 12. Business Rules Engine

The business-rules plane is the **deterministic** half of decision generation (Engine Vision layer 1; Blueprint §2.2).

| Responsibility | Examples | Must not |
|---|---|---|
| Arithmetic & dates | Arrears, ageing, renewal windows | Interpret free-text notes as math |
| Status legality | Contract/ticket transitions that imply action | Invent statuses |
| Eligibility | Whether collection recommendation is ledger-quality-safe | Soften gate blocks |
| Dedup keys | Real-world action identity for unification | Collapse unrelated subjects |
| Risk defaults by kind | Baseline risk for payment vs reminder | Override owner-raised risk without record |

**Decision:** Business rules stay separated from AI understanding and from LLM explanation. **Rationale:** Engine Vision; numbers must be defensible. **Consequence:** Rule changes that only fit one owner file are engine-maturity failures (Blueprint §16.1).

**Decision:** Rules emit candidates into the same unifier as other sources. **Rationale:** One agenda. **Consequence:** No parallel “rules-only” owner inbox.

---

# 13. AI Reasoning Flow

AI reasoning supports understanding and explanation; it does not replace deterministic judgement for money.

| Step | Allowed AI role | Output constraint |
|---|---|---|
| Structure / note understanding | Clarify ambiguous text into candidate signals | Signals marked as inference until verified |
| Evidence assembly assist | Help select relevant knowledge slices | Slices must exist in trusted inputs |
| Explanation | Owner-language why/outcome phrasing | Validated; no invented numbers/entities/decisions |
| Ranking hints | Preference-informed ordering suggestions | Final score still gate-aware and rule-constrained |

Controlled interpretation guardrails: Blueprint §6.3. Koil layers: Engine Vision. AI Employee placement: System Architecture §4.

**Decision:** Reasoning flow consumes verified analysis/knowledge, never raw uploads. **Rationale:** Guardrails and privacy. **Consequence:** Prompt construction is an architecture concern owned jointly with Data Architecture privacy classes.

**Decision:** On AI failure, deterministic agenda remains. **Rationale:** Availability contract (System Architecture §4.4). **Consequence:** Decision Engine is never “down” solely because LLM is down.

---

# 14. Confidence Scoring

| Confidence source | Effect |
|---|---|
| Generator self-assessment | Initial confidence |
| Data quality flags | Reduce confidence when completeness/consistency poor |
| Consistency gate | Authoritative ceiling: Ok / Warning / Blocked (Blueprint §13.2) |
| Prediction confidence | When decision escalates from prediction, inherit capped confidence |
| Owner history (target) | Adjust ranking weight, not fabricated certainty |

**Decision:** Gate confidence is authoritative over generator optimism. **Rationale:** Blueprint §18 gate decision. **Consequence:** Read models and agenda reapply gate at read time so stale confidence cannot survive.

**Decision:** Confidence is visible to the owner. **Rationale:** Trust. **Consequence:** Hiding confidence on executive surfaces is a defect.

Entity-aware blocking rules remain Blueprint §13.2 — this document does not redefine them.

---

# 15. Recommendation Engine

“Recommendation Engine” is the **proposal surface** of the Decision Engine: ranking, packaging, and presentation of the unified list — not a second product.

| Function | Requirement |
|---|---|
| Packaging | Constitution fields always present |
| Ranking | Score + priority + tier + risk + preferences |
| Deduplication | One card per real-world action |
| Financial impact | Shown when computable from deterministic facts |
| Review mode | Blocked items appear as review recommendations |
| Explainability hooks | Evidence links to entities and asserting batch/event |

**Decision:** Recommendations are Decisions in `proposed` (or review) state, not free-text chatbot tips. **Rationale:** Auditability and Domain Model. **Consequence:** Chat answers that suggest actions must cite or create Decision identities when actionable.

---

# 16. Conflict Resolution

Conflicts appear at three layers:

| Layer | Conflict type | Resolution authority |
|---|---|---|
| Data truth | Official vs import vs platform vs inference | Blueprint §14.3 / Data Architecture |
| Gate | Cross-fact contradictions in analysis | Gate verdict; entity-aware block/warn |
| Decision agenda | Two generators propose incompatible actions on one subject | Unification + coordinator rules; escalate trade-off to owner |

**Decision:** Engines do not vote away owner-visible disagreements on high-risk trade-offs. **Rationale:** Blueprint §17.4 conflicts escalate. **Consequence:** Present structured alternatives with evidence rather than silent winner.

**Decision:** Unification merges only candidates describing the **same** real-world action. **Rationale:** Over-merge hides distinct work. **Consequence:** Dedup keys are load-bearing architecture (Blueprint §18).

---

# 17. Multi-Decision Coordination

| Rule | Statement |
|---|---|
| One agenda | All categories appear in one ranked list |
| One proposer per subject per cycle | Specialists may read widely; only one proposes action on a subject |
| Dependency awareness (target) | e.g. fix data-quality before collection on same unit when gate blocked |
| Batch coherence | Import-derived decisions share analysis provenance |
| No priority inversion via side channels | Portal or chat cannot approve a lower-ranked forbidden path |

Multi-agent coordinator model: Blueprint §17; System Architecture §16.

**Decision:** Coordination optimises clarity for the owner, not throughput of autonomous actions. **Rationale:** Product identity. **Consequence:** Parallel specialist proposals are merged before owner presentation.

---

# 18. Event-Driven Decisions

| Trigger | Engine behaviour | Status |
|---|---|---|
| Applied import | Regenerate/unify import & lifecycle candidates; gate; refresh agenda | Implemented |
| SmartEvent intake | Interpret → candidate or pending action | Partial |
| Ticket state change | Maintenance candidates | Partial |
| Approval / dismiss | Learning + agenda refresh | Implemented / Partial |
| Snooze due | Reopen decision | Implemented pattern |
| Prediction threshold cross | Escalate Prediction → Decision | Partial / Planned |
| Future bus topics | Decision Engine as consumer | Planned (Blueprint §12) |

**Decision:** Event-driven generation still passes unification, scoring, gating, and authority classification. **Rationale:** Events are inputs, not execution licenses. **Consequence:** Webhook handlers must not short-circuit to dispatch.

---

# 19. Predictive Decisions

| Rule | Statement |
|---|---|
| Separation | `Prediction` describes likely future; `Decision` proposes action |
| Escalation | Only when action is warranted and evidence supports it |
| Honesty | Predictive decisions disclose horizon and uncertainty |
| Evaluation | Accuracy feedback returns to knowledge (Domain Model) |
| No silent act | Prediction never self-executes |

**Decision:** Predictive decisions inherit capped confidence and remain gate-bound. **Rationale:** Forward-looking claims are easier to overfit. **Consequence:** High-impact predictive money actions stay human-approval + high evidence bar.

Status: Partial.

---

# 20. Financial Decisions

| Includes | Constraints |
|---|---|
| Arrears collection sequences, settlement proposals, payment confirmation, recharge preparation | Numbers from deterministic ledger facts only |
| Expected financial impact on the decision | Computable from trusted inputs; else omit rather than invent |
| Utility/rent payment preparation | Prepare-not-send; rail may be absent |

**Decision:** Financial decisions are human-approval by default and forbidden when ledger quality/gate blocks collection claims. **Rationale:** Blueprint §10.4 collection rule; money trust. **Consequence:** Review items replace collection pushes when data is contradictory.

---

# 21. Maintenance Decisions

| Includes | Constraints |
|---|---|
| Technician assignment proposals, preventive work, replace-vs-repair, follow-ups | Evidence from tickets, costs, asset memory, warranties |
| Tenant-affecting notices about work | Audience-scoped preparation |

**Decision:** Replace-vs-repair must cite asset memory economics when available; otherwise mark confidence limited. **Rationale:** Avoid confident capex advice without history. **Consequence:** Missing asset memory yields data-gap or low-confidence maintenance decisions, not fake ROI.

Sensors as inputs remain Placeholder/Partial per Blueprint integration inventory.

---

# 22. Leasing Decisions

| Includes | Constraints |
|---|---|
| Renewal pricing suggestions, vacancy marketing next steps, expiry notices, transfer handling | Contract and occupancy facts; lease registry events after ACL |
| Official lease status assertions | Platform domain only; do not overwrite owner official records blindly |

**Decision:** Lease-registry events create candidates via Operations Center, not direct registry mutation. **Rationale:** Domain Model context boundaries. **Consequence:** Ejar-like notices become SmartEvents before Decision generation.

---

# 23. Utility Decisions

| Includes | Constraints |
|---|---|
| Pay-bill preparation, anomaly follow-up, responsibility transfer proposals | Utility events normalised; payment rail may be absent |
| Consumption anomaly claims | Require meter/event evidence; else data-quality path |

**Decision:** Utility payment decisions stop at prepared instructions until owner-enabled payment rails exist. **Rationale:** Blueprint §13.3. **Consequence:** Delivery state remains awaiting rail; not “paid.”

---

# 24. Emergency Decisions

| Includes | Constraints |
|---|---|
| Safety hazards, urgent building incidents, critical access issues | Highest priority tiers; critical risk; human approval mandatory |
| Rapid owner alert preparation | Still prepare-not-send unless emergency rail explicitly enabled by policy |

**Decision:** Emergency speed does not create a bypass of evidence, audience scoping, or audit. **Rationale:** Crisis is when wrong messages hurt most. **Consequence:** Emergency policy may shorten snooze defaults and raise ranking, not delete approval/audit.

**Decision:** Insufficient evidence ⇒ forbidden execution, allowed urgent data-gathering decisions. **Rationale:** §11. **Consequence:** “Something might be wrong” becomes investigate/confirm, not fabricate action.

---

# 25. Portfolio Decisions

| Includes | Constraints |
|---|---|
| Cross-property attention shifts, concentration risks, portfolio-level collection health | Aggregations from knowledge; preserve per-entity provenance where actions land |
| Policy suggestions (e.g. tighten renewal window) | Remain recommendations; do not auto-rewrite owner policy stores without approval |

**Decision:** Portfolio-level cards that imply unit-level action must explode into subject-scoped decisions before execution. **Rationale:** One subject proposer rule; audit clarity. **Consequence:** “Fix arrears portfolio-wide” is a parent framing plus child decisions per tenant/unit.

---

# 26. Executive Decisions

| Includes | Constraints |
|---|---|
| Top recommendation for brief/report, strategic follow-ups, forecast commentary tied to actions | Numbers from engines; gate-aware narrative |
| Owner dashboard verdicts | Reapply gate; blocked ⇒ review language |

Executive Report pipeline ownership: Blueprint §10; System Architecture §8. Decision Engine supplies recommendation slices and decision identifiers that survive gate rewriting.

**Decision:** Executive storytelling cannot invent decisions not present in the unified list. **Rationale:** Traceability. **Consequence:** Brief “top decision” must reference a real decision id.

---

# 27. Decision Memory

| Memory content | Use | Status |
|---|---|---|
| Proposed / approved / prepared / rejected / followed | Ranking and audit | Partial |
| Edits to prepared content | Learn owner voice and constraints | Partial |
| Outcomes after delivery (target) | Close the loop on effectiveness | Planned |
| Preference weights | Tier/ordering habits | Planned / Partial |

Storage stewardship: Data Architecture §7 / §15. Knowledge Graph decision memory layer: Blueprint §11.1.

**Decision:** Decision memory is cumulative and append-oriented. **Rationale:** Learning and disputes. **Consequence:** Overwriting approval history is forbidden.

---

# 28. Decision Audit Trail

Minimum reconstructable trail for every consequential decision:

1. Trigger source and time  
2. Input provenance (analysis id / event id / entities)  
3. Generator(s) and unification key  
4. Score, priority, tier, risk, confidence pre/post gate  
5. Gate verdict and conflict codes  
6. Authority class  
7. Owner (or agent) judgement with actor identity  
8. Exact prepared content  
9. Delivery state transitions  
10. Learning signals recorded  

**Decision:** Audit trail is a product requirement, not only ops logging. **Rationale:** Data Architecture §19; System Architecture observability. **Consequence:** “We showed a toast” is insufficient evidence of approval.

---

# 29. Decision Explainability

Explainability is mandatory for owner trust.

| Layer | Explains | Constraint |
|---|---|---|
| Structured fields | Why, evidence, outcome, risk | Always present |
| Evidence links | Which facts/entities/batch | Must resolve |
| Gate explanation | Why capped or blocked | Owner-readable |
| Language explanation | Narrative assist | Validated; fallback deterministic |
| Counterfactual (target) | What would change the recommendation | Must not invent data |

**Decision:** Explainability attaches to Decision identity, reusable in desk, report, and audit. **Rationale:** One truth of why. **Consequence:** Per-screen one-off reasons that diverge from the decision record are defects.

---

# 30. Decision Learning Loop

| Signal | Learning effect (allowed) | Learning effect (forbidden) |
|---|---|---|
| Approve | Increase similar ranking weight | Auto-approve next time |
| Edit | Prefer edited phrasing/constraints | Change deterministic money rules silently |
| Dismiss | Down-rank similar or mark condition handling | Delete evidence that problem existed |
| Snooze | Timing preference | Treat as permanent reject |
| Outcome success/fail (target) | Adjust expected-impact models | Fabricate outcomes |

**Decision:** Learning updates preference/ranking memory and client-profile understanding — not global one-off rules for a single file. **Rationale:** Engine Vision learning layer. **Consequence:** “Fix for owner A’s spreadsheet quirk” becomes profile memory or general rule — never hidden hardcode.

---

# 31. Feedback Integration

| Feedback channel | Integration point |
|---|---|
| Desk approve/edit/dismiss/snooze | Immediate learning signals + agenda refresh |
| Executive report acceptance of recommendations | Memory linkage by decision id |
| Portal-originated facts (payment proof, ticket notes) | Become inputs after validation/owner confirm where required; may invalidate or strengthen decisions |
| Integration event resolution | Close or morph related decisions |
| Prediction accuracy scoring | Adjust escalation thresholds |

**Decision:** Feedback must be attributable to decision identity whenever actionable. **Rationale:** Otherwise learning cannot be audited. **Consequence:** Free-text chat feedback is captured as notes until bound to a decision.

---

# 32. Owner Override Rules

| Override | Engine behaviour |
|---|---|
| Dismiss | Decision closes as dismissed; signal retained; may regenerate only if new evidence appears |
| Edit then approve | Prepared content uses edited form; edit diff retained |
| Snooze | Hidden until due; identity preserved |
| Official data correction | Truth changes; dependent decisions re-gate/regenerate |
| Policy / permission change | Authority class and agent scope re-evaluated |
| Force review | Owner may escalate item to review even if Ok |

**Decision:** Override never erases audit of what the engine originally proposed. **Rationale:** Learning and accountability. **Consequence:** Original proposal and final approved content both retained.

**Decision:** Override cannot compel forbidden classes (§11). **Rationale:** Safety/integrity. **Consequence:** Owner who needs an exceptional act must change inputs/policy through governed paths, not “approve forbidden.”

---

# 33. Decision Governance

| Governance rule | Effect |
|---|---|
| This document is the decision-capability SSOT under `docs/` | Implementations conform or record DE-* gaps |
| Gate semantics changes require Blueprint revision | No silent softening |
| Expanding automatic authority requires amendment here + Constitution check | Prevent autonomy drift |
| New decision category needs category registry update (§6) + privacy review | Prevent shadow agendas |
| Multi-agent proposal protocols obey Blueprint §17 | Coordinator remains singular to owner |
| Smart Import protection remains intact | Decision generation must not demand sheet/column renames |
| Executive reporting capability must not shrink | Recommendations remain reportable |

Change control also follows Architecture Governance §7.

---

# 34. Performance Requirements

Architectural targets (not implementation SLAs):

| Concern | Requirement |
|---|---|
| Interactive agenda refresh | Owner desk remains usable; prefer incremental unify over full opaque stalls |
| Import-linked generation | Completes as part of analysis pipeline before preview/apply presentation needs |
| Gate reapplication on read | Cheap enough to prevent stale confident views |
| Explanation path | Deterministic fallback within interactive budget when LLM slow/down |
| Audit write | Approval persistence is durable before UI claims success |
| Degraded mode | Local/deterministic candidates still available offline per System Architecture |

**Decision:** Correctness and gate honesty outrank micro-optimised ranking. **Rationale:** Trust product. **Consequence:** Caching of agendas must invalidate on gate/analysis/event versions (Data Architecture cache rules).

Numeric latency SLOs remain **Planned** jointly with System Architecture monitoring gaps.

---

# 35. Scalability Strategy

| Dimension | Strategy | Prerequisite |
|---|---|---|
| More properties/units | Subject-scoped generation; bounded evidence retrieval | Knowledge graph query patterns |
| More events | Event envelope + worker consumers for regeneration | Blueprint §12 migration |
| More generators / agents | Coordinator unification; one proposer per subject | Blueprint §17 phases |
| More owners | Stateless API scale; durable decision/approval stores | Data Architecture durability |
| More LLM explain volume | Optional, capped, cache-by-verified-context-hash | Guardrails remain on |

**Decision:** Scale by partitioning work on subject and batch keys, not by dropping unification. **Rationale:** One agenda is load-bearing. **Consequence:** Sharding that produces multiple owner agendas is rejected.

---

# 36. Future Evolution

| Horizon | Outcome |
|---|---|
| Stabilize | Universal authority classifier; durable decision memory; no blocked approvals |
| Event-native | Decision Engine as first-class consumer of unified envelope |
| Learning maturity | Preference + outcome loops with measurable ranking quality |
| Predictive maturity | Evaluated escalations from Prediction → Decision |
| Multi-agent | Specialist generators under coordinator; still one approval plane |
| Policy budgets | Owner-defined limited automatic class for narrow internal effects only |
| Rails | Messaging/payment execution with outbox; delivery learning |

Autonomy increases **proposal quality** only, until Constitution and this document explicitly expand automatic authority.

---

# 37. Architectural Gaps

| ID | Gap | Impact | Direction | Status |
|---|---|---|---|---|
| DE-01 | Automatic authority class not fully policy-codified beyond “mostly human” | Risk of ad-hoc automation | Codify allowlist in §9 with product-owner ratification | Open |
| DE-02 | Outcome feedback after delivery incomplete | Learning loop weak | Capture delivery outcomes into decision memory | Open |
| DE-03 | Preference memory underspecified in runtime stores | Ranking learning limited | Align with Data Architecture AI memory gaps | Open |
| DE-04 | Event-bus-driven regeneration not implemented | Pull-only freshness | Unified envelope + worker consumers | Open (depends Blueprint §12) |
| DE-05 | Predictive escalation thresholds not standardised | Inconsistent Prediction → Decision | Define per scenario family with evaluation | Open |
| DE-06 | Emergency policy rail undefined | Urgency may pressure prepare-not-send | Explicit emergency communication policy | Open |
| DE-07 | Cross-decision dependency graph limited | Owners see conflicting order of operations | Dependency-aware coordination (§17) | Open |
| DE-08 | Numeric performance SLOs absent | Hard to manage desk latency | Define with System Architecture monitoring | Open |
| DE-09 | Agent delegation matrix for approvals incomplete as data | Over/under permission risk | Explicit decision kinds ↔ permission map | Open |
| DE-10 | Counterfactual explainability not designed | Weaker owner teaching | Optional explain layer without invented facts | Open |
| DE-11 | Multi-agent coordinator not runtime-realised | Still generalist employee | Blueprint §17 phased rollout | Open |
| DE-12 | `DATA_ARCHITECTURE.md` cross-link lag while that document was on a parallel track | Temporary index/companion lag | Reconciled by rebasing onto Data Architecture tip / latest docs set | Closed |

Gaps already owned by Blueprint §19 or System Architecture SA-* / Data Architecture DA-* are not forked; DE-* deepens Decision Engine concerns or records dependence.

---

# 38. How implementers must use this document

1. What a Decision entity means → Domain Model §5.15.  
2. Pipeline stages / gate ceilings / prepare-not-send → Blueprint §13.  
3. Whether a recommendation may exist, auto-act, or is forbidden → **this document**.  
4. Where decisions sit in system topology / HA → System Architecture.  
5. How decision memory/audit are stored and retained → Data Architecture.  
6. Whether the change serves the Property Employee → Constitution.  
7. Document process → Architecture Governance.  
8. New gap → add DE-*; do not silently expand automatic authority.

---

# 39. Document status

*Document Status:* Official Decision Engine Architecture Specification

*Version:* 1.0

*Class:* Supporting architecture (core Decision Engine) under `docs/`

*Project:* Smart Property Platform (SPP)

*Pillars:* `docs/SPP_CONSTITUTION.md`, `docs/DOMAIN_MODEL.md`, `docs/SPP_BLUEPRINT.md`

*Sibling enterprise documents:* `docs/SYSTEM_ARCHITECTURE.md`, `docs/DATA_ARCHITECTURE.md`, `docs/OPERATION_CENTER.md`, `docs/KNOWLEDGE_BASE.md`, `docs/AI_PROPERTY_EMPLOYEE.md`, `docs/MULTI_AGENT_ARCHITECTURE.md`

*Governance / index:* `docs/ARCHITECTURE_GOVERNANCE.md`, `docs/README.md`

*Change policy:* Authority classes, forbidden decisions, learning boundaries, category registry, and DE-* gaps in this document are normative for decision-capability work. Gate semantics and Smart Import behaviour remain Blueprint authority. Entity meaning remains Domain Model authority. Expanding silent automation requires Constitution-aligned amendment of §§9–11 and §33.
