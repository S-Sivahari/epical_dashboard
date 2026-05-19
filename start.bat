@echo off
echo ========================================
echo   F.L.O.W - HRMS Application Launcher
echo ========================================

REM Kill any processes on port 3000 (backend)
echo [1/4] Freeing port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Kill any processes on port 5173 (frontend)
echo [2/4] Freeing port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Start Backend
echo [3/4] Starting Backend on http://localhost:3000 ...
start cmd /k "cd /d "%~dp0backend" && npm run dev"

REM Wait a moment for backend to connect to DB
timeout /t 3 /nobreak >nul

REM Start Frontend
echo [4/4] Starting Frontend on http://localhost:5173 ...
start cmd /k "cd /d "%~dp0frontend" && npm run dev"
