# Testing the latest SPP build (not a stale Expo Go cache)

## Build verification stamp

On **Home**, scroll to the bottom. You must see:

```
ux-transfer-2026-07-04-r2
```

(testID: `ux-build-stamp`). If this text is missing or shows an older stamp, you are **not** on the latest bundle.

Also confirm on Home (scroll top):

- Title **يومك** (not English "Good morning" hero only)
- Horizontal **KPI strip** (تحصيل، إيراد، …)
- **Pulse row** (المهام، المتأخرات، الصيانة، التحصيل)
- Tab bar label **رفع** (upload tab)
- `testID="home-kpi-strip"` / `home-pulse-row` in dev tools (web)

---

## Backend URL

From `frontend/.env`:

```
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.104:8000
```

API base: `http://192.168.1.104:8000/api`

Phone and PC must be on the **same Wi‑Fi**. If your PC IP changes, update `.env` and restart Expo with `--clear`.

---

## Option A — Web preview (fastest on PC)

```powershell
cd C:\Users\HP\Downloads\mpv\SPP_Flutter\backend
uvicorn server:app --host 0.0.0.0 --port 8000
```

New terminal:

```powershell
cd C:\Users\HP\Downloads\mpv\SPP_Flutter\frontend
$env:EXPO_NO_DEPENDENCY_VALIDATION="1"
npx expo start --web --clear
```

Open the URL Metro prints (usually **http://localhost:8081**).  
Web uses `127.0.0.1:8000` only if you change `.env` to that; for LAN backend keep `192.168.1.104:8000` or use web with backend on same machine via `http://127.0.0.1:8000`.

---

## Option B — Expo Go on phone (recommended for real mobile UX)

### 1. Clear stale cache on PC

```powershell
cd C:\Users\HP\Downloads\mpv\SPP_Flutter\frontend
npx expo start --lan --clear
```

`--clear` resets Metro bundler cache (fixes old JS bundle).

### 2. Clear stale session on phone

- Force-close **Expo Go**
- Android: Settings → Apps → Expo Go → **Storage → Clear cache** (not necessarily clear data)
- Reopen Expo Go

### 3. Scan QR / enter URL manually

Metro prints something like:

```
exp://192.168.1.104:8081
```

**Use that exp:// URL** — not an old bookmark.

If QR fails, in Expo Go: **Enter URL manually** → `exp://192.168.1.104:8081`

### 4. Shake device → **Reload** after any code change

---

## Option C — Android debug APK (no Expo Go cache)

Requires Android SDK / Android Studio.

```powershell
cd C:\Users\HP\Downloads\mpv\SPP_Flutter\frontend
npx expo run:android
```

Installs a **development build** on the connected device/emulator with the embedded bundle.  
For a shareable APK without USB, use EAS Build (`eas build -p android --profile preview`) if `eas.json` is configured.

---

## First screen to open

1. **Home (`/`)** — confirm stamp + يومك + KPI strip + رفع tab  
2. Tap **رفع** — 7-step wizard + multi-file upload  
3. Tap **الرؤى** or open **الذكاء** from home section  

---

## Quick health checks

| Check | Expected |
|-------|----------|
| Backend | Browser: `http://192.168.1.104:8000/docs` or `/api/executive` returns JSON |
| Metro | Terminal shows `Metro waiting on exp://192.168.1.104:8081` |
| Build stamp | `ux-transfer-2026-07-04-r2` on Home footer |
| Arabic default | UI chrome in Arabic without English tab labels |
