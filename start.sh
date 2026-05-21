#!/bin/bash

# FLOW - HRMS Application Launcher (macOS/Linux)
# This script sets up and starts both frontend and backend

set -e  # Exit on error

echo "=========================================="
echo "  F.L.O.W - HRMS Application Launcher"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js detected: $(node --version)"
echo ""

# Kill any existing processes on ports 3000 and 5173
echo "[1/6] Freeing ports 3000 and 5173..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
echo "✓ Ports freed"
echo ""

# Install backend dependencies
echo "[2/6] Installing backend dependencies..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "    Running: npm install"
    npm install
else
    echo "    ✓ Backend dependencies already installed"
fi
cd ..
echo "✓ Backend ready"
echo ""

# Install frontend dependencies
echo "[3/6] Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "    Running: npm install"
    npm install
else
    echo "    ✓ Frontend dependencies already installed"
fi
cd ..
echo "✓ Frontend ready"
echo ""

# Start backend
echo "[4/6] Starting Backend on http://localhost:3000..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..
echo "✓ Backend starting (PID: $BACKEND_PID)"

# Wait for backend to start
sleep 4

# Start frontend
echo "[5/6] Starting Frontend on http://localhost:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..
echo "✓ Frontend starting (PID: $FRONTEND_PID)"
echo ""

echo "=========================================="
echo "✓ Application started successfully!"
echo "=========================================="
echo ""
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Backend PID:  $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "To stop the servers, run:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""

# Keep script running
wait
