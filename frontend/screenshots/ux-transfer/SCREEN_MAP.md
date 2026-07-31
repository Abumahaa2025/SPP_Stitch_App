# SPP UX Transfer — Web → Mobile Screen Map

Reference: `SPP_Official/v3pro.html` PAGE_META + capFeatureContext

| # | Screen | Web (Source) | Mobile route | Mobile pattern |
|---|--------|--------------|--------------|----------------|
| 1 | Home / Inbox | يومك · كويل — ما يهم اليوم فقط | `/` | KPI strip + pulse row + upload + inbox + intelligence + memory |
| 2 | Upload | الاستيراد الذكي (7 steps) | `/upload` | WebPageChrome + steps + multi-file + per-file report |
| 3 | Portfolio | Insights / weakest first | `/portfolio` | WebPageChrome + KPI strip + property cards |
| 4 | Property | خريطة العمارة / unit modal fields | `/property/[id]` | Labeled ApiField overview + explainer |
| 5 | Intelligence | Executive patterns | `/insights` + `/intelligence` | Full-width labeled insight cards |
| 6 | Memory | ذاكرة العقار / asset graph | `/memory` | Stats + watchlist + expanded assets |
| 7 | Maintenance | طلبات الصيانة + سجل | `/maintenance` | Explain first + labeled decisions + memory context |
| 8 | Health | صحة العقار 0–100 | `/health` | KPI strip + composite ring + ranked list |
| 9 | Notifications | مركز التنبيهات | `/notifications` | KPI strip + labeled feed |

## Per-file result (upload) — required fields

| Field | Arabic key |
|-------|------------|
| Source file | الملف المصدر |
| Document type | نوع الملف |
| Summary | الملخص |
| Detected info | المعلومات المستخرجة |
| Why it matters | لماذا هذا مهم |
| Recommended action | الإجراء المقترح |
| Confidence | مستوى الثقة |

## Capture screenshots

```bash
cd SPP_Flutter/frontend
npx expo start --web
# Open http://localhost:8081 (or port shown) — Arabic mode default
# Capture: /, /upload, /portfolio, /property/{id}, /insights, /intelligence, /memory, /maintenance, /health, /notifications
```

Save captures as `screenshots/ux-transfer/mobile-{screen}.png`
