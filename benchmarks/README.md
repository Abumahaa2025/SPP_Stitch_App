# SPP Benchmark Library

ملفات الاختبار = QA فقط — ليست منطق المحرك.

## الأمر المعتمد (بدون Attach في Cursor)

Cursor **لا يدعم** رفع Excel في الشات. استخدم:

```
استورد ملفات Golden Benchmark
```

أو انقر مرتين: `استورد_ملفات_Golden_Benchmark.bat`

يفتح File Picker → تختار الملفات → نفس Production Pipeline (`/upload/portfolio-analysis`).

## CLI

```bash
python backend/scripts/import_golden_benchmark.py
python backend/scripts/run_golden_benchmark.py
```

## التقارير

```
benchmarks/library/sets/golden/understanding_report.txt
benchmarks/library/sets/golden/latest_summary.txt
```
