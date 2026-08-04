# رابط تثبيت APK (مرة واحدة) + تحديثات مباشرة بعدها

## تثبيت مرة واحدة فقط (آخر إصدار 1.0.40 — قناة Expo beta مضمّنة)

**تحميل مباشر:**
https://github.com/Abumahaa2025/SPP_Stitch_App/releases/download/v1.0.40/spp-beta.apk

**نفس الرابط الثابت (Latest):**
https://github.com/Abumahaa2025/SPP_Stitch_App/releases/latest/download/spp-beta.apk

## إذا ظهر عندك الإصدار 38

1. احذف التطبيق القديم من الجوال بالكامل (إلغاء التثبيت).
2. ثبّت من جديد من الرابط أعلاه (1.0.40).
3. افتح التطبيق — يجب أن يظهر `beta-1.0.40` (وليس 38).

ملاحظة: ختم «v1.0.38» القديم كان مكتوبًا يدويًا في الشاشة؛ تم إصلاحه ليقرأ رقم الإصدار الحقيقي.

## كيف يعمل

1. APK يحتوي `expo-channel-name: beta` + `runtimeVersion` = رقم إصدار التطبيق.
2. كل push على `main` ينشر OTA عبر: Actions → **Expo OTA Update (beta)**.
3. التطبيق يفحص التحديث عند التشغيل وعند الرجوع من الخلفية.

الحزمة: `ai.spp.stitch`
