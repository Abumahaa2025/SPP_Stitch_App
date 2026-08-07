# SPP Domain Model v1.0

> Official domain model of the Smart Property Platform (SPP).
> Companion document to `docs/SPP_CONSTITUTION.md` and `docs/SPP_BLUEPRINT.md`.
> This is a design document. It defines meaning, responsibility, relationships and lifecycle — not implementation.
> Document process and SSOT rules: `docs/ARCHITECTURE_GOVERNANCE.md`. Index: `docs/README.md`.

---

# 1. Purpose

This document defines the **ubiquitous language** of SPP: the entities every screen, engine, adapter and document must refer to by the same name, with the same meaning.

It exists to answer four questions for every concept in the platform:

1. **Responsibility** — what this concept is accountable for, and what it must never be asked to do.
2. **Core attributes** — the state it owns.
3. **Relationships** — how it connects to the rest of the domain.
4. **Lifecycle** — how it is born, how it changes, and how it ends.

Constitution §9 lists the Property Knowledge the platform maintains. This document is the structural expansion of that list.

---

# 2. Modeling principles

## 2.1 OOP principles applied

| Principle | Application in SPP |
|---|---|
| Encapsulation | An entity owns its state. Nothing outside its aggregate mutates it directly; changes go through the aggregate's operations. |
| Single responsibility | One entity answers one question. `Contract` answers "what was agreed", `Payment` answers "what was actually received". They are never merged. |
| Abstraction | External systems are never modeled as themselves. They enter the domain as `LeasePlatform`, `UtilityAccount`, `Sensor` and `SmartEvent` — SPP vocabulary, not vendor vocabulary. |
| Polymorphism | `Notification`, `SmartEvent` and `Decision` are single concepts with typed variants (`kind` / `channel` / `scenario`), not parallel duplicate classes per source. |
| Composition over inheritance | `Property` composes `Building` composes `Unit`. No class hierarchy of property types; type is an attribute. |
| Immutability where truth matters | Financial and audit records (`Payment`, `SmartEvent`, `ImportJob`) are append-only. Corrections create new records; they never rewrite history. |

## 2.2 DDD building blocks

| Block | Definition in SPP | Examples |
|---|---|---|
| Aggregate Root | Consistency boundary. External code references it by identity only. | `Property`, `Contract`, `MaintenanceTicket`, `AIEmployee`, `ImportJob` |
| Entity | Has identity and a lifecycle, lives inside an aggregate. | `Unit`, `Payment`, `Decision`, `Technician` |
| Value Object | No identity, defined entirely by its values, replaced rather than edited. | Money amount, date range, meter reading, permission set, confidence score |
| Domain Event | An immutable fact that already happened. | `SmartEvent`, `Operation` entries |
| Repository | The only way to load and persist an aggregate. | Device stores (`spp.*` keys), Mongo collections, Google Sheets adapters |
| Anti-Corruption Layer | Translates foreign models into SPP language before they touch the domain. | Integration adapters (lease registry, utilities, platform inbox, Google Apps Script) |
| Read Model / Projection | Derived, disposable view built for a screen or report. Never a source of truth. | Operational contract views, executive report, daily brief |

## 2.3 Non-negotiable modeling rules

1. **Business logic never lives in UI widgets.** Presentation renders; Application orchestrates; Domain decides; Infrastructure persists.
2. **Truth has a source.** Every fact carries provenance: which import, which platform, which human confirmed it.
3. **Imported data merges, never replaces.** Manual official corrections outrank statement re-imports.
4. **AI proposes, the owner disposes.** No `Decision` executes itself; approval is a modeled state.
5. **Reporting capability is never reduced.** Any entity change must keep Executive Reports, AI analysis and predictive insight possible.
6. **Smart Import compatibility is protected.** CSV, Excel, Google Sheets and historical imports must keep mapping into these entities unchanged.

---

# 3. Bounded contexts

SPP is one product with several bounded contexts. The same word can mean different things in different contexts; the mapping below is the contract between them.

| Context | Owns | Core entities |
|---|---|---|
| Property Registry | Physical and legal structure of the portfolio | `Owner`, `Property`, `Building`, `Unit` |
| Leasing | Who occupies what, under which agreement | `Tenant`, `Contract` |
| Finance | Money owed, money received, money billed | `Payment`, `Invoice` |
| Maintenance Operations | Asset condition and repair work | `Maintenance`, `MaintenanceTicket`, `Technician` |
| Intelligence | Understanding, judgement and foresight | `AIEmployee`, `Decision`, `Prediction`, `KnowledgeBase` |
| Operations Center | Everything that happens, in order | `Operation`, `SmartEvent`, `Notification` |
| Ingestion | Turning owner files into portfolio truth | `ImportJob` |
| External Integrations | Regulated and metered outside world | `LeasePlatform`, `UtilityAccount`, `Sensor` |

**Context relationships:** Ingestion feeds Property Registry, Leasing and Finance. External Integrations feed Operations Center only — never the registry directly. Intelligence reads all contexts and writes only `Decision`, `Prediction` and `KnowledgeBase`.

## 3.1 Aggregate map

| Aggregate Root | Contained entities and value objects |
|---|---|
| `Owner` | Portfolio membership, ownership shares |
| `Property` | `Building`, `Unit`, occupancy snapshot, service responsibilities |
| `Contract` | Rent terms, deposit, renewal state, payment schedule |
| `Tenant` | Contact identity, portal access token, official-record flags |
| `Payment` (ledger) | Monthly ledger rows, settlements, tenant-submitted proofs |
| `MaintenanceTicket` | Timeline events, media, cost proposal, tenant approval |
| `ImportJob` | Analysis artifacts, change log, apply commit |
| `AIEmployee` | Tasks, preferences, activity log |
| `Decision` | Evidence, gate verdict, approval record |

## 3.2 Layer mapping (Clean Architecture)

| Layer | Contains | Must not contain |
|---|---|---|
| Presentation | Screens, components, portal pages | Any rule that decides money, status or eligibility |
| Application | Hooks, stores, engines, workflows, orchestration | Storage details, vendor payload shapes |
| Domain | Entities, value objects, invariants, state machines, domain events | Framework or transport concerns |
| Infrastructure | API clients, adapters, storage keys, sheet/webhook bridges | Business decisions |

---

# 4. Identity conventions

| Concept | Identity rule | Reason |
|---|---|---|
| Imported property | Stable primary identity reused across imports | Re-importing a statement must update, not duplicate |
| Imported contract | Derived from unit identity | Same unit keeps one contract lineage |
| Ledger row | Derived from tenant identity plus month key | A month can be corrected but never duplicated |
| Tenant card from analysis | Composite of unit, contract, phone and name | Statements rarely carry a stable tenant id |
| Import analysis | Analysis identifier issued at upload, reused at apply | Links preview, apply, audit and AI state |
| Integration event | Source identifier plus source name | Idempotent webhook ingestion and deduplication |
| Portal actor | Opaque token separate from the record identity | Revoking access must not delete the person |

**Rule:** identity is assigned at creation and never reused for a different real-world thing, even after deletion.

---

# 5. Entity catalog

Each entry states classification, context, responsibility, core attributes, relationships, lifecycle and invariants, followed by implementation status.

Status legend — **Implemented**: exists as a first-class type today. **Partial**: exists as fields, DTOs or projections without a first-class model. **Planned**: defined here as target design, not yet modeled in code.

---

## 5.1 Property

**Classification** Aggregate Root · **Context** Property Registry · **Status** Implemented

### Responsibility
Represents one managed real-estate asset as the owner thinks about it: a named portfolio item in a city with a known number of buildings and units. It is the anchor for occupancy, revenue and reporting, and the root under which all physical structure hangs.

It is not responsible for lease terms, money movement, or repair work.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable portfolio-wide identifier, preserved across imports |
| Name | Owner-facing label used in reports and messages |
| Type | Residential, commercial, mixed, land, other |
| Location | City and district |
| Building count | Declared number of buildings |
| Unit count | Declared number of units (target for setup completeness) |
| Created at | First registration timestamp |
| Health indicators | Derived occupancy and collection quality (projection, not stored truth) |

### Relationships
- One `Owner` owns one or more properties; ownership may be shared.
- One `Property` contains zero or more `Building` records; contains one or more `Unit` records (directly when buildings are not modeled).
- Referenced by `MaintenanceTicket`, `Sensor`, `Prediction`, `Decision` and integration events for scoping.
- Aggregated by executive reporting and portfolio KPIs.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Declared | Owner completes property setup, or first import creates it | Property exists with declared counts |
| Enriched | Units, tenants and contracts are added or imported | Setup progress advances |
| Operational | Occupancy and ledger data exist | Eligible for executive reporting and AI decisions |
| Reconciled | Each new statement import merges into the same identity | Counts and district refresh; history preserved |
| Archived | Owner removes the property from active management | Records retained for reporting; excluded from live operations |

### Invariants
- Declared unit count must be reconcilable with actual `Unit` records; divergence is a data-quality finding, never a silent overwrite.
- A property is never deleted while contracts or ledger history reference it.

**Where it lives today** Frontend property state and import apply pipeline; backend portfolio models and canonical ingest.

---

## 5.2 Building

**Classification** Entity · **Context** Property Registry · **Status** Planned

### Responsibility
Represents one physical structure inside a property: the level at which floors, shared services, guards and building-wide maintenance actually make sense. It exists to stop multi-building portfolios from being flattened into a single unit list.

Today the platform stores only a building count on `Property`; this section defines the target model.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable identifier within the property |
| Property reference | Owning property |
| Name or number | Owner-facing building label |
| Floors | Floor count and optional floor labels |
| Unit count | Units contained |
| Shared services | Elevator, parking, central gas, shared meters |
| Common-area responsibility | Who pays for shared consumption and cleaning |
| Commissioned at | Handover or construction reference date |

### Relationships
- Belongs to exactly one `Property`.
- Contains one or more `Unit` records.
- May be watched by building-scoped `Sensor` devices and served by building-scoped `UtilityAccount` records.
- Guards and access actors are assigned per building.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Declared | Property setup or import detects multiple buildings | Building becomes addressable |
| Populated | Units are attached | Occupancy computable per building |
| Serviced | Shared utility accounts and maintenance assets attached | Building-level cost tracking possible |
| Retired | Demolition, sale or transfer out of the portfolio | Historical records preserved |

### Invariants
- A unit belongs to at most one building.
- Building-level shared cost must never be double-counted into unit-level cost.

**Where it lives today** Represented only as a count on the property record and as building-scoped guard personas.

---

## 5.3 Unit

**Classification** Entity · **Context** Property Registry · **Status** Implemented

### Responsibility
The smallest leasable and billable space in the portfolio, and the pivot of nearly every other entity. It owns the physical description, the commercial terms offered for the space, and the service responsibility matrix (who pays electricity, water, internet, gas, maintenance).

It does not own the tenancy itself; that belongs to `Contract`.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable identifier within the property |
| Property / building reference | Structural parent |
| Number | Owner-facing unit number, used as the human key in statements |
| Type | Apartment, shop, office, warehouse, villa, room, other |
| Status | Occupied, vacant, reserved, under maintenance |
| Layout | Rooms, living rooms, bathrooms, kitchen, balcony, area, floor |
| Amenities | Parking, elevator, furnished |
| Rent terms | Rent amount, rent period, payment method, payment due day |
| Service responsibility | Electricity, water, internet, gas, maintenance responsibility |
| Meters | Electricity and water meter references |
| Insurance | Whether insured and insured amount |
| Notes | Free-text operational notes |

### Relationships
- Belongs to one `Property` and, when modeled, one `Building`.
- Occupied by at most one active `Tenant` at a time through one active `Contract`.
- Referenced by `Payment`, ledger rows, `MaintenanceTicket`, `Maintenance` history, `UtilityAccount`, `Sensor` and `Invoice`.
- Contributes to occupancy KPIs and vacancy decisions.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Registered | Manual setup or import row | Unit exists, usually vacant |
| Occupied | Contract activation or statement showing a tenant | Status occupied; rent expectations begin |
| Under maintenance | Ticket that blocks occupancy | Status maintenance; excluded from vacancy marketing |
| Vacated | Contract end, tenant vacate or transfer | Status vacant; churn recorded in unit history |
| Reserved | Commitment before contract start | Status reserved; excluded from vacancy list |
| Retired | Merged, sold or removed | Historical ledger and tickets preserved |

### Invariants
- At most one active contract per unit at any moment.
- Status must be derivable from contracts and tickets; manual overrides must be explainable.
- Rent terms on the unit are an offer; the contract is the agreement and wins on conflict.

**Where it lives today** Frontend unit records and operational unit projections; backend canonical units.

---

## 5.4 Tenant

**Classification** Aggregate Root · **Context** Leasing · **Status** Implemented (dual model)

### Responsibility
The person or company occupying a unit, and the counterpart in every collection, notification and portal interaction. The tenant owns identity and contact reachability, and the official-record flag that decides whether a re-imported statement may overwrite the name.

SPP models two complementary views deliberately:
- **Operational tenant** — the working record shown in screens and used for messaging.
- **Canonical tenant** — the official registry entry with status, source and audit events, protecting manual corrections from statement churn.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable tenant identifier |
| Name | Official name, possibly corrected manually |
| Contact | Phone, email, national identifier |
| Unit reference | Currently occupied unit |
| Move-in date | Start of occupancy |
| Portal access | Portal token, portal link, QR payload, prepared welcome message |
| Official flags | Whether the record is manually confirmed and its source |
| Status (canonical) | Active, vacated, transferred |
| Official rent | Rent used for automated communication when it differs from statement noise |
| Audit trail | Synced, created, updated, rent changed, vacated, transferred, contact ready |

### Relationships
- Occupies one `Unit` through one active `Contract`.
- Owns many `Payment` records and ledger rows.
- Raises `MaintenanceTicket` requests and approves completed work.
- Receives `Notification` and portal messages; identified by a portal access token.
- Subject of collection `Decision` items and arrears `Prediction`.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Discovered | Statement import or manual creation | Tenant exists, linked to a unit |
| Activated | Portal link generated and shared | Tenant can self-serve |
| Confirmed official | Owner corrects and confirms the record | Future imports cannot overwrite the confirmed fields |
| In collection | Ledger shows arrears | Collection tasks and decisions target the tenant |
| Transferred | Moves to another unit | Prior unit vacated, new occupancy opened, history linked |
| Vacated | Contract end or departure detected in statement | Status vacated; portal access revoked; churn recorded |

### Invariants
- A tenant is never silently renamed by an import once marked official.
- Vacating must vacate the unit and close portal access in the same operation.
- Contact reachability is a first-class quality signal: a tenant without a usable phone is a data gap, not a normal state.

**Where it lives today** Frontend tenant records plus the canonical tenant registry with its event log; backend tenant models and analysis tenant cards.

---

## 5.5 Owner

**Classification** Aggregate Root · **Context** Property Registry · **Status** Partial

### Responsibility
The principal the platform works for, and the only actor allowed to approve decisions. The owner owns the portfolio boundary, the approval authority, and the delegation of that authority to agents.

Every automated action ultimately traces back to an owner approval or an owner-configured policy.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable owner identifier |
| Name | Display identity across reports and messages |
| Portfolio value | Aggregated portfolio worth |
| Properties | Owned property references |
| Contact and locale | Reachability and language preference |
| Approval preferences | What may be prepared automatically and what always needs confirmation |
| Delegations | Agents and their permission sets |

### Relationships
- Owns one or more `Property` aggregates.
- Approves `Decision` items; receives `Prediction` and executive reports.
- Delegates scoped permissions to property agents; supervises `Technician` assignment policy.
- Is the default audience for `Notification` escalations.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Onboarded | First login and portfolio setup | Owner context established |
| Configured | Notification and approval preferences set | Automation boundaries defined |
| Operating | Daily approvals, corrections and reviews | Decision history accumulates as learning signal |
| Delegating | Agent added with a permission set | Scoped authority granted, revocable |
| Dormant | No activity or portfolio transferred | Reporting retained, automation paused |

### Invariants
- Approval authority is never inherited by an automated actor.
- Delegated permissions are always a subset of owner authority and always revocable.

**Where it lives today** Backend owner model and owner endpoint, plus owner personas and agent permission sets on the device; imported portfolios currently attach to a single default owner identity.

---

## 5.6 Contract

**Classification** Aggregate Root · **Context** Leasing · **Status** Implemented

### Responsibility
The agreement that makes occupancy legal and rent collectable: who rents which unit, for how long, at what price, with what deposit and special terms. It is the authority for what *should* happen financially; the ledger records what *did* happen.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable contract identifier |
| Contract number | Official or platform-issued reference |
| Tenant and unit references | Parties and subject of the lease |
| Term | Start date and end date |
| Rent amount and period | Monthly, semi-annual or annual pricing |
| Deposit amount | Security held |
| Special terms | Free-text clauses that affect operations |
| Lifecycle status | Active, expiring soon, expired, statement-only appearance, needs official source |
| Payment status | Paid, late, partial, unknown |
| Data status | Confirmed, needs review, incomplete, conflicting |

### Relationships
- Binds exactly one `Tenant` to exactly one `Unit`.
- Generates the expected schedule behind `Payment` ledger rows and `Invoice` issuance.
- Mirrored by `LeasePlatform` records when the lease is registered officially.
- Drives renewal `Decision` items and pricing `Prediction`.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Draft | Terms agreed, not yet effective | Not counted in occupancy |
| Active | Start date reached | Rent expectations generated; unit occupied |
| Expiring soon | End date within the renewal window | Renewal decision proposed to the owner |
| Renewed | Owner approves renewal, possibly repriced | New term; lineage preserved |
| Expired | End date passed without renewal | Unit becomes vacant unless holdover is recorded |
| Terminated early | Vacate, transfer or breach | Deposit settlement and churn record |
| Needs official source | Contract only observed in statements | Flagged as unverified; excluded from legal claims |

### Invariants
- Contract term dates must be coherent (start before end) and must not overlap another active contract on the same unit.
- A contract observed only in a statement is never presented as legally verified.
- Renewal preserves contract lineage; it never orphans payment history.

**Where it lives today** Frontend contract records and derived operational contract views; backend contract models, canonical units and lifecycle decisions.

---

## 5.7 Payment

**Classification** Entity (within the ledger aggregate) · **Context** Finance · **Status** Implemented

### Responsibility
The record of money actually received, and of what remains due per tenant per month. SPP separates three related but distinct records:

- **Payment record** — a real received amount at a real time.
- **Ledger row** — the per-tenant, per-month statement of due, paid and remaining.
- **Tenant submission** — a tenant-declared payment awaiting owner confirmation.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable payment or ledger identifier |
| Tenant and unit references | Who paid, for which space |
| Amount | Received amount |
| Paid at | Real payment timestamp — never the import or apply time |
| Method | Transfer, cash, platform |
| Month key | Statement month the payment settles |
| Due / paid / remaining | Ledger arithmetic for the month |
| Status | Paid, partial, late, unconfirmed, needs review |
| Source | Tenant card, late-payment list, registered payment, settlement |
| Provenance | Import batch reference and conflict note when amounts drift |

### Relationships
- Belongs to one `Tenant` and one `Unit`; settles the expectation created by a `Contract`.
- May be evidenced by an `Invoice` and by tenant-uploaded proof.
- Feeds arrears `Decision` items, collection tasks and revenue `Prediction`.
- Is the primary input to Executive Report revenue and collection-rate sections.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Expected | Contract term generates a due month | Ledger row created with due amount |
| Declared | Tenant submits payment proof through the portal | Submission pending owner confirmation |
| Confirmed | Owner confirms, or a statement reports the payment | Payment record created; remaining recalculated |
| Partially settled | Amount less than due | Status partial; arrears tracking continues |
| Late | Due date passed without settlement | Collection workflow triggered |
| Conflicted | Re-import reports a different amount | Conflict note recorded; owner review requested |
| Closed | Month fully settled or written off | Row frozen as history |

### Invariants
- Payment time is the real payment time; import time is metadata, never the payment date.
- A month has exactly one ledger row per tenant; corrections update that row and log the conflict.
- Remaining is always derived from due minus paid, never entered by hand.
- Ledger history is append-and-correct with audit; it is never silently rewritten by an import.

**Where it lives today** Frontend payment records, monthly ledger and portal payment submissions; backend intake parsing, payment board and collection analytics.

---

## 5.8 Invoice

**Classification** Entity · **Context** Finance · **Status** Planned (property invoicing)

### Responsibility
The formal demand for money issued to a tenant: rent, utilities recharge, penalties or maintenance recharge. It exists so that "what we asked for" is auditable independently of "what we received", which is what makes disputes, VAT handling and formal collection possible.

Today the platform recognises invoices only as an imported document classification and as SaaS subscription invoices; property invoicing is defined here as target design.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable invoice identifier |
| Invoice number | Human and legally usable reference |
| Tenant, unit, contract references | Addressee and subject |
| Line items | Description, quantity, unit price, tax treatment |
| Total and currency | Demanded amount |
| Issue and due dates | Timing of the obligation |
| Status | Draft, issued, partially paid, paid, overdue, cancelled, credited |
| Source | Rent schedule, utility recharge, maintenance recharge, manual |
| Linked documents | Original bill or receipt evidence |

### Relationships
- Issued against a `Contract` for a `Tenant` occupying a `Unit`.
- Settled by one or more `Payment` records.
- May originate from a `UtilityAccount` bill or a completed `MaintenanceTicket` cost.
- Feeds receivables ageing in Executive Reports.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Draft | Schedule or recharge prepared | Not yet an obligation |
| Issued | Owner approves and sends | Obligation active; tenant notified |
| Partially paid | Payment less than total | Balance tracked |
| Paid | Balance reaches zero | Closed |
| Overdue | Due date passed with a balance | Collection decision raised |
| Cancelled or credited | Owner voids or issues a credit note | Original preserved; correction linked |

### Invariants
- An issued invoice is immutable; corrections happen through cancellation or credit notes.
- Invoice totals must reconcile with ledger due amounts for the same period.

**Where it lives today** Document classification during import and utility bill references; subscription invoices exist separately in billing and are out of the property domain.

---

## 5.9 Maintenance

**Classification** Aggregate (asset dossier) · **Context** Maintenance Operations · **Status** Partial

### Responsibility
The standing maintenance knowledge of the portfolio, as opposed to a single repair job. It owns the asset inventory (air conditioners, pumps, elevators, water tanks), their fault history, accumulated cost, warranty and expected lifespan, and the responsibility rules that decide who pays.

It exists so that repeated faults, warranty windows and replace-versus-repair economics become visible instead of being rediscovered ticket by ticket.

### Core attributes
| Attribute | Meaning |
|---|---|
| Asset identity | Stable identifier for the maintained thing |
| Asset name and type | What it is |
| Location | Unit, building or shared area |
| Install date and warranty end | Age and coverage windows |
| Expected lifespan | Basis for life-percentage consumed |
| Fault count | Number of recorded faults |
| Total cost | Cumulative maintenance spend |
| Risk level | Low, medium, high, critical |
| Responsibility rule | Owner, tenant or as defined by contract |
| Life events | Maintenance, fault, payment, utility, contract and note events |

### Relationships
- Attached to a `Unit`, a `Building` or a shared property area.
- Accumulates history from closed `MaintenanceTicket` records.
- Feeds `Prediction` scenarios such as repeat repair and warranty window.
- Contributes expense lines to Executive Reports and to `Invoice` recharge when the tenant is responsible.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Registered | Asset captured during setup or import | Asset becomes trackable |
| Serviced | A ticket closes against the asset | Fault count and cost updated |
| Under warranty | Within warranty window | Repairs routed to the supplier, not billed to the owner |
| At risk | Repeat faults, ageing or cost threshold crossed | Predictive insight raised |
| Replaced | Replacement recorded | Old asset retired, history preserved and linked |
| Decommissioned | Asset removed permanently | Read-only history |

### Invariants
- Maintenance responsibility is resolved from the contract and unit rules before any cost is charged.
- Asset history is cumulative; closing a ticket must never reduce recorded history.
- Shared-asset cost is allocated explicitly, never split implicitly.

**Where it lives today** Canonical assets, life events and canonical maintenance rows in the backend, plus the asset memory graph with risk scoring; the frontend currently consumes it as insight rather than as an editable registry.

---

## 5.10 MaintenanceTicket

**Classification** Aggregate Root · **Context** Maintenance Operations · **Status** Implemented

### Responsibility
One unit of repair work from request to acceptance. It owns the work state machine, the assignment to a technician, the evidence trail (photos, video, notes), the cost proposal and approval, and the tenant's acceptance of the result.

It is the entity that makes maintenance auditable: every state change is timestamped and attributed to an actor.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable ticket identifier |
| Unit and tenant references | Where and for whom |
| Category and priority | Type of work and urgency |
| Description | Reported problem |
| Status | Open, assigned, accepted, en route, in progress, awaiting tenant, closed, reprocess |
| Technician reference | Assigned technician and name snapshot |
| Timeline | Created, assigned, accepted, en route, started, photos uploaded, completed, tenant approved |
| Media | Before and after attachments |
| Cost evaluation | None, proposed, approved, rejected, with amount |
| Tenant approval | Pending, approved, reprocess |
| Responsibility | Who bears the cost |

### Relationships
- Raised against one `Unit`, usually by one `Tenant`.
- Assigned to one `Technician` at a time; reassignment is an event, not an overwrite.
- Closing updates the `Maintenance` asset dossier.
- Emits `Operation` entries and `Notification` messages at each transition.
- Approved cost may generate an `Invoice` recharge line.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Open | Tenant or owner reports an issue | Awaiting assignment |
| Assigned | Owner or AI employee assigns a technician | Technician notified |
| Accepted | Technician accepts the job | Commitment recorded |
| En route | Technician departs | Tenant informed of arrival |
| In progress | Work starts | Evidence collection expected |
| Awaiting tenant | Technician completes and uploads evidence | Tenant asked to approve |
| Closed | Tenant approves | Asset history and cost finalised |
| Reprocess | Tenant rejects the result | Returns to work with the original trail intact |

### Invariants
- Status transitions follow the defined order; skipping states requires an explicit owner override that is itself recorded.
- Cost above the owner-defined threshold cannot be approved by anyone but the owner.
- A closed ticket is immutable; further work opens a linked ticket.

**Where it lives today** Frontend operational tickets with their workflow engine, timeline events and portal-side tenant approval.

---

## 5.11 Technician

**Classification** Entity · **Context** Maintenance Operations · **Status** Implemented

### Responsibility
The field actor who executes maintenance work, with a scoped portal identity, a specialty, and a performance record. The technician entity exists to make assignment a decision based on evidence (specialty, rating, completed jobs) rather than habit.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable technician identifier |
| Name and phone | Contact and dispatch |
| Specialty | Trade classification used for matching |
| Portal access | Token, link, QR payload and active flag |
| Performance | Average rating and completed job count |
| Activity | Created at, last login |

### Relationships
- Assigned to many `MaintenanceTicket` records over time, one active at a time per ticket.
- Interacts with `Tenant` through ticket updates only, never with financial data.
- Feeds assignment `Decision` items and workload `Prediction`.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Registered | Owner adds the technician | Portal link generated |
| Activated | First portal login | Can receive assignments |
| Working | Tickets assigned and executed | Performance record accumulates |
| Rated | Tenant or owner rates completed work | Average rating updated |
| Suspended | Owner deactivates the link | Existing tickets stay, no new work |
| Removed | Technician leaves | History preserved and anonymised where required |

### Invariants
- Portal access is revocable without deleting the work history.
- A technician sees only the tickets assigned to them, never portfolio finance.

**Where it lives today** Frontend technician registry with portal links and per-ticket assignment.

---

## 5.12 Notification

**Classification** Entity · **Context** Operations Center · **Status** Implemented

### Responsibility
A message delivered to a specific audience about something that matters. It owns audience, priority, language, read state and the route back into the app.

It is deliberately distinct from `SmartEvent`: an event is a fact that happened; a notification is a decision to tell somebody about it. Many events produce no notification, and one event may produce different notifications per audience.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable notification identifier |
| Title and body | Bilingual message content |
| Priority | Urgency class |
| Audience | Owner, tenant, technician, agent, guard |
| Route | Deep link to the relevant screen |
| Created at | Emission time |
| Read state | Whether the audience has seen it |
| Source references | Originating event, ticket, decision or integration |

### Relationships
- Produced by `Operation` transitions, `SmartEvent` ingestion, `Decision` outcomes and `MaintenanceTicket` state changes.
- Delivered to portal actors and to the owner's device.
- Prepared-but-unsent messages remain attached to the `Decision` that requires approval.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Prepared | An event or decision requires communication | Draft exists, not yet delivered |
| Approved | Owner approves when the channel requires it | Eligible for delivery |
| Delivered | Pushed locally or handed to an external channel | Visible to the audience |
| Read | Audience opens it | Read state recorded |
| Expired | The underlying condition resolved | Archived, no longer actionable |

### Invariants
- A notification never carries information the audience is not permitted to see.
- Outbound messages on regulated channels are prepared, not sent, until approval is explicit.
- Bilingual content is a requirement, not an option.

**Where it lives today** Backend notification model and integration-derived notifications; frontend local notification store, in-ticket tenant notices and portal desk notices.

---

## 5.13 AIEmployee

**Classification** Aggregate Root · **Context** Intelligence · **Status** Implemented

### Responsibility
The virtual property employee: the actor that reads the whole portfolio, maintains a working task list, explains its reasoning, and asks the owner for approval. It owns its task queue, its preferences (what it may do quietly, what it must ask about), and its activity log.

Constitution §4 makes this the centre of the product: every feature exists to make this employee better. The AI employee never owns portfolio truth — it reads truth and proposes action.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Single employee instance per portfolio context |
| Tasks | Suggested work items with kind, priority, score and reason |
| Task status | Suggested, in progress, done, dismissed, waiting follow-up |
| Task kinds | Collect arrears, renew contract, expired contract, fill vacancy, maintenance follow-up, send portal link, data gap, daily brief, follow-up, escalate collection |
| Preferences | Quiet topics, approval requirements, channel preferences |
| Activity log | What it proposed, what the owner accepted or rejected |
| Context snapshot | The portfolio facts the current reasoning is based on |
| Intent understanding | Classified owner question type when chatting |

### Relationships
- Reads `Property`, `Unit`, `Tenant`, `Contract`, `Payment`, `MaintenanceTicket` and `KnowledgeBase`.
- Produces `Decision` candidates and enriches them with platform context.
- Consumes `SmartEvent` streams to raise timely tasks.
- Writes `Operation` entries when it acts, and requests `Notification` when it needs to speak.
- Learns from owner approvals and dismissals, feeding `KnowledgeBase`.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Thinking | Portfolio state changes, import applied, or event received | Task list recomputed |
| Proposing | Tasks ranked and surfaced | Owner sees a prioritised agenda |
| Waiting | Owner snoozes or a follow-up date is set | Task hidden until due, then reopened |
| Acting | Owner approves | Messages prepared, workflows advanced |
| Learning | Owner accepts, edits or dismisses | Preference weights updated for future ranking |
| Reporting | Daily or on demand | Brief and executive narrative produced |

### Invariants
- Every proposal carries a reason and evidence; unexplained suggestions are invalid.
- Completed and dismissed decisions survive recomputation — the employee never nags about a settled matter.
- The employee never performs an irreversible action without an approval record.

**Where it lives today** Frontend smart employee tasks, preferences and enrichment; backend employee context builder, intent classification, suggestions and chat endpoints.

---

## 5.14 Operation

**Classification** Aggregate (append-only log) · **Context** Operations Center · **Status** Implemented

### Responsibility
The chronological record of everything the platform and its actors did: tenant added, contract ended, payment recorded, maintenance opened, assigned or closed, notification prepared, renewal suggested, setup completed. It also carries the queue of actions awaiting owner approval.

The operation log is what makes SPP an operations centre rather than a dashboard: it answers "what happened, when, by whom" without reconstructing it from entity state.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable operation entry identifier |
| Kind | Operation type |
| Occurred at | Timestamp |
| Actor | Owner, tenant, technician, employee, system |
| Summary | Localisable description with parameters |
| Subject references | Related unit, tenant, ticket or contract |
| Pending action | Approval kind, label, payload and creation time when the entry awaits a human |

### Relationships
- Emitted by every aggregate that changes meaningful state.
- Feeds the daily brief, the activity timeline and audit evidence for `Decision` records.
- Pending actions map one-to-one onto approvals required by `Decision`, `LeasePlatform`, `UtilityAccount` and portal payment flows.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Appended | Any meaningful domain change | Entry added, never edited |
| Pending | The change requires owner approval | Pending action queued |
| Resolved | Owner approves or rejects | Pending action removed; outcome appended |
| Rolled | Log exceeds retention window | Oldest entries trimmed, aggregates unaffected |

### Invariants
- Append-only: entries are never edited or deleted individually.
- Every pending action must be resolvable by exactly one owner decision.
- Trimming the log must never change any aggregate's state.

**Where it lives today** Frontend operational state with its event kinds, actors and pending action queue, plus the flow engine that emits entries.

---

## 5.15 Decision

**Classification** Aggregate Root · **Context** Intelligence · **Status** Implemented

### Responsibility
A recommended action with its justification, ranked and gated. Constitution §11 requires every decision to carry reason, evidence, expected outcome and risk. The decision entity enforces exactly that, and holds the approval record proving a human authorised the action.

Decisions from different engines (import reasoning, lifecycle analysis, live portfolio data, executive intelligence) are unified into one ranked list so the owner sees one agenda, not four.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable decision identifier, deduplicated across sources |
| Source | Which engine produced it |
| Kind | Domain of the action (collection, renewal, maintenance, vacancy, utility, notice) |
| Title | One-line statement of the recommended action |
| Why | Reason, in owner language |
| Evidence | Concrete facts and figures supporting it |
| Action | The concrete next step |
| Priority and tier | Critical to low; now, today, this week, follow-up |
| Score | Ranking weight |
| Confidence | Certainty before and after gating |
| Financial impact | Expected monetary effect |
| Affected entities | Tenant, unit, property and reporting period |
| Gate verdict | Ok, warning, blocked for review, with conflict codes |
| Requires confirmation | Whether owner approval is mandatory |
| Status | Proposed, approved and prepared, dismissed |
| Delivery status | Whether any resulting message or payment was actually dispatched |
| Provenance | Originating analysis and engine trail |

### Relationships
- Derived from `KnowledgeBase`, ledger data, `Contract` state, `Maintenance` history and `SmartEvent` input.
- Ranked and presented by `AIEmployee`; approved by `Owner`.
- Produces prepared `Notification` content and `Operation` entries.
- Feeds Executive Reports as the recommendations section.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Generated | An engine detects an actionable condition | Candidate decision created |
| Unified | Duplicate candidates merged across engines | One decision per real-world action |
| Gated | Consistency gate evaluates the underlying data | Confidence capped; blocked when data conflicts |
| Proposed | Surfaced to the owner in ranked order | Awaiting judgement |
| Approved and prepared | Owner approves | Message or payment prepared with an approval record |
| Executed | External channel dispatches the prepared action | Delivery status updated |
| Dismissed | Owner rejects or the condition resolves | Reason retained as learning signal |

### Invariants
- A decision blocked by the consistency gate can never be approved for execution.
- Approval is always recorded with actor, time and the exact prepared content.
- Preparation is not delivery; the two states are always distinguishable.
- Recommendations without evidence are never shown.

**Where it lives today** Backend decision unifier with its gate normalisation and approval records, plus lifecycle and executive decision generators; frontend decision presentation and approval queue.

---

## 5.16 Prediction

**Classification** Entity · **Context** Intelligence · **Status** Partial

### Responsibility
A forward-looking statement about what is likely to happen, with a confidence level and an expected impact: repeat repair risk, warranty expiry window, renewal pricing pressure, arrears trajectory, vacancy risk.

A prediction is not a decision. It describes the future; the decision proposes what to do about it. Keeping them separate prevents unexplained automation and lets predictions be evaluated for accuracy over time.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable insight identifier |
| Scenario | Prediction family (repeat repair, warranty window, renewal pricing, arrears, vacancy) |
| Headline | Owner-facing statement |
| Why | Basis in observed history |
| Likely outcome | What is expected if nothing changes |
| Impact value | Quantified effect where computable |
| Confidence | Certainty level |
| Priority | Attention weight |
| Horizon | Time window the prediction refers to |
| Memory references | Which historical facts support it |
| Subject references | Unit, property or tenant |

### Relationships
- Computed from `KnowledgeBase` and `Maintenance` history, ledger trends and `Contract` terms.
- Escalated into a `Decision` when an action is warranted.
- Surfaced in Executive Reports as the predictive insight section.
- Accuracy feedback returns to `KnowledgeBase` as a learning signal.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Computed | New import, event or scheduled recomputation | Insight generated with supporting references |
| Surfaced | Confidence and priority pass the display threshold | Owner sees the forecast |
| Escalated | Action is warranted | Linked decision proposed |
| Validated | The horizon passes | Outcome compared with the prediction |
| Retired | Superseded by newer data | Archived with its accuracy record |

### Invariants
- Every prediction cites the historical facts it is based on.
- A prediction never triggers action on its own; only an approved decision can.
- Confidence must be recomputed, not inherited, when the underlying data changes.

**Where it lives today** Executive intelligence insights with scenarios and confidence, and asset risk scoring in the memory graph; accuracy tracking and horizon validation are not yet modeled.

---

## 5.17 ImportJob

**Classification** Aggregate Root · **Context** Ingestion · **Status** Implemented

### Responsibility
One complete ingestion of owner files into portfolio truth: classification, parsing, normalisation, knowledge building, reasoning, consistency gating, preview, and the committed apply with its change log.

It exists so that every fact in the platform can be traced back to the file, the batch and the moment it entered — and so that a bad import can be understood rather than guessed at.

This is the protected Smart Import subsystem: CSV, Excel and Google Sheets compatibility and historical import behaviour must be preserved by any change.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Analysis identifier issued at upload and reused at apply |
| Batch identity | Commit identifier for the applied change set |
| Source | Local pipeline or Google Apps Script pipeline |
| Files | File names, types, sizes and classification results |
| Reporting period | Statement months covered |
| Analysis artifacts | Metrics, executive brief, knowledge, reasoning, lifecycle, unified decisions, gate verdict |
| Counts | Properties, units, tenants, contracts, ledger rows, payments |
| Change log | Added, updated and conflicting entries per entity type |
| Data status | Overall quality verdict for the batch |
| Applied at | Commit timestamp |

### Relationships
- Produces and updates `Property`, `Building`, `Unit`, `Tenant`, `Contract` and `Payment` records by merge.
- Builds `KnowledgeBase` content and feeds `Decision` and `Prediction` engines.
- Records churn as occupancy movement snapshots consumed by reporting.
- Every merged record keeps a reference back to its originating batch.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Uploaded | Owner submits files | Files classified by document type |
| Analysed | Pipeline parses and normalises | Analysis artifacts and metrics produced |
| Understood | Knowledge and reasoning engines run | Facts, risks and recommendations available |
| Gated | Consistency gate evaluates contradictions | Confidence capped or import blocked for review |
| Previewed | Owner reviews what will change | Nothing persisted yet |
| Applied | Owner commits | Merge executed, change log written, batch recorded |
| Audited | Later inspection | Batch, counts and conflicts remain queryable |

### Invariants
- Apply merges into existing identities; it never wipes and replaces the portfolio.
- Manually confirmed official records are never overwritten by a statement.
- Every applied change appears in the change log with its entity type and reason.
- A blocked gate verdict prevents decision execution derived from that batch.

**Where it lives today** Backend upload analysis pipeline with intake classification, lifecycle normalisation, canonical ingest and apply commit; frontend import batches, applied reports and apply proof.

---

## 5.18 KnowledgeBase

**Classification** Aggregate (portfolio memory) · **Context** Intelligence · **Status** Partial

### Responsibility
The unified, engine-readable understanding of the portfolio: consolidated facts about units, collection, arrears, lifecycle, contracts, data quality and maintenance, plus the asset memory graph and the record of owner decisions.

It is what allows SPP to reason like an experienced property manager instead of re-reading spreadsheets: the same question asked twice must be answered from knowledge, not from parsing.

### Core attributes
| Attribute | Meaning |
|---|---|
| Scope | Which portfolio and which import produced the knowledge |
| Facts | Units, tenant cards, collection, arrears, lifecycle, contracts |
| Quality assessment | Completeness, contradictions and ledger reliability |
| Asset memory | Assets, fault counts, costs, risk levels and warranty windows |
| Decision memory | What was proposed, approved, rejected, and what happened next |
| Preference memory | Owner habits learned from repeated choices |
| Provenance | The originating batch and pipeline version |
| Editorial knowledge | Guidance articles and guides shown to users |

### Relationships
- Built by `ImportJob` and enriched by `Operation` outcomes and `SmartEvent` history.
- Read by `AIEmployee`, `Decision` and `Prediction` engines and by controlled language responses.
- Feeds Executive Reports and the answer layer for owner questions.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Built | An import is applied | Knowledge snapshot created for that batch |
| Promoted | Snapshot becomes the current portfolio understanding | Engines read from it |
| Enriched | Operations, approvals and platform events accumulate | Understanding deepens over time |
| Superseded | A newer import is applied | Previous snapshot retained for audit and comparison |
| Corrected | Owner confirms an official fact | Correction wins over derived knowledge |

### Invariants
- Knowledge is derived, never authored by hand; corrections enter through the entities, not through the knowledge layer.
- Every knowledge item is traceable to its source facts.
- Knowledge quality flags travel with the knowledge; consumers must respect them.

**Where it lives today** Property knowledge and reasoning artifacts persisted per applied analysis, the asset memory graph, and the editorial knowledge collection; cross-import longitudinal memory and preference learning are partially realised.

---

## 5.19 Sensor

**Classification** Entity · **Context** External Integrations · **Status** Partial (demo readings)

### Responsibility
A device that reports the physical condition of a space: temperature, humidity, water leak, occupancy, energy consumption, air quality. It owns its identity, its latest reading, its status classification and its trend.

The sensor entity turns the property from a set of records into an observed asset, and is the intended source of preventive maintenance signals.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable device identifier |
| Property, building, unit references | What it observes |
| Kind | Measured phenomenon |
| Label | Human-readable placement |
| Value and unit of measure | Latest reading |
| Status | Nominal, attention, critical |
| Trend | Rising, falling, flat |
| Last reported at | Freshness of the reading |
| Thresholds | Boundaries that define status changes |

### Relationships
- Attached to a `Unit`, `Building` or `Property`.
- Emits `SmartEvent` entries when thresholds are crossed.
- Can open a `MaintenanceTicket` through an approved `Decision`.
- Contributes evidence to `Maintenance` risk and `Prediction` scenarios.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Registered | Device paired with a location | Sensor becomes addressable |
| Reporting | Readings arrive | Latest value and trend updated |
| Alerting | Threshold crossed | Event emitted and decision proposed |
| Silent | No reading within the expected interval | Health warning; readings treated as stale |
| Decommissioned | Device removed | History retained |

### Invariants
- A stale reading is never presented as current.
- Sensor readings are evidence, not instructions; they cannot act on the portfolio directly.

**Where it lives today** Sensor model and readings endpoint serving demonstration data, surfaced in the daily narrative; device registry, ingestion and thresholds are not yet modeled.

---

## 5.20 UtilityAccount

**Classification** Entity · **Context** External Integrations · **Status** Partial

### Responsibility
The billing relationship with an electricity or water provider for a specific meter: account number, responsible party, tariff context, and the stream of bills and notices attached to it.

It exists so that utility bills stop being loose messages and become an accountable series tied to a unit, with a clear answer to "who pays this".

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Stable account identifier |
| Utility kind | Electricity or water |
| Account number | Provider-issued reference |
| Meter number | Physical meter reference |
| Unit or building reference | What the account serves |
| Responsible party | Tenant, owner or included in rent |
| Provider | Utility company |
| Current balance and due date | Outstanding obligation |
| Bill history | Issued bills with periods and amounts |
| Payment channel | Where payment is completed |

### Relationships
- Serves one `Unit` or one `Building`; responsibility is resolved from the unit's service matrix and the `Contract`.
- Bills arrive as `SmartEvent` entries and may become an `Invoice` recharge when the owner pays on the tenant's behalf.
- Overdue balances raise `Decision` items and `Notification` messages.
- Consumption history feeds `Prediction` for cost trends.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Linked | Account number captured or matched from a bill | Account becomes trackable |
| Billing | Bill issued events arrive | Balance and due date updated |
| Due | Due date approaches | Reminder prepared for the responsible party |
| Overdue | Due date passes unpaid | Escalation decision raised |
| Settled | Payment confirmed | Balance cleared; history retained |
| Transferred | Tenant changes | Responsibility reassigned with a meter reading snapshot |
| Closed | Meter removed or account terminated | Read-only history |

### Invariants
- Responsibility is resolved before any reminder is sent; SPP never asks the wrong party to pay.
- SPP prepares payments; it does not move money without an explicit owner-approved rail.
- A meter reading snapshot is required at every responsibility transfer.

**Where it lives today** Utility bill and notice events carrying account, meter and amount references, with owner approval flows; unit-level meter fields exist but are not yet linked into a standing account entity.

---

## 5.21 LeasePlatform

**Classification** Entity (integration aggregate) · **Context** External Integrations · **Status** Partial

### Responsibility
The regulated external system where leases are officially registered, and the mirror of SPP contracts inside it. It owns the connection state, the mapping between platform contract references and SPP contracts, and the stream of official notices and expiry warnings.

It exists so that official obligations reach the owner as operational work, and so that SPP can distinguish a legally registered lease from one only observed in a spreadsheet.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Platform connection identifier |
| Platform name | The lease registry in use |
| Connection status | Connected, degraded, disconnected |
| Credentials reference | Secret handle, never the secret itself |
| Contract mapping | Platform contract number to SPP contract reference |
| Event stream | Expiry warnings, renewal reminders, official notices |
| Last sync at | Freshness of the mirror |
| Audience routing | Which parties each notice concerns |

### Relationships
- Mirrors `Contract` records and confirms their official status.
- Emits `SmartEvent` entries that raise renewal `Decision` items and `Notification` messages.
- Notices are routed to `Owner`, agent and `Tenant` audiences with prepared messages awaiting approval.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Connected | Owner links the platform | Status connected; sync enabled |
| Synced | Contracts matched by number and unit | Contracts marked officially registered |
| Receiving | Webhook notices arrive | Events deduplicated and stored |
| Acting | Expiry or notice raises a decision | Owner approves prepared messages |
| Degraded | Authentication or delivery fails | Owner warned; contracts keep their last known official state |
| Disconnected | Owner unlinks | Mirror frozen; contracts revert to locally verified status |

### Invariants
- Platform data is translated into SPP language at the boundary; vendor payload shapes never leak into the domain.
- Event ingestion is idempotent; a redelivered notice never duplicates work.
- A contract's official status is only claimed while the mirror is trustworthy.

**Where it lives today** Lease platform client, webhook ingestion and normalised expiry and notice events with owner approval and prepared party messages.

---

## 5.22 SmartEvent

**Classification** Domain Event (append-only) · **Context** Operations Center · **Status** Partial

### Responsibility
The single normalised representation of anything that happened outside the owner's direct action: a lease notice, a utility bill, an inbound message, a sensor threshold crossing, a platform intelligence signal.

Constitution §10 requires every external event to pass through the operation engine before reaching users. `SmartEvent` is that entry point: one shape, one deduplication rule, one routing decision, regardless of source.

Today each integration keeps its own normalised event shape; unifying them is the target design.

### Core attributes
| Attribute | Meaning |
|---|---|
| Identity | Source identifier combined with source name |
| Source | Lease platform, electricity, water, messaging, intelligence, sensor, internal |
| Type | Event classification within the source |
| Occurred at and received at | When it happened and when SPP learned about it |
| Subject references | Property, building, unit, tenant, contract |
| Payload summary | Normalised, owner-readable content in both languages |
| Priority | Urgency assessment |
| Audiences | Which parties the event concerns |
| Processing status | Received, interpreted, actioned, ignored |
| Approval state | Whether a resulting action awaits the owner |
| Raw reference | The original payload retained for audit |

### Relationships
- Ingested through anti-corruption adapters from `LeasePlatform`, `UtilityAccount`, `Sensor` and messaging channels.
- Interpreted by `AIEmployee` into tasks and by decision engines into `Decision` candidates.
- Produces `Notification` messages and appends to the `Operation` log.
- Accumulates into `KnowledgeBase` as historical context.

### Lifecycle
| Stage | Trigger | Result |
|---|---|---|
| Received | Webhook or poll delivers a payload | Normalised and deduplicated by source identity |
| Interpreted | Engines classify subject, urgency and audience | Tasks and decision candidates created |
| Awaiting approval | The response requires the owner | Pending action queued |
| Actioned | Owner approves | Prepared messages or workflows dispatched |
| Ignored | No action warranted | Retained as context only |
| Archived | Retention window passes | Summary retained, raw payload discarded |

### Invariants
- Events are immutable facts; interpretation may change, the event never does.
- Deduplication by source identity is mandatory — redelivery must be harmless.
- No external event reaches a user without passing through interpretation and routing.

**Where it lives today** Separate normalised event streams per integration with their own deduplication and approval flows, plus the on-device operational event log.

---

# 6. Core domain flow

The Constitution §8 data lifecycle, expressed through these entities:

**Import** — `ImportJob` receives owner files and classifies them.
**Validation** — the consistency gate evaluates contradictions and caps confidence.
**Normalization** — rows become `Property`, `Building`, `Unit`, `Tenant`, `Contract` and `Payment` candidates.
**Storage** — candidates merge into existing identities; the change log records every difference.
**Knowledge** — `KnowledgeBase` is built from the merged truth plus operational history.
**Analysis** — `AIEmployee` reads knowledge and produces `Prediction` and `Decision` candidates.
**Decision** — decisions are unified, gated, ranked and proposed to the `Owner`.
**Execution** — approved decisions prepare `Notification` messages and advance `MaintenanceTicket`, `Invoice` and portal workflows, each appending to `Operation`.
**Learning** — approvals, rejections and outcomes return to `KnowledgeBase` and adjust future ranking.

Parallel to this loop, `SmartEvent` continuously injects outside reality (`LeasePlatform`, `UtilityAccount`, `Sensor`, messaging) into the Operations Center, where it is interpreted by the same decision machinery.

---

# 7. Domain event catalog

| Event | Emitted by | Primary consumers |
|---|---|---|
| Property registered / updated | `Property`, `ImportJob` | Setup progress, reporting |
| Unit occupied / vacated | `Unit`, `Contract` | Occupancy KPIs, vacancy decisions |
| Tenant added / transferred / vacated | `Tenant` | Portal access, churn history, collection |
| Contract activated / expiring / renewed / expired | `Contract` | Renewal decisions, lease platform sync |
| Payment recorded / confirmed / rejected | `Payment` | Arrears truth, revenue reporting |
| Invoice issued / settled / overdue | `Invoice` | Receivables ageing, collection |
| Ticket opened / assigned / completed / approved | `MaintenanceTicket` | Asset history, technician performance |
| Notification prepared / delivered | `Notification` | Audience inboxes, audit |
| Decision proposed / approved / dismissed | `Decision` | Execution, learning signal |
| Prediction computed / validated | `Prediction` | Executive report, knowledge accuracy |
| Import applied | `ImportJob` | Knowledge rebuild, decision regeneration |
| External event received | `SmartEvent` | Task generation, notification routing |

---

# 8. Cross-cutting invariants

1. **One tenancy per unit at a time.** Occupancy, contract and ledger must agree; disagreement is a data-quality finding, never a silent choice.
2. **Money records are append-only.** Corrections are new records with a reason, never edits to history.
3. **Provenance is mandatory.** Every fact knows whether it came from an owner, an import, a platform or an inference.
4. **Confidence travels with data.** Gated or low-quality data must be visibly marked wherever it is consumed.
5. **Preparation is not execution.** Messages and payments are prepared; only an approved, recorded action dispatches them.
6. **Deletion is archival.** Nothing referenced by financial or legal history is physically removed.
7. **Bilingual by construction.** Owner-facing content exists in Arabic and English at the domain level, not as a presentation afterthought.

---

# 9. Modeling gaps and roadmap

| Entity | Current state | Required to close the gap |
|---|---|---|
| `Building` | Count only on the property | First-class building identity, unit attachment, shared services and shared cost allocation |
| `Owner` | Model and endpoint exist; imports attach to a default identity | Real owner identity on import, multi-owner portfolios, ownership shares |
| `Invoice` | Document classification and subscription billing only | Property invoicing with line items, tax treatment, credit notes and ledger reconciliation |
| `Maintenance` | Asset dossier computed from imports | Editable asset registry with warranty, lifespan and preventive schedules |
| `Prediction` | Insights with confidence | Horizon tracking and accuracy validation feeding learning |
| `KnowledgeBase` | Per-import snapshots and asset memory | Longitudinal cross-import memory and explicit preference learning |
| `Sensor` | Demonstration readings | Device registry, real ingestion, thresholds and staleness handling |
| `UtilityAccount` | Bill events with account references | Standing account entity linked to unit meters and responsibility transfer |
| `LeasePlatform` | Notices and expiry events | Bidirectional contract mapping and official-status guarantees |
| `SmartEvent` | Per-integration event shapes | One unified event model with shared deduplication, routing and retention |

Closing a gap must respect Smart Import compatibility, Google Sheets column and sheet naming stability, and backward compatibility with historical imports.

---

# 10. Bilingual glossary

| English | العربية | Meaning in SPP |
|---|---|---|
| Property | عقار | Managed real-estate asset, root of the registry |
| Building | مبنى | Physical structure inside a property |
| Unit | وحدة | Smallest leasable and billable space |
| Tenant | مستأجر | Occupant and collection counterpart |
| Owner | مالك | Principal and sole approval authority |
| Contract | عقد | Lease agreement and rent expectation |
| Payment | دفعة | Money actually received |
| Ledger | سجل الدفعات | Monthly due, paid and remaining per tenant |
| Invoice | فاتورة | Formal demand for money |
| Maintenance | صيانة | Asset dossier, history and responsibility |
| Maintenance ticket | بلاغ صيانة | One repair work order |
| Technician | فني | Field executor of maintenance work |
| Notification | إشعار | Message delivered to a specific audience |
| AI employee | الموظف الذكي | Virtual property employee proposing work |
| Operation | عملية تشغيلية | Append-only record of what happened |
| Decision | قرار | Recommended action with reason and evidence |
| Prediction | تنبؤ | Forward-looking insight with confidence |
| Import job | عملية استيراد | One ingestion of owner files into truth |
| Knowledge base | قاعدة المعرفة | Unified engine-readable understanding |
| Sensor | مستشعر | Device observing physical condition |
| Utility account | حساب خدمة | Electricity or water billing relationship |
| Lease platform | منصة الإيجار | Official lease registry integration |
| Smart event | حدث ذكي | Normalised external fact entering the platform |

---

# 11. Document status

*Document Status:* Official Domain Model

*Version:* 1.0

*Project:* Smart Property Platform (SPP)

*Companion documents:* `docs/SPP_CONSTITUTION.md`, `docs/SPP_BLUEPRINT.md`, `docs/SPP_ENGINE_VISION.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/DATA_ARCHITECTURE.md`, `docs/DECISION_ENGINE.md`, `docs/OPERATION_CENTER.md`, `docs/KNOWLEDGE_BASE.md`, `docs/AI_PROPERTY_EMPLOYEE.md`

*Governance / index:* `docs/ARCHITECTURE_GOVERNANCE.md`, `docs/README.md`

*Change policy:* Entity names, responsibilities and lifecycle states defined here are normative. Renaming or removing an entity requires a Blueprint revision. Adding attributes is permitted when it preserves existing invariants, Smart Import compatibility and reporting capability.
