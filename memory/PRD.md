# SPP — Smart Property Platform (PRD)

## Vision
An **AI Operating System for Real Estate**. Not a dashboard — a calm, senior AI executive that watches every property, every day. The user should never feel they're reading data. SPP guides them: *"I checked overnight. Here's what I recommend. Approve?"*

## Design language
Dark luxury · deep navy · emerald orb + gold accents · cinematic glassmorphism · Apple-level typography · calm motion. Refined but never redesigned.

---

## Phase 1 — Design System + AI Employee Home ✅
Tokens, component library, AI Employee Home.

## Phase 2 — Full 11-screen platform ✅
Portfolio · Brain · Insights · Property Detail · Maintenance · Health · Sensors · Notifications · Settings · Onboarding.

## Phase 2.5 — Human Interface polish pass ✅
Deeper ink, richer glassmorphism, hairline sheens, animated health-ring counter, softer separators, empty states, cinematic image treatment.

## Phase 3 — Advisor voice · OS surfaces · Brand identity ✅

### (a) Advisor voice — the AI executive tone
- **Backend** — `/api/briefing` now returns a `narrative[]` of executive-style lines that read like a senior property chief's morning note:
  - *"I reviewed your portfolio overnight. HVAC on Marina Crest is trending toward failure — prevents ≈ AED 42,000 emergency service…"*
  - *"Onyx Sky Loft, Aurum Office Tower are trending below target — worth a decision this week."*
  - *"2 contracts enter the renewal window in the next 34 days."*
- **Home** — new **Morning Brief** card renders the narrative with gold-dot bullets. Reads like a human's note.
- Micro-copy across every screen refined to advisor tone (i18n keys, bilingual EN + AR).

### (b) OS surfaces — full platform ecosystem
Six new premium screens, all functional with seeded demo data, all consuming the same design language.
- **Hub** (`/hub`) — the platform directory. Four sections: Intelligence · Assets & People · Operations · Learn & Grow. 14 gold/emerald-accented glass tiles.
- **Smart Reports** (`/reports`) — AI-authored monthly / financial / compliance / tenant reports with highlight bullets, page count, dates.
- **Knowledge Center** (`/knowledge`) — reading library with topic badges, reading time, "Continue reading" CTA.
- **DIY & Video Guides** (`/guides`) — cinematic video-card grid: poster, level badge, gold play chip, duration, chapter count.
- **Tenants** (`/tenants`) — reliability-scored roster with initial avatars, monthly rent, colored reliability bars, tap-through to property.
- **Contracts** (`/contracts`) — status pills (Active / Expiring / Renewed), countdown for expiring contracts, start/end/monthly meta.
- **Owner Profile** (`/owner`) — identity card featuring the **BrandOrb** + SPP wordmark, portfolio value, properties, health, quick-link grid.

Hub is reachable from Home via a new fourth quick-nav tile.

### (c) Brand identity
- **`BrandOrb`** — the definitive SPP identity mark. Emerald core → gold halo → outer wash. Three independently breathing layers with a hairline gold ring and inner top highlight. Used in splash-loading, onboarding, chat empty state, and Owner Profile.
- **`Wordmark`** — the SPP wordmark component with tight 7-pt letter spacing + optional "AI OPERATING SYSTEM · REAL ESTATE" tagline.

### Internationalization
- `useI18n()` — 180+ keys covering every screen, every empty state, every CTA.
- English + Arabic in parallel. `I18nManager.forceRTL` for direction; every RTL string is native, not translated.
- Every new screen fully bilingual from day one.

### Backend
- Modular AI factory unchanged — `openai / gpt-5.2` via Emergent Universal Key. One-line provider swap.
- New endpoints: `/api/reports`, `/api/knowledge`, `/api/guides`, `/api/owner`.
- `_seed_dataset()` extended with premium demo data for the new surfaces.

---

## Phase 3 — Advisor voice · OS surfaces · Brand identity ✅ (final)

Verified end-to-end by the testing_agent (`iteration_2.json`) — backend 19/19 pytest passed, all 14 frontend surfaces render cleanly, GPT-5.2 replies live, zero worklet errors, all navigation routes work.

Follow-ups applied post-test:
- Narrative sentence now preserves "AED" case; no double period.
- Contract countdowns computed from live seed dates (34d / 58d).
- Hub scroll padding raised to 220 px so the last row of tiles clears the floating tab bar and is tappable.

## Phase 3.5 — Brain-first refinement pass ✅

*"The Brain should speak before the user thinks."*

### One voice on every surface
- New **`BrainVerdict`** component (`/app/frontend/src/components/BrainVerdict.tsx`) — a calm, breathing glass card with the SPP · BRAIN VERDICT eyebrow, a **recommendation headline**, a **why line** (justification with quantified impact), and a **gold action pill** that routes to the decisive next screen.
- New backend endpoint **`/api/verdicts`** — 13 contextual verdicts, computed from live portfolio state, keyed by screen. One Brain, one voice.
- Mounted at the very top of: Portfolio, Insights, Health, Maintenance, Sensors, Tenants, Contracts, Reports, Knowledge, Guides, Owner. **AI recommendation appears before any raw data on every screen.**
- Property Detail mounts a **per-property** verdict fed from the property's live decision — the Brain speaks in-context.

### Why every number matters
- Insights trend line now reads *"+8.2% vs last quarter · outperforming market by 0.9pt"* — quantified justification, not a bare number.
- Home Morning Brief already reads like an executive's note.
- HealthRing renders a semantic status word ("Excellent / Stable / Attention") alongside every score.

### Emotionally alive, never noisy
- BrainVerdict has an emerald breathing dot with a soft halo — subtle, calm, alive.
- AmbientBackground continues to breathe cinematically behind every screen.
- HealthRing animates from 0 → score with an elegant number counter.
- Every card entrance uses `FadeInDown` with 60–90 ms stagger.
- Every interaction fires haptics (`selection` / `impact.Light`).

### Direction reinforced
SPP now consistently answers *"What should the owner do next?"* on every surface, before any data is shown. The AI Employee is one feature; the **Operating System is the product**.

## Phase 3.6 — Launch flow + UX polish ✅

### Cold-start ritual — the SPP Intro
- New **`SplashIntro`** component: full-bleed ink with the breathing BrandOrb, the "S P P" wordmark at large scale, the "AI OPERATING SYSTEM · REAL ESTATE" tagline, and a subtle "Preparing your executive briefing…" footer.
- New logic in `_layout.tsx` enforces the launch ritual on **every cold start**:
  1. Restore fonts + language.
  2. Hold the intro for a minimum **1400 ms** for brand presence.
  3. **`router.replace('/')`** (or `/onboarding` for first-launch) — the app never opens on the last visited screen, even after deep links.
  4. Fade the intro out (520 ms cubic ease) to reveal Home.
  5. Unmount after the fade completes.

### Transitions between sections
- Stack now uses `animation: 'default'` with `animationDuration: 320` — platform-natural iOS slide / Android push, but faster and softer.

### Verified by testing_agent (iteration_3)
- **21/21 backend pytest passed** (added `TestVerdicts` covering the 13 keyed verdicts).
- **Cold-start regression PASSED**: navigating to `/health` then reloading correctly redirects to Home via `router.replace('/')`.
- First-launch routes to onboarding; onboarded users route to Home.
- No red screen / worklet errors. GPT-5.2 chat still live.

## Phase 4 — real integrations (blocked on credentials)
No frontend changes will be required — every screen consumes stable `api.*` endpoints.
