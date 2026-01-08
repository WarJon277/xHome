#!/bin/bash

# Configuration - adjust these paths if necessary
PROJECT_ROOT="/home/xxar/xHomePro/xHome/movie-book-portal"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend-react"
PYTHON_VENV="$PROJECT_ROOT/venv/bin/python"
LOG_DIR="$HOME"

echo "=== Starting Media Portal Services ==="

# 1. Start Backend on port 5055
echo "Starting Backend on port 5055..."
cd "$BACKEND_DIR" || exit
nohup "$PYTHON_VENV" -m uvicorn main:app --host 0.0.0.0 --port 5055 > "$LOG_DIR/backend.log" 2>&1 &
echo "Backend started in background. Log: $LOG_DIR/backend.log"

# 2. Start Frontend on port 5050
echo "Starting Frontend on port 5050..."
cd "$FRONTEND_DIR" || exit

if [ ! -d "node_modules" ]; then
    echo "ERROR: node_modules not found in $FRONTEND_DIR"
    echo "Please run 'npm install' in that directory first!"
    exit 1
fi

nohup npm run dev -- --host 0.0.0.0 > "$LOG_DIR/frontend.log" 2>&1 &
echo "Frontend started in background. Log: $LOG_DIR/frontend.log"

echo "======================================"
echo "Services are running!"
echo "Backend:  http://[YOUR_IP]:5055"
echo "Frontend: http://[YOUR_IP]:5050"
echo "======================================"
