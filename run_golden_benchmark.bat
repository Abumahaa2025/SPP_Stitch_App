@echo off
REM SPP Golden Benchmark — one command, reads files from benchmarks/golden_benchmark/files/
cd /d "%~dp0"
python backend\scripts\run_golden_benchmark.py
exit /b %ERRORLEVEL%
