@echo off
REM استورد ملفات Golden Benchmark — يفتح File Picker ثم يشغّل خط الإنتاج
cd /d "%~dp0"
python backend\scripts\import_golden_benchmark.py
if errorlevel 1 pause
exit /b %ERRORLEVEL%
