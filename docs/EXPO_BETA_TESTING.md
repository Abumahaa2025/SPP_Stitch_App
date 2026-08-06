# SPP Beta — stable install + OTA updates (Expo)

## Stable Android install (one link — keep this APK)

After the first install, **JavaScript updates** ship via **EAS Update** on channel `beta` (same `runtimeVersion` / app version). You do **not** need a new APK for UI/JS fixes — reopen the app to pull updates.

| Resource | URL |
|----------|-----|
| **Direct APK (stable name `spp-beta.apk`) — install once** | https://github.com/Abumahaa2025/SPP_Stitch_App/releases/latest/download/spp-beta.apk |
| **Releases page (pick APK if needed)** | https://github.com/Abumahaa2025/SPP_Stitch_App/releases/latest |
| **Expo project dashboard** | https://expo.dev/accounts/abumahaa2025/projects/spp-beta |
| **EAS Update channel `beta`** | https://expo.dev/accounts/abumahaa2025/projects/spp-beta/updates |
| **Backend (beta)** | https://spp-beta-api.onrender.com |

Project ID (linked in `frontend/app.json`): `405761ee-fac3-4b25-9784-23f7441535e3`

## How OTA works

1. `frontend/app.json` → `updates.url` + `requestHeaders.expo-channel-name: beta` (required for GitHub-built APKs).
2. `frontend/eas.json` → preview profile uses **channel `beta`**.
3. On app start and when returning to foreground, `applyExpoOtaIfAvailable()` checks channel `beta` and reloads if a new bundle exists.
4. CI workflow `.github/workflows/expo-ota-update.yml` publishes to `beta` on push to `main` (requires `EXPO_TOKEN`).
5. Native APK rebuild (when `app.json` version bumps) publishes stable `spp-beta.apk` via **Expo Beta APK (branch)**.

**`EXPO_TOKEN`:** create it while logged in as **abumahaa2025** at [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens), then set GitHub repo secret `EXPO_TOKEN`. A token from another Expo account will fail with `Entity not authorized`.

## Publish an update manually

**GitHub (recommended):**  
Actions → **Expo OTA Update (beta)** → **Run workflow** → branch `main` → Run.

Direct link: https://github.com/Abumahaa2025/SPP_Stitch_App/actions/workflows/expo-ota-update.yml

Verification note: pushing to `main` also triggers the same OTA workflow automatically.

```bash
cd frontend
export EXPO_TOKEN=your_token
eas update --channel beta --message "describe change"
```

## Build a new native APK (only when native deps / version change)

GitHub Actions → **Expo Beta APK** → branch `main`, or:

```bash
cd frontend
eas build --platform android --profile preview
```

## Local dev link (Expo Go / dev client)

```bash
cd frontend
npm run link
```

---

**Arabic:** ثبّت APK مرة واحدة من الرابط أعلاه. أي تعديلات على الواجهة تصل عبر Expo (قناة beta) عند فتح التطبيق — بدون رابط تثبيت جديد.
