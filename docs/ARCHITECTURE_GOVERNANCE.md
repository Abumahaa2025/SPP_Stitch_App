# SPP Architecture Governance v1.1

> Official governance for all architectural truth in the Smart Property Platform (SPP).
> This document does not redefine product law, domain language, or structural design.
> It defines how architectural documents are authored, ranked, linked, approved, and changed.

---

# 1. Mandate

From the moment of adoption of this document, architectural work on SPP is treated as **formal product law**, not informal notes.

- Every architectural document created under this governance is an **official project reference**.
- Architectural documents contain **no implementation code**, no sample payloads, no API request bodies, and no executable snippets.
- Future development must conform to the documents under `docs/` as the **Single Source of Truth (SSOT)**.
- Implementation must not begin for a capability until the relevant architectural baseline for that capability is complete and approved under §7.

This governance is subordinate to the three pillars defined in §3. It cannot override them; it only regulates how they are maintained and how additional documents attach to them.

---

# 2. Single Source of Truth

## 2.1 Location

| Rule | Statement |
|---|---|
| Canonical home | All architectural truth lives under `docs/`. |
| Pillar documents | Constitution, Blueprint, and Domain Model must reside in `docs/`. |
| Root stubs | If a historical path remains at the repository root, it may only redirect to the canonical `docs/` path. It must not carry independent content. |
| Non-docs material | `HANDOFF.md`, `AGENTS.md`, `memory/`, `proofs/`, and similar operational notes are **not** architectural law unless explicitly promoted into `docs/` through the approval process in §7. |

## 2.2 Precedence when documents disagree

| Rank | Document | Wins on |
|---|---|---|
| 1 | `docs/SPP_CONSTITUTION.md` | Product identity, what SPP is and is not, AI and decision philosophy |
| 2 | `docs/DOMAIN_MODEL.md` | Entity names, responsibilities, relationships, lifecycles, ubiquitous language |
| 3 | `docs/SPP_BLUEPRINT.md` | Layers, pipelines, engines, integrations, topology, prepare-not-send, gate semantics |
| 4 | Supporting architecture under `docs/` | Narrower subjects that expand a pillar without restating it |
| 5 | Operational / audit / proof notes | Execution history only; cannot redefine architecture |

A lower-ranked document that contradicts a higher-ranked document is **invalid until revised**. Discovery of such a contradiction must be recorded as an Architecture Gap (§6), not silently preferred.

---

# 3. The three pillars

SPP is governed by three independent pillars. None replaces or absorbs another.

| Document | Question | Authority |
|---|---|---|
| `docs/SPP_CONSTITUTION.md` | Why SPP exists and what it must never become | Product law |
| `docs/DOMAIN_MODEL.md` | What the system is made of | Ubiquitous language |
| `docs/SPP_BLUEPRINT.md` | How the system is structured | Structural authority |

Cross-links between pillars are mandatory. Restating another pillar's content is forbidden. When a supporting document needs a fact owned by a pillar, it links to the owning section.

Detailed structure and status legends remain in the Blueprint and Domain Model; this governance does not duplicate them.

---

# 4. Document classes under `docs/`

| Class | Role | May redefine pillars? | Code allowed? |
|---|---|---|---|
| Pillar | Constitution, Domain Model, Blueprint | N/A — they are the law | No |
| Supporting architecture | System architecture, data architecture, engine vision, merge-gate intent, quality architecture expansions | No — only deepen a scoped concern | No |
| Operating path | End-to-end path maps used by delivery teams | No | No architectural code; may name routes and modules as references only when unavoidable |
| Audit / proof companion | Historical findings, continuation notes, beta install notes | No | Prefer linking to proofs outside `docs/` |
| Index / governance | This document and `docs/README.md` | No — regulate process only | No |

Documents that describe temporary engineering fixes belong in audit/proof class and must not be mistaken for target architecture.

---

# 5. Writing rules for architectural documents

1. **Official voice.** Write as binding reference: normative language for rules, descriptive language for current versus target state.
2. **No code.** No programming language blocks, no pseudo-implementation that could be pasted into a repository file, no vendor SDK samples. Conceptual stage tables and mermaid flowcharts of product flow are allowed when they clarify boundaries.
3. **No duplication.** State a fact once, in the document that owns it. Elsewhere, link.
4. **Extensibility first.** Every architectural decision must remain valid when SPP grows from a single AI Employee into multi-agent Operations Center capabilities described in the Blueprint.
5. **Identity protection.** Decisions must reinforce SPP as a Property Operations Platform — not a traditional property-management app, chatbot, CRM, or dashboard-only product. See Constitution §§3–5.
6. **Status honesty.** Use the Blueprint/Domain Model status legend (Implemented / Partial / Placeholder / Planned). Do not mark a surface as live when only configuration UI exists.
7. **Gaps are first-class.** Conflicts and missing design must be written into §Architecture Gaps of the relevant document, with a proposed resolution. Silence is not allowed.
8. **Smart Import and Sheets freeze.** Supporting docs must not propose renaming sheets, columns, or sheet identities, and must not alter Smart Import mapping unless the document's explicit subject is a governed Smart Import change.
9. **Executive reporting preserved.** No architectural change may reduce Executive Report, AI analysis, Owner Dashboard, or predictive insight capability.
10. **AI proposes; humans approve.** Approval remains a modeled state. Documents must not introduce silent autonomous execution paths.

---

# 6. Official naming — AI Employee

## 6.1 Conflict discovered

| Term in circulation | Where it appears | Problem |
|---|---|---|
| AI Employee / Intelligent Property Employee / Property Employee | Constitution, Blueprint | Canonical product role |
| Koil | Engine Vision, parts of operating path | Engine / intelligence brand |
| Kowil | Agent notes, local brain references, some audits | Historical spelling variant |
| Smart Employee | Screens, desk naming, `smart-employee/` folder product copy | Surface name and a separate-folder product claim |

## 6.2 Normative resolution

| Term | Official meaning | Usage rule |
|---|---|---|
| AI Employee | The product role: virtual property employee that proposes, explains, and learns; never approves | Use in Constitution-aligned product and architecture prose |
| Koil | The intelligence system behind the AI Employee (understanding, knowledge, reasoning, learning layers) | Use when discussing engine layers; see `docs/SPP_ENGINE_VISION.md` |
| Kowil | Deprecated spelling of the on-device deterministic fallback of Koil | Allowed only as a historical alias until implementation rename; new documents must write **Koil** |
| Smart Employee desk | Owner-facing workplace surface of the AI Employee | UI surface name only; not a second product constitution |

## 6.3 `smart-employee/` folder — adopted decision (Option A)

**Status:** Adopted by product-owner decision (Option A) · 2026-08-07 · closes gap G-03

Earlier copy described `smart-employee/` as an independently branded product. That claim conflicted with Constitution §§3–5 and Identity Protection.

**Normative resolution (Option A):**

1. `smart-employee/` is an **experimental Arabic delivery surface** for locale (RTL), clarity, and Saudi daily-use presentation — **not** a second product and **not** a second constitution.
2. `docs/SPP_CONSTITUTION.md` remains the **only** product law. SPP identity as a Property Operations Platform is not optional and is not forked.
3. A lasting brand split, if ever intended, requires an **explicit Constitution amendment** before any divergent product law is written. Until then, architecture, engines, Domain Model, and reporting capability remain shared SPP assets.
4. The surface must not invent divergent ubiquitous language. Entity names and meanings stay those of `docs/DOMAIN_MODEL.md`.
5. Visual exploration on this surface (for example a lighter daily-use palette) is a **Presentation experiment** only. It does not redefine SPP brand law for `frontend/`, and it does not authorize a second platform roadmap.

Consequence: onboarding, PRs, and future documents must describe `smart-employee/` as an experimental SPP surface, never as a competing product.

---

# 7. Approval and change control

## 7.1 Baseline completeness

The **basic architectural baseline** is complete only when all of the following are true:

1. The three pillars exist under `docs/` and agree with each other.
2. This governance document and `docs/README.md` are adopted.
3. Known Architecture Gaps in §8 of this document are either closed or explicitly accepted with an owner.
4. Supporting documents that claim live status have been reconciled against Blueprint status legends.
5. A product owner or designated architect has recorded adoption (version bump + status line).

Until that baseline is adopted, new feature implementation is deferred; bug fixes and stability work may proceed if they do not invent new architectural boundaries.

## 7.2 Change triggers

| Change type | Required revision |
|---|---|
| Identity, mission, or “SPP is / is not” | Constitution |
| Entity rename, new aggregate, lifecycle change | Domain Model |
| Layer boundary, pipeline stage, gate semantics, prepare-not-send, topology | Blueprint |
| Engine layer philosophy (deterministic / AI understanding / learning) | Engine Vision, with Blueprint cross-check |
| Process for documents themselves | This governance document |

## 7.3 Revision rules

- Increment the document version when normative meaning changes.
- Record conflicts in an Architecture Gaps section before merging a workaround.
- Prefer incremental amendment over rewriting a pillar.
- Pull requests that touch architecture must update links in `docs/README.md` when documents are added, moved, or reclassified.

---

# 8. Architecture gaps discovered at governance adoption

| ID | Gap | Impact | Resolution | Status |
|---|---|---|---|---|
| G-01 | Blueprint and Domain Model lived at repository root while Constitution lived under `docs/` | Broken SSOT; agents and humans followed different homes | Relocate pillars into `docs/`; leave root stubs as redirects only | Closed |
| G-02 | Triple naming: AI Employee / Koil / Kowil | Fragmented ubiquitous language; review confusion | Adopt §6 naming; new documents must not treat Kowil as a separate product | Closed (normative); residual code aliases may remain until a later rename task |
| G-03 | `smart-employee/` claims independent product identity | Risks splitting SPP into two products and diluting Property Operations Platform identity | Option A adopted — §6.3: experimental Arabic SPP surface under one Constitution | Closed |
| G-04 | `docs/APP_PATH.md` marks some integrations as live in ways that may exceed Blueprint Partial/Placeholder status | Delivery teams may trust unfinished rails | APP_PATH defers to Blueprint §§3.2, 8.2 on status | Open — operating path still needs status-column reconciliation |
| G-05 | No prior ADR-style index for decisions outside Blueprint §18 | Decisions can land in chat or PRs without a home | Blueprint §18 remains the decision register; do not scatter | Accepted — owner: architecture |
| G-06 | Operational docs (`HANDOFF.md`, root `README.md`) can outrank pillars in practice | Onboarding drift | `docs/README.md` is the architectural entry point; root README points to it | Closed for root README; HANDOFF remains operational only |
| G-07 | Event bus, outbound rails, longitudinal memory still open (Blueprint §19) | Limits Operations Center maturity | Track only in Blueprint §19; supporting docs must link, not fork | Open — tracked in Blueprint |

---

# 9. Relationship to Clean Architecture and Flutter/mobile discipline

Presentation, Application, Domain, and Infrastructure boundaries are defined in the Blueprint and Domain Model. This governance adds only:

- Business rules never move into UI widgets.
- Domain language never forks per client surface.
- Infrastructure adapters translate; they do not decide.
- New mobile or web surfaces are additional Presentation adapters over the same Application and Domain — never a second domain model.

---

# 10. Document status

*Document Status:* Official Architecture Governance

*Version:* 1.1

*Project:* Smart Property Platform (SPP)

*Pillars:* `docs/SPP_CONSTITUTION.md`, `docs/DOMAIN_MODEL.md`, `docs/SPP_BLUEPRINT.md`

*Index:* `docs/README.md`

*v1.1 change:* Adopted Option A for `smart-employee/` identity (§6.3 / G-03).

*Change policy:* Process, precedence, naming, and SSOT rules in this document are normative. Closing a gap in §8 requires either a pillar amendment or an explicit accepted-risk note in §8 with owner and date.
