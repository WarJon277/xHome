#!/bin/bash

# Restart script for Auto-Discovery services
# Usage: ./restart_discovery.sh [books|movies|all]

echo "=== Restarting Auto-Discovery Services ==="

DIR="$(dirname "$(realpath "$0")")"
BACKEND_DIR="$DIR/backend"
LOG_DIR="$DIR/logs"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to restart a service
restart_service() {
    local script_name=$1
    local service_name=$2
    local log_file=$3
    
    echo ""
    echo "→ Restarting $service_name..."
    
    # Stop existing process
    pkill -f "python.*$script_name" && echo "  ✓ Stopped old process" || echo "  ℹ No running process found"
    
    sleep 1
    
    # Start new process
    cd "$BACKEND_DIR" || { echo "❌ Cannot cd to backend directory"; exit 1; }
    
    nohup python "$script_name" > "$log_file" 2>&1 &
    NEW_PID=$!
    
    echo "  ✓ Started with PID: $NEW_PID"
    echo "  📄 Log file: $log_file"
}

# Parse command line argument
MODE="${1:-all}"

case "$MODE" in
    books)
        restart_service "auto_discovery.py" "Book Auto-Discovery" "$LOG_DIR/auto_discovery.log"
        ;;
    movies)
        restart_service "movie_auto_discovery.py" "Movie Auto-Discovery" "$LOG_DIR/movie_discovery.log"
        ;;
    all)
        restart_service "auto_discovery.py" "Book Auto-Discovery" "$LOG_DIR/auto_discovery.log"
        restart_service "movie_auto_discovery.py" "Movie Auto-Discovery" "$LOG_DIR/movie_discovery.log"
        ;;
    *)
        echo "❌ Invalid argument: $MODE"
        echo ""
        echo "Usage: $0 [books|movies|all]"
        echo "  books  - restart only book auto-discovery"
        echo "  movies - restart only movie auto-discovery"
        echo "  all    - restart both services (default)"
        exit 1
        ;;
esac

echo ""
echo "========================================"
echo "Auto-Discovery services restarted!"
echo ""
echo "To view logs:"
if [ "$MODE" = "books" ] || [ "$MODE" = "all" ]; then
    echo "  tail -f $LOG_DIR/auto_discovery.log"
fi
if [ "$MODE" = "movies" ] || [ "$MODE" = "all" ]; then
    echo "  tail -f $LOG_DIR/movie_discovery.log"
fi
echo ""
echo "To stop:"
if [ "$MODE" = "books" ] || [ "$MODE" = "all" ]; then
    echo "  pkill -f 'python.*auto_discovery.py'"
fi
if [ "$MODE" = "movies" ] || [ "$MODE" = "all" ]; then
    echo "  pkill -f 'python.*movie_auto_discovery.py'"
fi
echo "========================================"
