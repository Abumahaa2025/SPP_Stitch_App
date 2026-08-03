# نشر stitch-saudi-smart (رابط ثابت + تحديث تلقائي للجوال)

## الهدف
رابط واحد دائماً → أي تعديل بعد `git push` يصل للجوال فوراً بدون روابط تنزيل جديدة (PWA + Vercel).

## الخطوة 1 — إنشاء مستودع GitHub
اسم المستودع المطلوب: **`stitch-saudi-smart`**

من جهازك (لأن توكن الوكيل لا يملك إنشاء مستودعات):

1. افتح: https://github.com/new
2. Repository name: `stitch-saudi-smart`
3. Public → Create repository
4. ارفع محتويات مجلد `smart-employee` (أو ملف `stitch-saudi-smart.zip`)

أو بالتوكن الشخصي:
```bash
cd smart-employee
GH_TOKEN=YOUR_PAT ./scripts/publish-github.sh
```

## الخطوة 2 — ربط Vercel
1. https://vercel.com/new
2. Import `stitch-saudi-smart`
3. Framework: Vite
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Deploy

النتيجة: رابط ثابت مثل `https://stitch-saudi-smart.vercel.app`

## الخطوة 3 — الجوال بدون تنزيل جديد
1. افتح رابط Vercel من الجوال
2. إضافة إلى الشاشة الرئيسية (Add to Home Screen)
3. التطبيق PWA بتحديث تلقائي — كل نشر جديد يظهر عند الفتح

## Bubble
- ضع رابط Vercel داخل Bubble كـ Web/HTML element أو Open External Website
- لأن الرابط ثابت، أي تحديث على Vercel يظهر داخل Bubble مباشرة

## ملاحظة
تم دفع فرع `gh-pages` على مستودع SPP_Stitch_App الحالي؛ فعّل GitHub Pages يدوياً من Settings → Pages → Branch: gh-pages إن رغبت برابط github.io مؤقت.
