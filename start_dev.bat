@echo off
title Sales & Purchase Combiner - Dev Mode
color 0a
echo =====================================================================
echo       SALES & PURCHASE DEVELOPMENT MODE
echo       BACKEND (8000) + FRONTEND (5173)
echo =====================================================================
echo.
echo Starting FastAPI Backend on port 8000 with reload...
start "Backend API (Port 8000)" cmd /k "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting Vite React Dev Server on port 5173...
start "Frontend UI (Port 5173)" cmd /k "cd frontend && npm run dev"

timeout /t 3 >nul
start http://localhost:5173
echo Both services launched! Press any key to close this launcher.
pause
