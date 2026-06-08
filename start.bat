@echo off
setlocal

echo ==========================================
echo   HRMS Application Launcher
echo ==========================================
echo.

REM ==========================================
REM Check if Node.js is installed
REM ==========================================
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Install Node.js from:
    echo https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js detected
echo.

REM ==========================================
REM Free Backend Port (3000)
REM ==========================================
echo [1/5] Freeing port 3000...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo [OK] Port 3000 freed
echo.

REM ==========================================
REM Free Frontend Port (5173)
REM ==========================================
echo [2/5] Freeing port 5173...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo [OK] Port 5173 freed
echo.

REM ==========================================
REM Install Root Dependencies
REM ==========================================
echo [3/5] Installing ROOT dependencies...

cd /d "%~dp0"

if exist "package.json" (
    call npm install

    if errorlevel 1 (
        echo [ERROR] Failed to install ROOT dependencies
        pause
        exit /b 1
    )

    echo [OK] Root dependencies installed
) else (
    echo [SKIP] No root package.json found
)

echo.

REM ==========================================
REM Install Backend Dependencies
REM ==========================================
echo [4/5] Installing BACKEND dependencies...

cd /d "%~dp0backend"

if exist "package.json" (
    call npm install

    if errorlevel 1 (
        echo [ERROR] Failed to install BACKEND dependencies
        pause
        exit /b 1
    )

    echo [OK] Backend dependencies installed
) else (
    echo [ERROR] Backend package.json not found
    pause
    exit /b 1
)

echo.

REM ==========================================
REM Install Frontend Dependencies
REM ==========================================
echo [5/5] Installing FRONTEND dependencies...

cd /d "%~dp0frontend"

if exist "package.json" (
    call npm install

    if errorlevel 1 (
        echo [ERROR] Failed to install FRONTEND dependencies
        pause
        exit /b 1
    )

    echo [OK] Frontend dependencies installed
) else (
    echo [ERROR] Frontend package.json not found
    pause
    exit /b 1
)

echo.

REM ==========================================
REM Start Both Servers In One Terminal
REM ==========================================
echo Starting Backend + Frontend...
echo.

cd /d "%~dp0"

start "" cmd /k "cd backend && npm run dev"
start "" cmd /k "cd frontend && npm run dev"

echo Both servers are starting in separate windows...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Press any key to stop both servers...
pause >nul

taskkill /FI "WINDOWTITLE eq Backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend*" /T /F >nul 2>&1

echo.
echo ==========================================
echo Application stopped
echo ==========================================

pause