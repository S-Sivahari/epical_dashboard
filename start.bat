@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo   F.L.O.W - HRMS Application Launcher
echo ==========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✓ Node.js detected
echo.

REM Kill any processes on port 3000 (backend)
echo [1/6] Freeing port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo ✓ Port 3000 freed

REM Kill any processes on port 5173 (frontend)
echo [2/6] Freeing port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo ✓ Port 5173 freed
echo.

REM Install Backend dependencies
echo [3/6] Installing backend dependencies...
cd /d "%~dp0backend"
if not exist "node_modules" (
    echo    Running: npm install
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install backend dependencies
        pause
        exit /b 1
    )
) else (
    echo    ✓ Backend dependencies already installed
)
echo ✓ Backend ready
echo.

REM Install Frontend dependencies
echo [4/6] Installing frontend dependencies...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo    Running: npm install
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install frontend dependencies
        pause
        exit /b 1
    )
) else (
    echo    ✓ Frontend dependencies already installed
)
echo ✓ Frontend ready
echo.

REM Start Backend
echo [5/6] Starting Backend on http://localhost:3000 ...
cd /d "%~dp0backend"
start "Backend (Node.js)" cmd /k "npm run dev"
echo ✓ Backend starting...

REM Wait for backend to connect to DB
timeout /t 4 /nobreak >nul

REM Start Frontend
echo [6/6] Starting Frontend on http://localhost:5173 ...
cd /d "%~dp0frontend"
start "Frontend (React/Vite)" cmd /k "npm run dev"
echo ✓ Frontend starting...
echo.

echo ==========================================
echo ✓ Application started successfully!
echo ==========================================
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Note: You can close this window. The servers will continue running.
echo Press Ctrl+C in the server windows to stop them.
pause
