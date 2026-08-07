# IMPLEMENTATION_GAP_REPORT — فجوات التنفيذ مقابل المعمارية المعتمدة

> **النطاق:** مقارنة الكود الحالي (Frontend Expo/RN · Backend FastAPI · GitHub Actions · Integrations · `smart-employee/`) مع القانون المعماري تحت `docs/` فقط.  
> **القاعدة:** لا تعديل على كود التطبيق في هذه المهمة — التقرير وثيقة فجوات فقط.  
> **الأسبقية عند التعارض بين الوثائق:** Constitution → Domain Model → Blueprint → Supporting → Operating path (`docs/ARCHITECTURE_GOVERNANCE.md` §2.2).  
> **ملاحظة هوية السطح:** المعمارية المعتمدة تسمّي السطح الأساسي **Expo / React Native / RN Web** تحت `frontend/` (Blueprint §4.1). لا يوجد تطبيق Flutter منفصل في المستودع؛ تسمية `SPP_Flutter` / `STITCH_SCREEN_MAP` تاريخية فقط.

| حقل | قيمة |
|---|---|
| التاريخ | 2026-08-07 |
| الفرع المرجعي للتحليل | `main` (HEAD الافتراضي للمستودع) + بنية العمل الحالية |
| وثائق المرجع | `docs/README.md` وجميع الأعمدة والوثائق الداعمة تحت `docs/` |
| ما يُستبعد كقانون | `HANDOFF.md`, `AGENTS.md`, `memory/`, `proofs/` (إلا كدليل تشغيلي) |

---

## 1. ملخص تنفيذي

الكود يحقق أجزاء كبيرة من مسار Smart Import → Apply → Property OS → AI Employee desk → قرارات gated مع prepare على مسارات المنصات الرسمية. الفجوات الحرجة تتركز في: (1) مسار إرسال واتساب يتجاوز prepare-not-send، (2) webhooks تفتح عند غياب السر، (3) تعطل نشر جسر البوابة بسبب YAML فاسد، (4) انقسام فروع الإصدار مع غياب `origin/master`، (5) تخزين أسرار مزوّدين على الجهاز، (6) ملفات واجهة/`app.json` غير قابلة للتحليل تعطل مسارات Live المزعومة. باقي الفجوات إما معترف بها في Blueprint §19 / Domain Model §9 / System Architecture §23، أو انحراف تسمية/طبقات Clean Architecture.

### ما يطابق المعمارية (مختصر — ليس فجوة)

| المنطقة | الحالة |
|---|---|
| أعمدة `docs/` + stubs الجذر لـ Domain/Blueprint | متوافقة مع Governance G-01 |
| `smart-employee/` كسطح عربي تجريبي (Option A) | `PRODUCT.md` / `README.md` متوافقان مع Governance §6.3 |
| Dual Smart Import + gate + decision unifier + LLM explainer معطّل افتراضياً | موجود تحت `backend/adapters/` |
| `/decisions/approve` و approvals للمنصات (Ejar/Utilities/Inbox) prepare-only | متوافق مع prepare-not-send على هذه المسارات |
| Device-first Property OS + Kowil/Koil local fallback | موجود |
| `resolveBackendUrl` يمنع LAN/localhost في الحزم المُشحونة | متوافق مع Blueprint §4.2 |
| Benchmark CI على `backend/**` + `benchmarks/**` | موجود (`benchmark-regression.yml`) |

---

## 2. Critical

### GAP-C01 — إرسال واتساب من مكتب الموظف يتجاوز prepare-not-send

> **Phase 1 status:** Closed — desk collection/escalation requires owner approval + persisted prepared content; Green outbound forced to deep-link Placeholder (no server dispatch).

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Constitution §11؛ Blueprint §§2.5, 8.2, 13.3؛ System Architecture C-03 / C-04 |
| **الملفات المتأثرة** | `frontend/src/components/SmartEmployeeDesk.tsx`؛ `frontend/src/utils/smart-employee-agent.ts`؛ `frontend/src/api/client.ts`؛ `backend/server.py` (`POST /integrations/whatsapp/send`)؛ `backend/adapters/integrations/green_api.py` |
| **سبب التعارض** | المعمارية تفرض: الموافقة حالة مُنمذجة بسجل، والتحضير ≠ الإرسال، ومسار Green API مُعلَّم Placeholder (deep links فقط). في الكود، مهام `collect_arrears` / `escalate_collection` تُنشأ بـ `action: 'send_whatsapp'` **بدون** `requiresOwnerApproval`، وعند التنفيذ تستدعي `api.whatsappSend(..., false)` فترسل عبر Green API إن وُجدت المفاتيح — دون المرور بـ `POST /decisions/approve` ودون سجل موافقة. نقطة `/integrations/whatsapp/send` لا تتطلب `approval_id`. |
| **خطة الإصلاح المقترحة** | 1) جعل كل إرسال منظم يمر بموافقة persist ثم حالة `delivery_status=unsent/prepared`. 2) تقييد `/integrations/whatsapp/send` ليطلب معرف موافقة صالح أو فرض `dry_run` افتراضياً. 3) فصل «تحضير الرسالة» عن «فتح wa.me / إرسال Green». 4) تعديل Blueprint §3.2/§8.2 فقط بعد إقرار سكة إرسال صريحة خلف سياسة المالك. |

### GAP-C02 — Webhooks تفتح عند غياب السر المشترك (fail-open)

> **Phase 1 status:** Closed — production/non-beta fails closed when secret unset; beta/local may fail open.

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §§4.3, 15, 19؛ System Architecture §§13.2, 13.4, SA security؛ Constraint C-11 |
| **الملفات المتأثرة** | `backend/adapters/ejar_client.py`؛ `backend/adapters/utilities_client.py`؛ `backend/adapters/platform_inbox_client.py`؛ مسارات الاستقبال في `backend/server.py` |
| **سبب التعارض** | القانون: «unset secret currently accepts any request and must be treated as a production defect» و«fail closed in production». التنفيذ: `verify_webhook_secret` يعيد `True` عندما `expected` فارغ (تعليق: «If no secret configured, accept (dev/beta)»). هذا مذكور كفجوة معمارية مفتوحة وما زال قائماً في الكود. |
| **خطة الإصلاح المقترحة** | 1) Fail-closed عندما `SPP_BETA_MODE`/`ENV=production` و السر فارغ. 2) الإبقاء على fail-open فقط لوضع beta/local صريح. 3) إضافة اختبارات ترفض الطلب بلا سر في وضع الإنتاج. 4) تنبيه صحة على `/integrations/*/status` عند `webhook_ready` بلا سر. |

### GAP-C03 — ملف نشر جسر البوابة YAML فاسد

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §4.1 (Portal bridge)؛ System Architecture §18.1؛ قرار الجسر الثابت في Blueprint §18 |
| **الملفات المتأثرة** | `.github/workflows/portal-pages.yml`؛ `docs/portal-open.html` |
| **سبب التعارض** | المعمارية تتطلب نشر HTML حقيقي للبوابة من مجلد الوثائق. الملف الحالي يدمج تعريفين متعارضين لنفس الـ workflow (فروع `master` و`main`، خطوات `jobs.deploy` مكررة/متداخلة). `yaml.safe_load` يفشل — النشر غير صالح. |
| **خطة الإصلاح المقترحة** | 1) إعادة كتابة ملف واحد نظيف. 2) توحيد فرع الإطلاق مع قطار الإصدار المعتمد. 3) الإبقاء على تحقق `Content-Type: text/html`. 4) تشغيل `workflow_dispatch` للتحقق بعد الإصلاح. |

### GAP-C04 — تعارض ثلاثي لحالة Green API / WhatsApp outbound

> **Phase 1 status:** Closed (Option A) — code conformed to Blueprint Placeholder (deep links only); no RFC; APP_PATH reconciled.

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §§3.2, 8.2, 19؛ Governance G-04؛ `docs/APP_PATH.md` Phase C/D؛ System Architecture §12.1 |
| **الملفات المتأثرة** | `docs/APP_PATH.md`؛ `docs/SPP_BLUEPRINT.md` (حالة الحالة)؛ `backend/adapters/integrations/green_api.py`؛ `backend/server.py`؛ `frontend/src/components/SmartEmployeeDesk.tsx`؛ `frontend/src/api/client.ts` |
| **سبب التعارض** | Blueprint: Placeholder (deep links فقط، لا إرسال خادم). APP_PATH: Live عبر `/api/integrations/*`. الكود: إرسال خادم كامل عبر Green API. هذا كسر لـ status honesty (Governance §5.6) ولـ G-04، ويمكّن GAP-C01. |
| **خطة الإصلاح المقترحة** | اختيار واحد صريح عبر تعديل Blueprint: إما (أ) إعادة الكود إلى deep-link + prepare-only حتى إقرار السكة، أو (ب) ترقية الحالة إلى Partial/Implemented مع عقد موافقة إلزامي وoutbox. ثم مواءمة APP_PATH مع أسطورة الحالة في Blueprint. |

### GAP-C05 — أسرار مزوّدين تُلتقط وتُخزَّن على الجهاز

> **Phase 1 status:** Closed — setup screens store intent only; secrets stripped from `spp.connections` on read/write.

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §8.4؛ System Architecture §§2.3, 13.4؛ Constraint C-11 |
| **الملفات المتأثرة** | `frontend/src/components/ServiceSetupScreen.tsx` (`apiToken`, HA `token`, `smtpPass`, `webhookSecret`)؛ `frontend/src/hooks/useConnections.ts` (`spp.connections` عبر AsyncStorage عادي)؛ مفاتيح i18n التي تدّعي تشفيراً على الجهاز |
| **سبب التعارض** | المعمارية: أسرار الاتصال في بيئة الخدمة فقط؛ شاشات الإعداد capturenية نية/حالة محلية وليست قناة اعتماد. التنفيذ يكتب رموزاً/أسراراً في JSON عادي عبر `storage.setItem` دون `secureSet`، بينما النص يعد بالتشفير. |
| **خطة الإصلاح المقترحة** | 1) إزالة حقول الأسرار من تطبيق العميل. 2) الإبقاء على نية الاتصال محلياً فقط. 3) ربط الصحة بـ endpoints تحقق خادمية. 4) تدوير أي أسرار وُضعت سابقاً في أجهزة beta. |

### GAP-C06 — كسر بناء في عميل الواجهة ومكوّن التفعيل و`app.json`

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §4.1 / §16 (OTA + تطبيق قابل للشحن)؛ APP_PATH Phase C/D يعتمد على مسارات integrations حية |
| **الملفات المتأثرة** | `frontend/src/api/client.ts` (`whatsappSend` — استدعاء `req(` بلا إغلاق `})`)؛ `frontend/src/components/ServiceActivationPanel.tsx` (`const SERVICES` مكرّر)؛ `frontend/app.json` (`fallbackToCacheTimeout` مكرّر بلا فاصلة — JSON غير صالح) |
| **سبب التعارض** | مسارات «Live» وOTA تفترض حزمة صالحة. هذه الأخطاء تمنع تحليلاً/استهلاكاً موثوقاً لـ Expo config ومسار الإرسال، فتفتح فجوة بين ادعاء APP_PATH والواقع القابل للبناء. |
| **خطة الإصلاح المقترحة** | إصلاح نحوي فوري لكل ملف؛ إضافة فحص `tsc`/`json` في CI قبل OTA؛ عدم نشر OTA حتى يمر الفحص. |

### GAP-C07 — أتمتة `master` بلا فرع بعيد موجود

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §§4.1, 4.3, 19 |
| **الملفات المتأثرة** | `render.yaml`؛ `benchmark-regression.yml`؛ `eas-ota-beta.yml`؛ `android-apk-eas.yml`؛ نصف `portal-pages.yml` |
| **سبب التعارض** | المستودع البعيد يعرض `origin/main` فقط — **لا يوجد `origin/master`**. ادعاءات نشر API/بوابة الجودة/OTA-on-master طوبولوجيا وهمية على هذا الـ remote حتى يُنشأ الفرع أو تُنقل المحفّزات إلى `main`. |
| **خطة الإصلاح المقترحة** | توحيد كل المحفّزات على `main` (أو إنشاء `master` المتابع صراحة)، وتحديث `render.yaml` وBlueprint §4.1 معاً. |

---

## 3. High

### GAP-H01 — انقسام فروع الإصدار `main` مقابل `master`

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §§4.1, 4.3, 19؛ System Architecture §18.3؛ `docs/OTA_AUTO_UPDATE.md`؛ `docs/EXPO_BETA_TESTING.md` |
| **الملفات المتأثرة** | `render.yaml` (`branch: master`)؛ `.github/workflows/benchmark-regression.yml`؛ `eas-ota-beta.yml`؛ `expo-ota-update.yml`؛ `expo-beta-apk.yml`؛ `android-apk-eas.yml`؛ `portal-pages.yml`؛ `deploy-smart-employee.yml` |
| **سبب التعارض** | HEAD الافتراضي للمستودع هو `main` و**لا يوجد `origin/master`** (انظر GAP-C07). API/Render والـ benchmark وOTA القديم ما زالت تستهدف `master`؛ OTA الأحدث على `main`. ازدواجية مساري OTA (`eas-ota-beta.yml` و`expo-ota-update.yml`). الوثائق التشغيلية تتعارض (master vs main). |
| **خطة الإصلاح المقترحة** | 1) اعتماد قطار إصدار واحد موثّق في Blueprint §4.1. 2) تعطيل/دمج أحد مساري OTA. 3) مواءمة Render + CI + docs. 4) إغلاق بند «Branch split» في Blueprint §19 بعد التوثيق أو التوحيد. |

### GAP-H02 — Clean Architecture غير مُجسَّدة كحدود حزم

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §5؛ Domain Model §3.2؛ Architecture Governance §9؛ System Architecture §§2–3, C-02 |
| **الملفات المتأثرة** | `frontend/src/` (لا توجد `domain/` أو `application/`)؛ `frontend/src/utils/*`؛ `frontend/app/*`؛ `backend/server.py` (~3007 سطر، Interface+Application+Persistence مختلطة)؛ `backend/adapters/*` (منطق مجال تحت اسم adapters) |
| **سبب التعارض** | المعمارية تفرض طبقات Presentation/Application/Domain/Infrastructure واعتماداً للداخل فقط، ورفض قواعد المال/الأهلية في الـ UI، ورفض routers تملك قواعد العمل. التنفيذ عملي لكنه مسطّح: اشتقاقات العمليات في utils، و`server.py` إله واحد، ولا حزمة Domain صريحة في الواجهة. |
| **خطة الإصلاح المقترحة** | إعادة هيكلة تدريجية (لا إعادة كتابة): استخراج Domain (أنواع + invariants) ثم Application (محركات) من utils؛ تقسيم `server.py` إلى routers رفيعة + application services؛ منع قراءة `os.environ` داخل محركات القرار (نقلها لـ Infrastructure). |

### GAP-H03 — طبقة التعلم (Learning Layer) غير مبنية

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Engine Vision (الطبقة 3 + الحالة الحالية)؛ Blueprint §§6.2, 11.4, 13.1 Learning, 19؛ Domain Model §5.18 / §9 |
| **الملفات المتأثرة** | غياب وحدة Client Profile / preference memory خادم؛ `frontend/src/types/smart-employee.ts` (`EmployeePrefs` محلي ناعم فقط)؛ `frontend/src/utils/smart-employee-agent.ts` |
| **سبب التعارض** | الرؤية الرسمية: التعلم معرفة خاصة بالعميل وليست Rules عامة — «لم تُبنَ بعد». الكود يملك عدّادات تفضيل على الجهاز فقط، بلا ذاكرة طولية عبر الدفعات ولا دقة تنبؤ. |
| **خطة الإصلاح المقترحة** | تصميم كيان Client Profile في Domain Model أولاً؛ تخزين تصحيحات المالك (موافقة/رفض/تعديل) كإشارات تعلم؛ عدم إضافة قواعد عامة لكل ملف مالك؛ ربطها بترتيب المهام قبل أي multi-agent Phase Four. |

### GAP-H04 — لا يوجد Event Bus / Worker / SmartEvent موحّد

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §§7.3, 12, 17.5, 19؛ Domain Model §5.22 / §9؛ System Architecture §§11, SA-04 |
| **الملفات المتأثرة** | `backend/adapters/ejar_events.py`؛ `utilities_events.py`؛ `platform_inbox_events.py`؛ `backend/server.py`؛ `frontend/src/utils/ejar-sync.ts`؛ `utilities-sync.ts`؛ `platform-inbox-sync.ts` |
| **سبب التعارض** | الهدف: غلاف حدث واحد + outbox + worker. الواقع: مسارات لكل تكامل + سحب من الجهاز عند تركيز المكتب + لا طابور/مجدول. متوافق مع «الوضع الحالي» الموثّق، لكنه فجوة نضج Operations Center. |
| **خطة الإصلاح المقترحة** | اتباع ترتيب Blueprint §12.4 حرفياً: envelope → نقل المخازن → outbox → worker (بعد حل single-process). |

### GAP-H05 — تيار Platform Inbox ذاكرة فقط

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §§4.3, 14.1, 19؛ System Architecture §15.3 |
| **الملفات المتأثرة** | `backend/server.py` (`_persist_platform_event` / `_list_platform_events` — `_memory_db` فقط) |
| **سبب التعارض** | المعمارية تسجّل صراحة أن أحد التيارات memory-only ويفقد التاريخ عند إعادة التشغيل؛ الكود يؤكد ذلك لـ `platform_events`/`platform_approvals` دون مسار Mongo. |
| **خطة الإصلاح المقترحة** | ترقية نفس شكل المستند المستخدم لـ Ejar/Utilities إلى Mongo مع fallback ذاكرة؛ اختبار بقاء الأحداث بعد إعادة التشغيل. |

### GAP-H06 — Home Assistant / Sensors: حالة Blueprint متأخرة عن الكود

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §§3.2, 8.2, 19؛ Domain Model §5.19؛ APP_PATH Phase D |
| **الملفات المتأثرة** | `backend/adapters/integrations/home_assistant.py`؛ `backend/server.py` (`GET /sensors`)؛ `frontend/app/sensors.tsx`؛ شاشات إعداد الاتصالات |
| **سبب التعارض** | Blueprint: Placeholder (شاشة إعداد فقط) و«sensor readings are demonstration data». الكود: جلب حي من HA عند ضبط المفاتيح، وإلا بذور/Mongo. APP_PATH يعلن Live. لا يوجد بعد سجل أجهزة/عتبات/staleness ككيان كامل (Domain Model). |
| **خطة الإصلاح المقترحة** | تحديث أسطورة الحالة في Blueprint إلى Partial؛ إكمال Device registry + thresholds + stale handling؛ الإبقاء على التدهور الآمن عند غياب المفاتيح. |

### GAP-H07 — محركات/محولات تقرأ أسرار البيئة مباشرة

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §5.4 («An engine reading environment variables… is misplaced»)؛ System Architecture §3.4 |
| **الملفات المتأثرة** | `backend/adapters/integrations/green_api.py`؛ `home_assistant.py`؛ `ejar_client.py`؛ `utilities_client.py`؛ `platform_inbox_client.py`؛ أجزاء من `server.py` وLLM |
| **سبب التعارض** | قراءة `os.environ` داخل طبقات يفترض أن تكون Domain/Application أو محركات قرار. |
| **خطة الإصلاح المقترحة** | إدخال Configuration/Settings Infrastructure يُحقن في العملاء؛ المحركات تستقبل منافذ مجردة فقط. |

---

## 4. Medium

### GAP-M01 — تسمية Kowil ما زالت سائدة في الكود والواجهة

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Architecture Governance §6 (G-02 مغلق معيارياً)؛ Engine Vision ملاحظة التسمية |
| **الملفات المتأثرة** | `frontend/src/utils/kowil-local-brain.ts`؛ `kowil-platform-dispatch.ts`؛ `KowilWelcomePanel.tsx`؛ مفاتيح i18n؛ تعليقات/سلاسل في `backend/server.py` |
| **سبب التعارض** | الوثائق الجديدة تفرض **Koil**؛ Kowil مسموح كاسم مستعار تاريخي حتى مهمة إعادة تسمية لاحقة. الكود لم يُعاد تسميته بعد. |
| **خطة الإصلاح المقترحة** | إعادة تسمية تدريجية للملفات/الرموز العامة إلى Koil مع aliases توافقية؛ عدم تغيير هوية المنتج البصرية إلا بطلب صريح. |

### GAP-M02 — كيان Building ما زال Planned (عدد فقط)

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Domain Model §5.2, §9 |
| **الملفات المتأثرة** | `frontend/src/types/property-os.ts` (`buildingCount`)؛ معالجات الإعداد/Apply |
| **سبب التعارض** | النموذج المعتمد يعرّف Building ككيان أول؛ التنفيذ يخزّن العدد فقط. |
| **خطة الإصلاح المقترحة** | إدخال هوية مبنى + ربط الوحدات + خدمات مشتركة دون كسر Smart Import أو أعمدة Sheets. |

### GAP-M03 — فجوات كيانات Domain Model §9 ما زالت مفتوحة

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Domain Model §9؛ Blueprint §19 حيث ينطبق |
| **الملفات المتأثرة** | مسارات الفوترة/الصيانة/التنبؤ/المعرفة عبر `frontend/` و`backend/adapters/` |
| **سبب التعارض** | Invoice (عقاري)، Maintenance registry قابل للتحرير، Prediction accuracy/horizon، KnowledgeBase طولي، UtilityAccount كيان قائم، LeasePlatform ثنائي الاتجاه — معرّفة كهدف وليست مكتملة. |
| **خطة الإصلاح المقترحة** | إغلاق عنصر بعنصر مع حماية Smart Import والتقارير التنفيذية؛ لا تقليص لقدرة التقارير. |

### GAP-M04 — ازدواجية وثائق OTA وتعارضها مع الـ workflows

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | `docs/OTA_AUTO_UPDATE.md`؛ `docs/EXPO_BETA_TESTING.md`؛ Blueprint §16.2 |
| **الملفات المتأثرة** | الوثائق أعلاه؛ `.github/workflows/eas-ota-beta.yml`؛ `expo-ota-update.yml`؛ `frontend/app.json`؛ `frontend/eas.json`؛ `frontend/src/utils/ota-updates.ts` / `expo-ota.ts` |
| **سبب التعارض** | وثيقة تقول نشر من `master` عبر `eas-ota-beta.yml`؛ أخرى تقول `main` عبر `expo-ota-update.yml`. الكود يملك الاثنين. |
| **خطة الإصلاح المقترحة** | SSOT تشغيلي واحد تحت `docs/` يطابق الـ workflow الحي فقط؛ حذف أو تعطيل المسار الميت. |

### GAP-M05 — Observability / SLO / DR غير مكتملة

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | System Architecture §§19–20, SA-01..SA-03, SA-08؛ Blueprint §12.2 observability |
| **الملفات المتأثرة** | غياب طبقة tracing موحّدة؛ اعتماد health أساسي في الخدمة؛ لا runbook RPO/RTO رقمي |
| **سبب التعارض** | المعمارية المؤسسية تفرض ركائز traces/metrics/audits وSLO قبل ادعاءات التوفر. |
| **خطة الإصلاح المقترحة** | correlation ids لـ analysis/decision/approval/event؛ مقاييس gate؛ سياسة backup قبل تسويق SLA. |

### GAP-M06 — لا مُصيّر PDF على الخدمة (الاعتماد على Sheets فقط)

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §§10.3, 19؛ System Architecture SA-08 |
| **الملفات المتأثرة** | مسارات توليد التقرير المرتبطة بـ GAS؛ غياب renderer خدمي |
| **سبب التعارض** | متعمّد حالياً، لكنه فجوة عند غياب Sheets. |
| **خطة الإصلاح المقترحة** | إضافة fallback خدمي دون تقليل جودة التقرير أو كسر هوية Sheets كسلطة تنسيق عند الاتصال. |

### GAP-M07 — `deploy-smart-employee.yml` مفاتيح فروع مكررة / اسم نشر منفصل

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Governance §6.3؛ System Architecture §18.1 Experimental Arabic surface |
| **الملفات المتأثرة** | `.github/workflows/deploy-smart-employee.yml` (`name: Deploy stitch-saudi-smart`؛ `branches` مكررة تحت `push`) |
| **سبب التعارض** | الهوية مُصلَحة في PRODUCT، لكن اسم الـ workflow يوحي بمنتج منفصل؛ تكرار مفاتيح YAML هش. |
| **خطة الإصلاح المقترحة** | تنظيف YAML؛ إعادة تسمية الـ workflow إلى experimental SPP surface؛ التأكد أنه لا ينشر دستور/engines منفصلة. |

### GAP-M08 — تسمية مسار Flutter في خرائط الشاشات

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | `docs/STITCH_SCREEN_MAP.md`؛ Blueprint §4.1؛ `docs/README.md` |
| **الملفات المتأثرة** | `docs/STITCH_SCREEN_MAP.md` (يشير إلى `SPP_Flutter/frontend`) |
| **سبب التعارض** | المسار الفعلي هو `frontend/` (Expo). لا تطبيق Flutter. الخريطة تشغيلية وقد تضلل من يبحث عن Flutter Clean Architecture حرفي. |
| **خطة الإصلاح المقترحة** | تصحيح المسار إلى `frontend/`؛ توضيح أن «Flutter» هنا اسم مستودع/تاريخ وليس التقنية. |

---

## 5. Low

### GAP-L01 — MERGE_GATE_PLAN يشير لفرع تاريخي

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | `docs/MERGE_GATE_PLAN.md`؛ Governance §4 (operating/audit class) |
| **الملفات المتأثرة** | `docs/MERGE_GATE_PLAN.md` |
| **سبب التعارض** | يصف فرع `conflict_030726_0550` ومسار دمج قديم؛ ليس قانوناً، لكنه قد يُقرأ كخطة نشطة. |
| **خطة الإصلاح المقترحة** | تعليمه كـ historical/closed أو أرشفته تحت proofs. |

### GAP-L02 — تفضيلات الموظف على الجهاز فقط (إشارة تعلم ضعيفة)

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Blueprint §6.2؛ Engine Vision طبقة 3 |
| **الملفات المتأثرة** | `frontend/src/types/smart-employee.ts` (`EmployeePrefs`) |
| **سبب التعارض** | بداية خفيفة للتعلم ليست Client Profile رسمي — مرتبطة بـ GAP-H03. |
| **خطة الإصلاح المقترحة** | عند بناء Learning Layer، ترحيل هذه الإشارات إلى معرفة عميل قابلة للمزامنة. |

### GAP-L03 — فجوات مؤسسية مفتوحة أصلاً في System Architecture §23

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | System Architecture SA-01..SA-08؛ Blueprint §17 multi-agent |
| **الملفات المتأثرة** | لا تنفيذ للعامل المتعدد / multi-region / payment rail / maps |
| **سبب التعارض** | مُعلَّمة Planned/Absent — ليست انحرافاً صامتاً، لكن يجب تتبعها كفجوات منتج لا كـ «منجزة». |
| **خطة الإصلاح المقترحة** | الإبقاء على التتبع في Blueprint §19 / SA §23 فقط؛ منع اختصارات broker قبل envelope. |

### GAP-L04 — وثائق تشغيل APP_PATH ما زالت تحتاج عمود حالة (G-04)

> **Phase 1 status:** Closed — APP_PATH Blueprint status column added; Governance G-04 closed.

| الحقل | التفصيل |
|---|---|
| **الوثيقة المرجعية** | Architecture Governance G-04؛ APP_PATH vs Blueprint status legend |
| **الملفات المتأثرة** | `docs/APP_PATH.md`؛ `docs/ARCHITECTURE_GOVERNANCE.md` §8 |
| **سبب التعارض** | G-04 ما زال Open: APP_PATH يعلن Live بما قد يتجاوز Partial/Placeholder. |
| **خطة الإصلاح المقترحة** | إضافة عمود حالة يطابق Blueprint §§3.2, 8.2 حرفياً وإغلاق G-04. |

---

## 6. مصفوفة أولوية الإصلاح المقترحة

| الأولوية | الفجوات | مبدأ التنفيذ |
|---|---|---|
| 1 — ثقة وأمان | C01, C02, C03, C04, C05, C06 | أوقف الإرسال غير المُوافق، أغلق webhooks، أزل أسرار الجهاز، أصلح البناء/البوابة، صادق حالة التكامل في Blueprint |
| 2 — قطار الإصدار | C07, H01, M04, C03 | فرع واحد حي + OTA واحد + وثيقة تشغيل واحدة |
| 3 — نضج العمليات | H04, H05, H06, M05, M06 | envelope، متانة الأحداث، حالة HA، مراقبة، PDF fallback |
| 4 — الهيكل واللغة | H02, H07, M01, M08 | طبقات Clean Architecture تدريجياً، Koil naming، تصحيح مسارات docs |
| 5 — اكتمال المجال | H03, M02, M03, L02, L03 | Building، Invoice، Learning، longitudinal memory — بعد استقرار الثقة |

---

## 7. خارج النطاق / غير مُبلَّغ كفجوة تنفيذ

- تغيير هوية بصرية أو إعادة تصميم UI (محمي بهوية SPP).
- تعديل Smart Import mapping / أسماء أعمدة Sheets (محمي ما لم تُطلب مهمة صريحة).
- تنفيذ multi-agent Phase Two+ قبل envelope/worker (مرفوض معمارياً كاختصار).
- اعتبار `HANDOFF.md` أو ملاحظات الوكلاء قانوناً معمارياً.

---

## 8. حالة الوثيقة

*Document Status:* Implementation Gap Report (audit companion — not architectural law)  
*Class:* Audit / proof companion under repo root (should be promoted into `docs/` only if Governance §7 approves)  
*Code changes in this task:* **None** (report only)  
*Related open architecture trackers:* Governance G-04, G-07؛ Blueprint §19؛ Domain Model §9؛ System Architecture §23.3  
*v1.1:* أضيفت C05–C07 بعد تحقق متقاطع من تحليلات Frontend / Backend / CI (أسرار الجهاز، كسر البناء، غياب `origin/master`).
