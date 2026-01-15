#!/bin/bash

# Configuration
PROJECT_ROOT="/data/xHomePro/xHome/movie-book-portal"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend-react"  # или "$PROJECT_ROOT/frontend" - выберите нужный
VENV_DIR="$PROJECT_ROOT/.venv"
UVICORN_PATH="$VENV_DIR/bin/uvicorn"
LOG_DIR="$PROJECT_ROOT/logs"

BACKEND_PORT=5055
FRONTEND_PORT=5050

MAX_WAIT_SEC=45
CHECK_INTERVAL=2

echo "=== Starting Media Portal Services ==="
echo "Project root: $PROJECT_ROOT"
echo "Backend dir:  $BACKEND_DIR"
echo "Frontend dir: $FRONTEND_DIR"
echo "Venv dir:     $VENV_DIR"

# ────────────────────────────────────────────────────────────────
# Проверка зависимостей
# ────────────────────────────────────────────────────────────────
echo ""
echo "1. Проверка зависимостей..."

# Проверка uvicorn
if [ ! -f "$UVICORN_PATH" ]; then
    echo "❌ ERROR: uvicorn не найден: $UVICORN_PATH"
    echo "   Активируйте venv и установите: pip install uvicorn"
    exit 1
fi

# Проверка backend
if [ ! -f "$BACKEND_DIR/main.py" ]; then
    echo "❌ ERROR: main.py не найден в $BACKEND_DIR"
    exit 1
fi

# Проверка frontend
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "⚠️  WARNING: $FRONTEND_DIR не существует"
    
    # Проверить другой вариант frontend
    if [ -d "$PROJECT_ROOT/frontend" ]; then
        FRONTEND_DIR="$PROJECT_ROOT/frontend"
        echo "   Использую: $FRONTEND_DIR"
    else
        echo "❌ ERROR: Ни один frontend не найден"
        echo "   Доступные варианты:"
        ls -d "$PROJECT_ROOT"/frontend* 2>/dev/null
        exit 1
    fi
fi

# Создать директорию для логов
mkdir -p "$LOG_DIR"

# ────────────────────────────────────────────────────────────────
# 1. Запуск Backend
# ────────────────────────────────────────────────────────────────
echo ""
echo "2. Запуск Backend (port $BACKEND_PORT)..."
cd "$BACKEND_DIR" || { echo "❌ Cannot cd to backend directory"; exit 1; }

# Останавливаем старый процесс если он есть
pkill -f "uvicorn.*$BACKEND_PORT" 2>/dev/null && echo "   Остановлен старый backend процесс"

# Запускаем backend
echo "   Запуск: $UVICORN_PATH main:app --host 0.0.0.0 --port $BACKEND_PORT"
echo "   Директория: $(pwd)"
echo "   Main.py: $(ls -la main.py)"

nohup "$UVICORN_PATH" main:app \
    --host 0.0.0.0 \
    --port $BACKEND_PORT \
    --reload \
    > "$LOG_DIR/backend.log" 2>&1 &

BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo "   Log file: $LOG_DIR/backend.log"

# ────────────────────────────────────────────────────────────────
# 2. Запуск Frontend
# ────────────────────────────────────────────────────────────────
echo ""
echo "3. Запуск Frontend (port $FRONTEND_PORT)..."
cd "$FRONTEND_DIR" || { echo "❌ Cannot cd to frontend directory"; exit 1; }

echo "   Frontend директория: $(pwd)"
echo "   Содержимое:"
ls -la

# Проверка package.json
if [ ! -f "package.json" ]; then
    echo "❌ ERROR: package.json not found"
    exit 1
fi

# Проверка node_modules
if [ ! -d "node_modules" ]; then
    echo "⚠️  WARNING: node_modules not found!"
    echo "   Запускаю 'npm install'..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ ERROR: npm install failed"
        exit 1
    fi
fi

# Останавливаем старый процесс если он есть
pkill -f "vite.*$FRONTEND_PORT" 2>/dev/null && echo "   Остановлен старый frontend процесс"

# Определяем скрипт для запуска
DEV_SCRIPT="dev"
if ! grep -q '"dev"' package.json; then
    echo "⚠️  Скрипт 'dev' не найден в package.json"
    echo "   Доступные скрипты:"
    grep -A 10 '"scripts"' package.json
    read -p "   Введите имя скрипта (например: start): " DEV_SCRIPT
fi

# Запускаем frontend
echo "   Запуск: npm run $DEV_SCRIPT -- --host 0.0.0.0 --port $FRONTEND_PORT"
nohup npm run $DEV_SCRIPT -- --host 0.0.0.0 --port $FRONTEND_PORT > "$LOG_DIR/frontend.log" 2>&1 &

FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
echo "   Log file: $LOG_DIR/frontend.log"

# ────────────────────────────────────────────────────────────────
# Сохраняем PIDs
# ────────────────────────────────────────────────────────────────
echo "$BACKEND_PID" > "$LOG_DIR/backend.pid"
echo "$FRONTEND_PID" > "$LOG_DIR/frontend.pid"

# ────────────────────────────────────────────────────────────────
# Функция проверки порта
# ────────────────────────────────────────────────────────────────
port_ready() {
    timeout 1 bash -c "echo > /dev/tcp/127.0.0.1/$1" 2>/dev/null
    return $?
}

echo ""
echo "=============================================================="
echo "Ожидание запуска сервисов (максимум $MAX_WAIT_SEC секунд)..."
echo "=============================================================="

backend_ready=false
frontend_ready=false
start_time=$(date +%s)

for ((i=1; i<=MAX_WAIT_SEC; i+=CHECK_INTERVAL)); do
    # Проверяем backend
    if ! $backend_ready && port_ready $BACKEND_PORT; then
        backend_ready=true
        echo -e "\n✓ Backend готов (port $BACKEND_PORT) через ${i}s"
    fi

    # Проверяем frontend
    if ! $frontend_ready && port_ready $FRONTEND_PORT; then
        frontend_ready=true
        echo -e "\n✓ Frontend готов (port $FRONTEND_PORT) через ${i}s"
    fi

    # Прогресс-бар
    progress=$((i * 100 / MAX_WAIT_SEC))
    bar_length=30
    filled=$((progress * bar_length / 100))
    empty=$((bar_length - filled))
    
    bar=$(printf "%${filled}s" | tr ' ' '█')
    empty_bar=$(printf "%${empty}s" | tr ' ' '░')
    
    printf "\r[%3d%%] [%s%s] Ожидание..." "$progress" "$bar" "$empty_bar"

    if $backend_ready && $frontend_ready; then
        break
    fi

    sleep $CHECK_INTERVAL
done

end_time=$(date +%s)
duration=$((end_time - start_time))

echo ""
echo ""
echo "=============================================================="
echo "Время запуска: ${duration} секунд"
echo ""

if $backend_ready && $frontend_ready; then
    echo -e "\033[0;32m✅ ВСЕ СЕРВИСЫ ЗАПУЩЕНЫ!\033[0m"
else
    echo -e "\033[0;33m⚠️  НЕ ВСЕ СЕРВИСЫ ЗАПУСТИЛИСЬ\033[0m"
fi

echo ""
echo "СТАТУС:"
echo "  Backend:  $(if $backend_ready; then echo "✅ http://localhost:$BACKEND_PORT"; else echo "❌ не готов"; fi)"
echo "  Frontend: $(if $frontend_ready; then echo "✅ http://localhost:$FRONTEND_PORT"; else echo "❌ не готов"; fi)"
echo ""
echo "ЛОГИ:"
echo "  Backend:  tail -f $LOG_DIR/backend.log"
echo "  Frontend: tail -f $LOG_DIR/frontend.log"
echo ""
echo "ПРОВЕРКА:"
echo "  curl http://localhost:$BACKEND_PORT/"
echo "  curl http://localhost:$FRONTEND_PORT/"
echo ""
echo "ОСТАНОВИТЬ:"
echo "  pkill -f 'uvicorn.*$BACKEND_PORT'"
echo "  pkill -f 'vite.*$FRONTEND_PORT'"
echo "  или запустите: ./stop.sh"
echo "=============================================================="

# Показать последние строки логов если есть ошибки
if ! $backend_ready || ! $frontend_ready; then
    echo ""
    echo "ПОСЛЕДНИЕ СООБЩЕНИЯ ИЗ ЛОГОВ:"
    
    if ! $backend_ready; then
        echo "Backend log (last 10 lines):"
        tail -10 "$LOG_DIR/backend.log" 2>/dev/null || echo "  Log file not found"
    fi
    
    if ! $frontend_ready; then
        echo "Frontend log (last 10 lines):"
        tail -10 "$LOG_DIR/frontend.log" 2>/dev/null || echo "  Log file not found"
    fi
fi