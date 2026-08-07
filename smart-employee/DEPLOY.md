# نشر السطح العربي التجريبي ضمن SPP

> `smart-employee/` سطح تقديم عربي تجريبي تحت دستور SPP فقط (Governance Option A).  
> **ليس** منتجاً مستقلاً. المرجع: `docs/ARCHITECTURE_GOVERNANCE.md` §6.3 · `PRODUCT.md`.

## الهدف
رابط ثابت للسطح التجريبي → أي تعديل بعد `git push` إلى `main` (مسارات `smart-employee/**`) يصل عبر Vercel بدون روابط تنزيل جديدة (PWA).

## المسار المعتمد في هذا المستودع

GitHub Actions workflow:

- الملف: `.github/workflows/deploy-smart-employee.yml`
- الاسم: **Deploy experimental Arabic SPP surface**
- المحفّز: push إلى **`main`** على `smart-employee/**` أو `workflow_dispatch`

يتطلب أسرار المستودع: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## ربط Vercel (مرة واحدة)

1. https://vercel.com/new
2. Import هذا المستودع (أو مشروع Vercel المربوط بـ `smart-employee/`)
3. Framework: Vite
4. Root / Build: حسب إعداد المشروع الحالي (`npm run build` → `dist`)
5. Deploy

## الجوال بدون تنزيل جديد

1. افتح رابط Vercel من الجوال
2. إضافة إلى الشاشة الرئيسية (Add to Home Screen)
3. PWA يتحدّث عند الفتح بعد كل نشر

## ملاحظة هوية

أي اسم مشروع Vercel تاريخي (مثل stitch-saudi-smart) هو تسمية استضافة فقط — ليس دستوراً ثانياً ولا لغة مجال موازية.
