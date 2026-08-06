
# AGENTS.md

## Cursor Cloud specific instructions

This repo is the **SPP — Smart Property Platform** monorepo (single product): a Python **FastAPI backend** and an **Expo / React Native (web) frontend**. Canonical run/setup docs live in `HANDOFF.md`; standard scripts live in `frontend/package.json` and `backend/requirements.txt`. The notes below are the non-obvious, durable things a cloud agent needs.

### Services

| Service | Dir | Dev command | Port |
| --- | --- | --- | --- |
| Backend API (FastAPI) | `backend` | `source .venv/bin/activate && uvicorn server:app --host 0.0.0.0 --port 8001` | 8001 |
| Frontend (Expo web) | `frontend` | `npx expo start --web --port 3000` | 3000 |

The backend Python deps live in a virtualenv at `backend/.venv` (created by the update script). `emergentintegrations` is only on a custom index (`--extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/`); it is optional — the LLM/chat layer degrades to a deterministic local "Kowil" brain when it or an LLM key is absent.

MongoDB, Google Apps Script, and an LLM key are all **optional**. In beta mode the backend uses an in-memory seeded UAE portfolio, so no external services are needed to run and test end-to-end.

### Required local env files (gitignored — recreate if missing)

Neither `.env` is committed (`.env*` is gitignored), so recreate them before running locally.

`backend/.env` (beta mode = seeded data, no Mongo/GAS/LLM needed):

```
SPP_BETA_MODE=true
SPP_DEMO_MODE=false
SPP_DATA_SOURCE=mongo
GOOGLE_APPS_SCRIPT_URL=
SPP_API_KEY=
MONGO_URL=mongodb://localhost:27017
DB_NAME=spp_beta
EMERGENT_LLM_KEY=
```

`frontend/.env`:

```
EXPO_PUBLIC_BACKEND_URL=http://<VM_INTERFACE_IP>:8001
EXPO_PORT=3000
```

**Gotcha (important):** `frontend/src/constants/backend.ts` `resolveBackendUrl()` **forces the hosted Render URL** (`https://spp-beta-api.onrender.com`) whenever `EXPO_PUBLIC_BACKEND_URL` contains `localhost`, `127.0.0.1`, or `192.168.`. To point the local web app at the local backend, use the VM's interface IP (e.g. `hostname -I` → something like `172.30.0.2`), **not** `localhost`. If the var is empty/LAN, the app silently talks to the hosted beta API instead of your local backend.

### Running the web app in a browser (Chrome gotchas)

The base VM's `/dev/shm` is only 64M, which makes Chrome's renderer crash with **"Aw, Snap!"** on this heavy RN-web bundle. Before browser testing, enlarge it:

```
sudo mount -o remount,size=2G /dev/shm
```

**Computer-use / automation note:** many RN-web `Pressable` / controlled `TextInput` handlers do not respond to synthetic mouse clicks. When UI automation fails, drive the flow from Chrome DevTools Console (dispatch click events on the target node, or write `localStorage` key `spp.propertyOS` — the app double-JSON-encodes the `PropertyOSState` string — then `location.href = '/brain'`).

Beta demo logins (via `POST /api/beta/login`): `demo.owner@spp.beta` / `SPP-Owner-26` (also `demo.tenant@spp.beta` / `SPP-Tenant-26`, `demo.tech@spp.beta` / `SPP-Tech-26`). The core AI feature is the "Smart property employee" at route `/brain` (local Kowil brain from Property OS + optional `POST /api/chat` with body field `text`).

### Lint / test / build

- Backend tests: `cd backend && source .venv/bin/activate && pytest tests/`. Two files need external/live services and should be excluded offline: `--ignore=tests/test_gas_live.py --ignore=tests/test_role_isolation_regression.py` (the latter reads `EXPO_PUBLIC_BACKEND_URL` from a `frontend/.env` at the hard-coded path `/app/frontend/.env` and hits a deployed URL). Offline suite: ~353 passed, 14 skipped.
- Frontend lint: `cd frontend && yarn lint` (passes with 0 errors; there are pre-existing unused-var warnings).
- Frontend web build: `cd frontend && yarn export:web` (or just run the dev server as above).
- Use **Yarn**, not npm (`frontend/package.json` has a `preinstall` command-guard). `yarn.lock` is intentionally not committed by upstream (they ship `package-lock.json`); it is regenerated on install.
=======
## Cursor Cloud specific instructions

- Service map for local dev:
  - `backend` (FastAPI): run from `backend/` on port `8001`.
  - `frontend` (Expo): run from `frontend/` (web on `8081` by default).
- Set frontend backend URL **without trailing slash** (for example `EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8001`). A trailing slash can produce double-slash calls like `/api//notifications`.
- Preferred verification sequence for cloud agents:
  - Frontend lint: `cd frontend && npm run lint` (currently warnings-only in repo baseline).
  - Backend smoke: start backend, then run `cd backend && source .venv/bin/activate && EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8001 pytest -q tests/test_final_smoke.py`.
- Core hello-world flow for this product is upload analysis + apply:
  - `POST /api/upload/portfolio-analysis`
  - then `POST /api/upload/apply-analysis` with returned `analysis_id`.
- Expo OTA workflow is defined in `.github/workflows/expo-ota-update.yml` and only auto-triggers on pushes that touch `frontend/**` (or the workflow file itself).

