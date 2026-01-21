#!/bin/bash

# Restart script for Book Auto-Discovery
# Stops and restarts the auto_discovery.py script

echo "=== Restarting Book Auto-Discovery ==="

DIR="$(dirname "$(realpath "$0")")"
BACKEND_DIR="$DIR/backend"
SCRIPT_NAME="auto_discovery.py"

# Stop existing process
echo "→ Stopping existing process..."
pkill -f "python.*$SCRIPT_NAME" && echo "  ✓ Stopped old process" || echo "  ℹ No running process found"

sleep 1

# Start new process
echo "→ Starting $SCRIPT_NAME..."
cd "$BACKEND_DIR" || { echo "❌ Cannot cd to backend directory"; exit 1; }

nohup python "$SCRIPT_NAME" > "$DIR/logs/auto_discovery.log" 2>&1 &
NEW_PID=$!

echo "  ✓ Started with PID: $NEW_PID"
echo "  📄 Log file: $DIR/logs/auto_discovery.log"

echo ""
echo "========================================"
echo "Book Auto-Discovery restarted!"
echo ""
echo "To view logs:"
echo "  tail -f $DIR/logs/auto_discovery.log"
echo ""
echo "To stop:"
echo "  pkill -f 'python.*$SCRIPT_NAME'"
echo "========================================"
