#!/bin/bash

# Скрипт для установки и запуска TTS-сервера на Linux

set -e  # Прекращать выполнение при ошибках

echo "=== Установка и запуск TTS-сервера ==="

# Проверка наличия Python 3.12
if command -v python3.12 &> /dev/null; then
    PYTHON_CMD="python3.12"
    echo "Найден Python 3.12"
elif command -v python3 &> /dev/null; then
    PY_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
    if [[ "$PY_VERSION" == "3.12"* ]]; then
        PYTHON_CMD="python3"
        echo "Найден Python $PY_VERSION"
    else
        echo "Требуется Python 3.12, но найдена версия $PY_VERSION"
        echo "Пожалуйста, установите Python 3.12 и повторите попытку"
        exit 1
    fi
else
    echo "Python 3.12 не найден. Пожалуйста, установите Python 3.12 и повторите попытку"
    exit 1
fi

# Создание виртуального окружения
echo "Создание виртуального окружения..."
$PYTHON_CMD -m venv venv

# Активация виртуального окружения
source venv/bin/activate

# Установка зависимостей
echo "Установка зависимостей..."
pip install --upgrade pip
pip install -r requirements.txt

# Установка переменной окружения для автоматического согласия с лицензией
export COQUI_TOS_AGREED=1

echo "=== Запуск TTS-сервера ==="
echo "Сервер будет доступен на http://127.0.1:8002"
echo "При первом запуске будет загружена модель XTTS-v2 (около 1.5 ГБ)"
echo "Это может занять несколько минут в зависимости от скорости интернета"
echo ""
echo "Для остановки сервера нажмите Ctrl+C"

# Запуск сервера
python tts_server.py