#!/bin/bash

# Configuration - те же пути, что и в стартовом скрипте
PROJECT_ROOT="/data/xHomePro/xHome/movie-book-portal"
LOG_DIR="$HOME"

PORTS_TO_KILL=(5055 5050)

echo "=== Stopping Media Portal Services ==="

for PORT in "${PORTS_TO_KILL[@]}"; do
    echo -n "Looking for processes on port $PORT... "

    # Находим PID процессов, которые слушают нужный порт
    PIDS=$(lsof -t -iTCP:$PORT -sTCP:LISTEN 2>/dev/null)

    if [ -z "$PIDS" ]; then
        echo "nothing found"
        continue
    fi

    count=$(echo "$PIDS" | wc -w)
    echo "found $count process(es)"

    for PID in $PIDS; do
        echo "  Killing PID $PID ($(ps -p $PID -o comm= 2>/dev/null || echo 'unknown'))"
        kill "$PID" 2>/dev/null
        sleep 0.4
        # Если не умер с первого раза — добиваем
        kill -9 "$PID" 2>/dev/null
    done
done

echo "----------------------------------------"
echo "Checking remaining processes on ports..."

# Финальная проверка
still_alive=""
for PORT in "${PORTS_TO_KILL[@]}"; do
    if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
        still_alive="$still_alive $PORT"
    fi
done

if [ -n "$still_alive" ]; then
    echo "Warning! Some processes still alive on ports:$still_alive"
    echo "You can check them with:"
    echo "  lsof -iTCP:5055 -sTCP:LISTEN"
    echo "  lsof -iTCP:5050 -sTCP:LISTEN"
else
    echo "All processes on target ports successfully terminated ✓"
fi

echo ""