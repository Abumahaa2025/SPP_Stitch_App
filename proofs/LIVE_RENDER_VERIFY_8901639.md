# Live Render verification — Apply engines (8901639)

**Date:** 2026-07-15T07:03Z  
**Target commit:** `89016396e545bdde21a3d70a19eda2ce5c36912b` (`conflict_030726_0550`)  
**Live URL:** https://spp-beta-api.onrender.com  
**Evidence file:** `proofs/live_apply_20260715_070202.json`

## 1) Is Render on 8901639?

**No.**

| Evidence | Result |
|----------|--------|
| GitHub Deployments env `master - spp-beta-api` | Latest recorded deploy sha **`3edd1da`** (2026-07-12), ref **`master`** |
| `8901639` ancestor of `origin/master`? | **No** (`merge-base --is-ancestor` exit 1) |
| `GET /api/build-info` | **404** (endpoint not on live; added only locally pending deploy) |
| Render deploy log (last known) | https://dashboard.render.com/web/srv-d94rvv4vikkc73ctm52g/deploys/dep-d9a0u0c2m8qs73d9lv6g |

`origin/master` HEAD at check time: `05fc7d2` (Beta 17). Render may still be on older `3edd1da` — either way **not** `8901639`.

## 2) Live upload → analysis → Apply (same API the app uses)

| Step | Result |
|------|--------|
| `GET /api/` | online |
| `GET /api/beta/info` | `beta:true`, `gas_disabled:true` (label only) |
| `POST /upload/portfolio-analysis` | **200**, `analysis_id=preview_*` (**GAS** path) |
| Koil sections | present (`koil_brief`…) |
| `executive_brief.engines` | **missing** on this GAS response |
| `property_knowledge.tenants` | **0** on this GAS response |
| `POST /upload/apply-analysis` | **200**, `ok:true`, **`gas:true`** (Sheets commit succeeded) |
| `GET /tenants` after Apply | still **beta fictional seed** (`ten_b1`…), not imported rows |

## 3) GAS fail → local materialise (not 502)

**Not observed on live** because GAS **succeeded**.

- Live Apply: `gas:true` + Sheets commit (`unitsUpdated:2`, phone in `departedReports`: `966502222222`).
- Local fallback fingerprint (`gas:false` + `commit.source=python`) **did not run**.
- Proven only in unit/API tests on `8901639` (`tests/test_upload_apply_engines.py` — 5 passed; suite 103 passed).

## 4) Phones from Property Knowledge after Apply

**Not proven on live Expo portfolio API:**

- GAS response had empty PK tenant cards for this payload.
- `/api/tenants` remains beta seed (Sheets ≠ beta `/properties|/tenants` memory/seed).
- GAS commit payload *did* include phone on departed report (`966502222222`) — Sheets side, not Expo list API.

App-side PropertyOS Apply (APK `66ecbf1`) still materialises locally; that path is independent of this Render SHA gap.

## 5) Blocker to close Source checklist

Render service **`spp-beta-api` auto-deploys from `master`**, while Apply engines work lives on **`conflict_030726_0550`**.

**Master does not contain `build_local_apply_commit` yet** — cherry-pick of `8901639` alone is insufficient; need Apply stack from `66ecbf1`+`8901639` (and preferably `/build-info`).

### Recommended next action (needs explicit approve)

1. Either retarget Render to `conflict_030726_0550`, **or**
2. Port Apply engines commits onto `master` (careful cherry-pick / PR) then confirm new deploy sha via `/api/build-info`.

Until then: **do not claim live 8901639**; wait Emergent UI pushes; keep APK as-is.

## Re-run live script after deploy

```bash
python backend/scripts/live_render_apply_proof.py https://spp-beta-api.onrender.com
```
