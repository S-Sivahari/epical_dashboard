@echo off
echo Starting Frontend and Backend...

REM Start Backend in a new window
echo Starting Backend...
start cmd /k "cd backend && npm run dev"

REM Start Frontend in a new window
echo Starting Frontend...
start cmd /k "cd frontend && npm run dev"

echo Both services are starting...
echo Frontend will run on http://localhost:5173/
echo Backend will run on http://localhost:3000/
pause
