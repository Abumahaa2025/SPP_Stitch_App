# رابط تثبيت APK (مرة واحدة) + تحديثات مباشرة بعدها

## تثبيت مرة واحدة فقط (آخر إصدار 1.0.40 — قناة Expo beta مضمّنة)

**تحميل مباشر:**
https://github.com/Abumahaa2025/SPP_Stitch_App/releases/download/v1.0.40/spp-beta.apk

**نفس الرابط الثابت (Latest):**
https://github.com/Abumahaa2025/SPP_Stitch_App/releases/latest/download/spp-beta.apk

بعد هذا التثبيت: أي تعديل واجهة/JS ينزل تلقائيًا عند فتح التطبيق أو العودة إليه — **بدون رابط جديد**.

## كيف يعمل

1. APK يحتوي `expo-channel-name: beta` + `runtimeVersion` = رقم إصدار التطبيق.
2. كل push على `main` ينشر OTA عبر: Actions → **Expo OTA Update (beta)**.
3. التطبيق يفحص التحديث عند التشغيل وعند الرجوع من الخلفية.

الحزمة: `ai.spp.stitch`
