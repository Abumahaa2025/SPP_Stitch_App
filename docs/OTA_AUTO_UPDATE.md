# SPP — التحديث التلقائي للجوال (OTA)

مثل مشروع **الفرز** (نشر حي يصل للجوال)، SPP يوصل تعديلات الواجهة/المنطق عبر **EAS Update** بدون روابط APK متكررة.

## المسار (Canonical)

```
تعديل في frontend/**  →  push إلى main
        ↓
    GitHub Action: Expo OTA Update (beta)
    .github/workflows/expo-ota-update.yml
        ↓
قناة Expo: beta
        ↓
فتح التطبيق على الجوال → checkAutomatically ON_LOAD + OTA helpers
        ↓
التحديث يُحمَّل ويُعاد تشغيل التطبيق
```

## ملفات أساسية

- `frontend/app.json` — `updates.checkAutomatically: ON_LOAD` + `expo-channel-name: beta`
- `frontend/src/utils/ota-updates.ts` / `expo-ota.ts` — فحص/تحميل/إعادة تشغيل
- `frontend/app/_layout.tsx` — استدعاء عند الإقلاع
- `frontend/eas.json` — قناة `beta` لملف `preview`
- `.github/workflows/expo-ota-update.yml` — **الناشر التلقائي الوحيد** من فرع **main**

> ملاحظة: `.github/workflows/eas-ota-beta.yml` أصبح fallback يدوي فقط (`workflow_dispatch`) — لا يدفع تلقائياً.

## متى تحتاج APK جديد؟

فقط عند تغييرات أصلية (Native modules، صلاحيات، أيقونة، إلخ) أو عند رفع `expo.version` عمداً.

انظر أيضاً: [`EXPO_BETA_TESTING.md`](./EXPO_BETA_TESTING.md)
