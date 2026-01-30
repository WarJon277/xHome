"""
Скрипт для проверки и исправления видеофайлов фильмов
Проверяет:
- Количество аудиоканалов (должно быть 2 - стерео)
- Формат видео (H.264)
- Формат аудио (AAC)
- Возможность воспроизведения в браузере

Если файл не соответствует требованиям - автоматически переконвертирует его.
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from typing import Optional, Dict
from datetime import datetime

# Импортируем наш конвертер
from services.video_converter import convert_to_mp4, get_video_info, log_message

# Путь к папке с фильмами
MOVIES_DIR = os.path.join(os.path.dirname(__file__), 'uploads', 'movies')
LOG_FILE = os.path.join(os.path.dirname(__file__), 'logs', 'fix_movies.log')

def ensure_log_dir():
    """Создать папку для логов если её нет"""
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

def check_video_compatibility(video_path: str) -> Dict[str, any]:
    """
    Проверить совместимость видео с браузером
    
    Returns:
        dict: {
            'compatible': bool,
            'issues': list of str,
            'audio_channels': int,
            'video_codec': str,
            'audio_codec': str
        }
    """
    result = {
        'compatible': True,
        'issues': [],
        'audio_channels': None,
        'video_codec': None,
        'audio_codec': None
    }
    
    # Получаем информацию о видео
    info = get_video_info(video_path)
    
    if not info:
        result['compatible'] = False
        result['issues'].append('Не удалось получить информацию о видео')
        return result
    
    # Проверяем потоки
    streams = info.get('streams', [])
    
    video_stream = None
    audio_stream = None
    
    for stream in streams:
        codec_type = stream.get('codec_type', '')
        
        if codec_type == 'video' and not video_stream:
            video_stream = stream
        elif codec_type == 'audio' and not audio_stream:
            audio_stream = stream
    
    # Проверка видео кодека
    if video_stream:
        video_codec = video_stream.get('codec_name', '')
        result['video_codec'] = video_codec
        
        if video_codec not in ['h264', 'avc']:
            result['compatible'] = False
            result['issues'].append(f'Видео кодек {video_codec} не поддерживается, нужен H.264')
    else:
        result['compatible'] = False
        result['issues'].append('Видео поток не найден')
    
    # Проверка аудио кодека и каналов
    if audio_stream:
        audio_codec = audio_stream.get('codec_name', '')
        result['audio_codec'] = audio_codec
        
        channels = audio_stream.get('channels', 0)
        result['audio_channels'] = channels
        
        if audio_codec not in ['aac']:
            result['compatible'] = False
            result['issues'].append(f'Аудио кодек {audio_codec} не поддерживается, нужен AAC')
        
        # ГЛАВНАЯ ПРОВЕРКА: количество каналов
        if channels != 2:
            result['compatible'] = False
            result['issues'].append(f'Аудио имеет {channels} каналов, нужно 2 (стерео) для браузера')
    else:
        result['compatible'] = False
        result['issues'].append('Аудио поток не найден')
    
    return result

def fix_video(video_path: str, backup: bool = True) -> bool:
    """
    Исправить видео файл
    
    Args:
        video_path: Путь к видео
        backup: Создать резервную копию
        
    Returns:
        True если успешно исправлено
    """
    try:
        # Создаем временный путь для нового файла
        temp_path = video_path.replace('.mp4', '_fixed_temp.mp4')
        
        log_message(f"🔧 Исправление файла: {os.path.basename(video_path)}", LOG_FILE)
        
        # Конвертируем
        success = convert_to_mp4(video_path, temp_path, delete_source=False, log_file=LOG_FILE)
        
        if not success:
            log_message(f"❌ Ошибка конвертации: {os.path.basename(video_path)}", LOG_FILE)
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return False
        
        # Проверяем исправленный файл
        log_message(f"🔍 Проверка исправленного файла...", LOG_FILE)
        check_result = check_video_compatibility(temp_path)
        
        if not check_result['compatible']:
            log_message(f"❌ Исправленный файл всё ещё несовместим: {check_result['issues']}", LOG_FILE)
            os.remove(temp_path)
            return False
        
        # Создаем резервную копию если нужно
        if backup:
            backup_path = video_path.replace('.mp4', '_backup.mp4')
            log_message(f"💾 Создание резервной копии: {os.path.basename(backup_path)}", LOG_FILE)
            
            if os.path.exists(backup_path):
                # Если backup уже существует, удаляем старый
                os.remove(backup_path)
            
            os.rename(video_path, backup_path)
            log_message(f"✅ Резервная копия создана", LOG_FILE)
        else:
            # Удаляем оригинал
            os.remove(video_path)
        
        # Переименовываем временный файл в оригинальное имя
        os.rename(temp_path, video_path)
        
        log_message(f"✅ Файл успешно исправлен: {os.path.basename(video_path)}", LOG_FILE)
        log_message(f"   Аудио каналов: {check_result['audio_channels']}", LOG_FILE)
        
        return True
        
    except Exception as e:
        log_message(f"❌ Ошибка при исправлении файла: {e}", LOG_FILE)
        return False

def scan_and_fix_movies(auto_fix: bool = False, backup: bool = True):
    """
    Сканировать папку с фильмами и исправить проблемные
    
    Args:
        auto_fix: Автоматически исправлять без подтверждения
        backup: Создавать резервные копии
    """
    ensure_log_dir()
    
    log_message("=" * 80, LOG_FILE)
    log_message("🎬 ПРОВЕРКА ВИДЕОФАЙЛОВ ФИЛЬМОВ", LOG_FILE)
    log_message("=" * 80, LOG_FILE)
    
    if not os.path.exists(MOVIES_DIR):
        log_message(f"❌ Папка с фильмами не найдена: {MOVIES_DIR}", LOG_FILE)
        return
    
    # Находим все MP4 файлы
    mp4_files = []
    for file in os.listdir(MOVIES_DIR):
        if file.lower().endswith('.mp4') and not file.endswith('_backup.mp4'):
            mp4_files.append(os.path.join(MOVIES_DIR, file))
    
    log_message(f"📁 Найдено файлов: {len(mp4_files)}", LOG_FILE)
    print(f"\n📁 Найдено файлов: {len(mp4_files)}\n")
    
    if not mp4_files:
        log_message("ℹ️  Нет файлов для проверки", LOG_FILE)
        return
    
    # Статистика
    total = len(mp4_files)
    compatible = 0
    incompatible = 0
    fixed = 0
    failed = 0
    
    incompatible_files = []
    
    # Проверяем каждый файл
    for idx, video_path in enumerate(mp4_files, 1):
        filename = os.path.basename(video_path)
        log_message(f"\n[{idx}/{total}] 🔍 Проверка: {filename}", LOG_FILE)
        print(f"[{idx}/{total}] Проверка: {filename}")
        
        check_result = check_video_compatibility(video_path)
        
        if check_result['compatible']:
            log_message(f"✅ Совместим с браузером", LOG_FILE)
            log_message(f"   Видео: {check_result['video_codec']}, Аудио: {check_result['audio_codec']}, Каналов: {check_result['audio_channels']}", LOG_FILE)
            print(f"   ✅ OK - Каналов: {check_result['audio_channels']}")
            compatible += 1
        else:
            log_message(f"⚠️  НЕСОВМЕСТИМ!", LOG_FILE)
            for issue in check_result['issues']:
                log_message(f"   - {issue}", LOG_FILE)
                print(f"   ⚠️  {issue}")
            
            incompatible += 1
            incompatible_files.append({
                'path': video_path,
                'filename': filename,
                'issues': check_result['issues']
            })
    
    # Итоговая статистика
    log_message("\n" + "=" * 80, LOG_FILE)
    log_message("📊 ИТОГОВАЯ СТАТИСТИКА", LOG_FILE)
    log_message("=" * 80, LOG_FILE)
    log_message(f"Всего файлов: {total}", LOG_FILE)
    log_message(f"✅ Совместимых: {compatible}", LOG_FILE)
    log_message(f"⚠️  Несовместимых: {incompatible}", LOG_FILE)
    
    print(f"\n{'=' * 60}")
    print(f"📊 ИТОГОВАЯ СТАТИСТИКА")
    print(f"{'=' * 60}")
    print(f"Всего файлов: {total}")
    print(f"✅ Совместимых: {compatible}")
    print(f"⚠️  Несовместимых: {incompatible}")
    
    # Если есть несовместимые файлы
    if incompatible_files:
        log_message("\n⚠️  СПИСОК НЕСОВМЕСТИМЫХ ФАЙЛОВ:", LOG_FILE)
        print(f"\n⚠️  СПИСОК НЕСОВМЕСТИМЫХ ФАЙЛОВ:")
        
        for idx, file_info in enumerate(incompatible_files, 1):
            log_message(f"{idx}. {file_info['filename']}", LOG_FILE)
            print(f"{idx}. {file_info['filename']}")
            for issue in file_info['issues']:
                log_message(f"   - {issue}", LOG_FILE)
        
        # Исправление
        if auto_fix:
            log_message("\n🔧 АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ", LOG_FILE)
            print(f"\n🔧 Начинаем автоматическое исправление...\n")
        else:
            print(f"\n🔧 Исправить несовместимые файлы?")
            response = input(f"Введите 'y' для исправления (будут созданы резервные копии) или 'n' для отмены: ").lower()
            
            if response != 'y':
                log_message("ℹ️  Исправление отменено пользователем", LOG_FILE)
                print("Исправление отменено")
                return
        
        log_message(f"\n🔧 Исправление {len(incompatible_files)} файлов...", LOG_FILE)
        
        for file_info in incompatible_files:
            if fix_video(file_info['path'], backup=backup):
                fixed += 1
            else:
                failed += 1
        
        # Финальная статистика
        log_message("\n" + "=" * 80, LOG_FILE)
        log_message("🏁 РЕЗУЛЬТАТЫ ИСПРАВЛЕНИЯ", LOG_FILE)
        log_message("=" * 80, LOG_FILE)
        log_message(f"✅ Исправлено: {fixed}", LOG_FILE)
        log_message(f"❌ Ошибок: {failed}", LOG_FILE)
        
        print(f"\n{'=' * 60}")
        print(f"🏁 РЕЗУЛЬТАТЫ ИСПРАВЛЕНИЯ")
        print(f"{'=' * 60}")
        print(f"✅ Исправлено: {fixed}")
        print(f"❌ Ошибок: {failed}")
    else:
        log_message("\n🎉 Все файлы совместимы с браузером!", LOG_FILE)
        print(f"\n🎉 Все файлы совместимы с браузером!")
    
    log_message(f"\n📄 Подробный лог сохранён: {LOG_FILE}", LOG_FILE)
    print(f"\n📄 Подробный лог: {LOG_FILE}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Проверка и исправление видеофайлов фильмов')
    parser.add_argument('--auto-fix', action='store_true', help='Автоматически исправлять без подтверждения')
    parser.add_argument('--no-backup', action='store_true', help='Не создавать резервные копии (опасно!)')
    
    args = parser.parse_args()
    
    scan_and_fix_movies(
        auto_fix=args.auto_fix,
        backup=not args.no_backup
    )
