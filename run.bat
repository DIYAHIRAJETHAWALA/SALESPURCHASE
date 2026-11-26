@echo off
title FranchisePro - Sales & Purchase Analytics
color 0b
cd /d "%~dp0"
echo =====================================================================
echo       FRANCHISEPRO - SALES ^& PURCHASE EXCEL ANALYTICS
echo =====================================================================
echo.

set "PYTHON_EXE=python"
if exist ".venv\Scripts\python.exe" (
    set "PYTHON_EXE=.venv\Scripts\python.exe"
)

echo [1/2] Starting Local Website on http://127.0.0.1:8000 ...
start "FranchisePro Server" cmd /k "%PYTHON_EXE% -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"
timeout /t 2 >nul

echo [2/2] Opening http://127.0.0.1:8000 in your browser...
start http://127.0.0.1:8000
