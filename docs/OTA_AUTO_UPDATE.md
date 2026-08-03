# SPP — التحديث التلقائي للجوال (OTA)

مثل مشروع **الفرز** (نشر حي يصل للجوال)، SPP يوصل تعديلات الواجهة/المنطق عبر **EAS Update** بدون روابط APK متكررة.

## المسار

```
تعديل في frontend/**  →  push إلى main
        ↓
GitHub Action: EAS OTA Beta
        ↓
قناة Expo: beta
        ↓
فتح التطبيق على الجوال → checkAutomatically ON_LOAD + applySilentOtaUpdate
        ↓
التحديث يُحمَّل ويُعاد تشغيل التطبيق
```

## ملفات أساسية

- `frontend/app.json` — `updates.checkAutomatically: ON_LOAD`
- `frontend/src/utils/ota-updates.ts` — فحص/تحميل/إعادة تشغيل
- `frontend/app/_layout.tsx` — استدعاء صامت عند الإقلاع
- `frontend/eas.json` — قناة `beta` لملف `preview`
- `.github/workflows/eas-ota-beta.yml` — نشر تلقائي من فرع **main**

## متى تحتاج APK جديد؟

فقط عند تغييرات أصلية (Native modules، صلاحيات، أيقونة، إلخ) أو عند رفع `expo.version` عمداً.
