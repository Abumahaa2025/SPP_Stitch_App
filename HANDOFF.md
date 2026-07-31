# SPP · Smart Property Platform · Handoff Document

> **Status:** Frontend frozen · Phase 3 complete · Ready for Phase 4 live integrations
> **Handoff target:** Source team (Phase 4 integrations)
> **Do not modify the UI.** Wire live data behind the existing endpoints.

---

## 1 · Project Structure

```
/app
├── backend
│   ├── server.py                # FastAPI app + all API routes + AI verdict engine
│   ├── requirements.txt
│   ├── .env                     # NOT committed — copy from .env.example
│   ├── .env.example
│   └── tests/
│       └── test_spp_backend.py
├── frontend                     # Expo React Native (SDK-managed, TypeScript)
│   ├── app/                     # expo-router file-based routes (screens)
│   │   ├── _layout.tsx          # root Stack + SplashIntro cold-launch
│   │   ├── index.tsx            # AI Executive home
│   │   ├── portfolio.tsx, brain.tsx, insights.tsx, hub.tsx
│   │   ├── health.tsx, maintenance.tsx, sensors.tsx, notifications.tsx
│   │   ├── tenants.tsx, contracts.tsx, owner.tsx, reports.tsx
│   │   ├── knowledge.tsx, guides.tsx
│   │   ├── settings.tsx, profile.tsx, billing.tsx
│   │   ├── about.tsx, support.tsx, privacy.tsx, terms.tsx
│   │   └── property/[id].tsx
│   ├── src/
│   │   ├── components/          # GlassCard, AmbientBackground, BrainVerdict, HealthRing, …
│   │   ├── theme/               # Dark-luxury design tokens
│   │   ├── api/                 # Typed API client → hits EXPO_PUBLIC_BACKEND_URL + /api/*
│   │   ├── i18n/                # English + Arabic dictionaries (RTL-ready)
│   │   ├── hooks/               # usePreferences (notif + account prefs)
│   │   └── utils/storage/       # AsyncStorage + SecureStore wrapper
│   ├── package.json             # Yarn — do not use npm
│   ├── app.json                 # Expo config + permissions
│   ├── metro.config.js          # Protected — DO NOT modify
│   ├── .env                     # NOT committed — copy from .env.example
│   └── .env.example
└── memory/
    ├── PRD.md                   # Product requirements record
    └── test_credentials.md      # Empty — no auth wired yet
```

---

## 2 · Run Locally (outside Emergent)

### Backend

```bash
cd /app/backend
cp .env.example .env             # fill in MONGO_URL + EMERGENT_LLM_KEY
python -m pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd /app/frontend
cp .env.example .env             # fill EXPO_PUBLIC_BACKEND_URL
yarn install
yarn expo start
```

### Ingress rule (production / Emergent)

- Any request whose path starts with `/api/` is proxied to the FastAPI service on `:8001`.
- Everything else is served by Metro / Expo Web on `:3000`.
- **Never hardcode ports or hostnames** — the frontend already uses `EXPO_PUBLIC_BACKEND_URL + "/api/..."`.

---

## 3 · Environment Variables

### `/app/backend/.env`

| Key                       | Required | Used for                                             |
| ------------------------- | -------- | ---------------------------------------------------- |
| `MONGO_URL`               | ✅        | MongoDB connection string                            |
| `DB_NAME`                 | ✅        | Mongo database name (default `spp`)                  |
| `EMERGENT_LLM_KEY`        | ✅        | Universal LLM key (OpenAI GPT-5.2 via emergentintegrations) |
| `GOOGLE_APPS_SCRIPT_URL`  | Phase 4  | Google Apps Script webhook                           |
| `GOOGLE_SHEETS_SA_JSON`   | Phase 4  | Service-account JSON for Sheets sync                 |
| `GREEN_API_INSTANCE_ID`   | Phase 4  | WhatsApp Business via Green API                      |
| `GREEN_API_TOKEN`         | Phase 4  | WhatsApp Business via Green API                      |
| `HOME_ASSISTANT_URL`      | Phase 4  | Physical sensor bridge                               |
| `HOME_ASSISTANT_TOKEN`    | Phase 4  | Long-lived access token                              |
| `OPENAI_API_KEY`          | Optional | Only if switching off Emergent key for direct billing |

### `/app/frontend/.env`

| Key                        | Required | Used for                                        |
| -------------------------- | -------- | ----------------------------------------------- |
| `EXPO_PUBLIC_BACKEND_URL`  | ✅        | Base URL for API calls (code appends `/api/…`)  |
| `EXPO_PACKAGER_*`          | Auto     | Set by Emergent — do not modify locally         |

---

## 4 · Backend API Endpoints (current)

All routes are mounted under the `/api` prefix. Source: `/app/backend/server.py`.

| Method | Path                       | Purpose                                                  | Consumers (frontend)         |
| ------ | -------------------------- | -------------------------------------------------------- | ---------------------------- |
| GET    | `/api/`                    | Health check                                             | —                            |
| GET    | `/api/briefing`            | AI Executive morning brief (headline + narrative + KPIs) | `index.tsx`                  |
| GET    | `/api/verdicts`            | Contextual BrainVerdict for each screen                  | `BrainVerdict` component     |
| GET    | `/api/properties`          | Property list                                            | `portfolio.tsx`, `hub`, etc. |
| GET    | `/api/properties/{pid}`    | Single property detail                                   | `property/[id].tsx`          |
| GET    | `/api/decisions`           | Ranked AI decisions                                      | `home`, `maintenance`        |
| GET    | `/api/tenants`             | Tenant roster + reliability signals                      | `tenants.tsx`                |
| GET    | `/api/contracts`           | Contract lifecycle + renewal windows                     | `contracts.tsx`              |
| GET    | `/api/timeline`            | Property timeline events                                 | `property/[id].tsx`          |
| GET    | `/api/sensors`             | Virtual sensor readings                                  | `sensors.tsx`                |
| GET    | `/api/notifications`       | Priority-ranked notifications                            | `notifications.tsx`          |
| GET    | `/api/reports`             | Smart reports (AI-authored)                              | `reports.tsx`                |
| GET    | `/api/knowledge`           | Knowledge Center articles                                | `knowledge.tsx`              |
| GET    | `/api/guides`              | Video guides catalogue                                   | `guides.tsx`                 |
| GET    | `/api/owner`               | Owner profile aggregate                                  | `owner.tsx`                  |
| POST   | `/api/chat`                | Unified Brain — multi-turn chat with GPT-5.2             | `brain.tsx`                  |
| GET    | `/api/chat/{session_id}`   | Chat history for a session                               | `brain.tsx`                  |

**All endpoints today read from MongoDB seeded via `server.py`.** Phase 4 will swap read sources to Google Sheets / Home Assistant while preserving the exact response shapes so the frontend needs zero changes.

---

## 5 · Frontend API Client

- File: `/app/frontend/src/api/client.ts`
- Base: `process.env.EXPO_PUBLIC_BACKEND_URL + "/api"`
- Fully typed (`PropertyT`, `DecisionT`, `NotifT`, `ReportT`, `KnowledgeT`, `GuideT`, …).
- **Contract with backend:** frontend expects the exact JSON shapes emitted today. Phase 4 must preserve them.

---

## 6 · Design System (do not modify)

- `/app/frontend/src/theme/tokens.ts` — colors, spacing, radius, typography, shadows, motion.
- Core components: `GlassCard`, `AmbientBackground`, `BrainVerdict`, `HealthRing`, `BrandOrb`, `ScreenScaffold`, `ScreenHeader`, `EmptyState`, `GlassTabBar`, `SplashIntro`, `LegalScreen`.
- **Dark-luxury theme is frozen.** No visual identity changes are permitted in Phase 4.

---

## 7 · Bilingual · Arabic RTL

- Dictionaries: `/app/frontend/src/i18n/index.ts` — full English + Arabic coverage across every screen.
- Toggle: `Settings → Language` — writes to `AsyncStorage('spp.lang')`, calls `I18nManager.forceRTL`, and prompts a native reload for full mirroring.
- RTL is respected via `useI18n().isRTL` and row-reverse patterns already in place.

---

## 8 · Local Preferences (AsyncStorage)

- `/app/frontend/src/hooks/usePreferences.ts`
- **Notification preferences** and **account preferences** are persisted locally today. Shape is Phase-4-ready — a `PUT /api/preferences` endpoint can be introduced without any UI change.

---

## 9 · Phase 4 · Integration Placeholders (already wired into UI)

The frontend already surfaces status pills for each of these under `Settings → Connected services` and `Profile → Connected services`:

| Service                    | Current status pill        | Backend hook (to be added Phase 4)      |
| -------------------------- | -------------------------- | --------------------------------------- |
| Google Sheets              | `Not connected · Phase 4`  | `/api/integrations/sheets/*`            |
| Home Assistant             | `Not connected · Phase 4`  | `/api/integrations/home-assistant/*`    |
| WhatsApp · Green API       | `Not connected · Phase 4`  | `/api/integrations/whatsapp/*`          |
| OpenAI · GPT-5.2           | `Active`                   | Already live via `/api/chat`            |

Flipping a service from "phase4" → "active" is a one-line change in `settings.tsx` / `profile.tsx` (`status="phase4"` → `status="active"`). The UI is ready.

---

## 10 · Testing

- Backend tests: `/app/backend/tests/test_spp_backend.py`
- Iteration reports: `/app/test_reports/iteration_*.json`
- No auth is currently wired. `/app/memory/test_credentials.md` is intentionally empty.

---

## 11 · Hard Rules for Phase 4

1. **Do not modify the UI.** All screens are frozen.
2. **Do not change API response shapes.** The frontend depends on them literally.
3. **Do not touch:** `metro.config.js`, `.env` protected keys (`EXPO_PACKAGER_*`, `MONGO_URL`), `app.json` permissions, the theme tokens.
4. **Every new integration must:** load config from `.env`, degrade gracefully when unavailable (fall back to seeded data), and keep the `BrainVerdict` narrative voice intact.
5. **Preserve the AI-first tone.** Every backend response that reaches a screen must feed the Brain, not raw data dumps.

---

_Frozen: February 2026 · SPP Executive v1.0.0_
