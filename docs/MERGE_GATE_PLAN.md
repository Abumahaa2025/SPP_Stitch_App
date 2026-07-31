# Plan — conflict_030726_0550 until Emergent+Source merge

**Branch:** `conflict_030726_0550` only  
**Do not:** push to `master`, change Render settings, build a new APK.

## Active now
1. Continue Backend / engines engineering on this branch.
2. Wait for Emergent UX work on the same branch.

## After Emergent finishes (gate)
3. `git fetch` + pull latest from GitHub on this branch.
4. Full conflict review / integrate Source + Emergent.
5. Run full Regression suite.
6. Only if tests pass → publish branch to `master`.
7. Deploy Render from updated `master`.
8. Confirm live SHA (e.g. `/api/build-info`) → then build **one** unified APK.

## Notes
- Live Render today tracks `master` (older SHA); Apply engines (`8901639`+) stay on conflict until step 6–7.
- Evidence: `proofs/LIVE_RENDER_VERIFY_8901639.md`
