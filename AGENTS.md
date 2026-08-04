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
