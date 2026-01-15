#!/bin/bash

echo "=== Restarting Media Portal Services ==="

DIR="$(dirname "$(realpath "$0")")"

# Останавливаем
echo ""
echo "→ Stopping services..."
"$DIR/stop.sh"

sleep 1.5

# Запускаем
echo ""
echo "→ Starting services..."
"$DIR/start.sh"           # ← предполагается, что ваш исходный скрипт называется start.sh

echo ""
echo "======================================"
echo "Restart completed!"
echo ""