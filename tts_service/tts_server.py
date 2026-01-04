import os
import hashlib
import asyncio
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
import soundfile as sf
import tempfile
import logging
import torch

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Глобальные переменные для модели и кэша
ts_model = None
cache_dir = Path("cache")
cache_dir.mkdir(exist_ok=True)

class TTSRequest(BaseModel):
    text: str
    language: str = "ru"
    bookId: int
    page: int

def load_model():
    """Загрузка модели XTTS при старте сервера"""
    global tts_model
    logger.info("Загрузка модели XTTS...")
    
    # Установка переменной окружения для автоматического согласия с лицензией
    os.environ["COQUI_TOS_AGREED"] = "1"
    
    # Используем предобученную модель XTTS
    from TTS.api import TTS
    
    # Загрузка модели
    tts_model = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=False)
    
    logger.info("Модель XTTS загружена успешно")

def get_cache_path(book_id: int, page: int, language: str, text_hash: str) -> Path:
    """Генерация пути для кэширования аудиофайла"""
    return cache_dir / f"tts_{book_id}_{page}_{language}_{text_hash}.wav"

def calculate_text_hash(text: str) -> str:
    """Вычисление хэша текста для кэширования"""
    return hashlib.md5(text.encode()).hexdigest()

def get_speaker_wav_path():
    """Получение пути к файлу speaker.wav"""
    speaker_path = os.getenv("XTTS_SPEAKER_WAV", "speaker.wav")
    if not Path(speaker_path).exists():
        raise FileNotFoundError(f"Файл speaker.wav не найден по пути: {speaker_path}")
    return speaker_path

@app.on_event("startup")
async def startup_event():
    """Загрузка модели при старте приложения"""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, load_model)

@app.post("/tts_xtts")
async def generate_tts(request: TTSRequest):
    """Генерация аудио с использованием XTTS-v2"""
    try:
        text = request.text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Пустой текст для синтеза")
        
        # Проверяем, есть ли кэшированная версия
        text_hash = calculate_text_hash(text)
        cache_path = get_cache_path(request.bookId, request.page, request.language, text_hash)
        
        if cache_path.exists():
            logger.info(f"Возврат кэшированного аудио для книги {request.bookId}, страницы {request.page}")
            return FileResponse(
                path=cache_path,
                media_type="audio/wav",
                filename=f"ts_{request.bookId}_{request.page}.wav"
            )
        
        # Получаем путь к speaker.wav
        speaker_wav_path = get_speaker_wav_path()
        
        # Генерируем аудио с помощью XTTS
        logger.info(f"Генерация аудио для книги {request.bookId}, страницы {request.page}")
        
        # Создаем временный файл для вывода
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_path = temp_file.name
        
        # Синтезируем речь
        global tts_model
        tts_model.tts_to_file(
            text=text,
            speaker_wav=speaker_wav_path,
            language=request.language,
            file_path=temp_path
        )
        
        # Перемещаем временный файл в кэш
        Path(temp_path).rename(cache_path)
        
        logger.info(f"Аудио успешно сгенерировано и закэшировано: {cache_path}")
        
        return FileResponse(
            path=cache_path,
            media_type="audio/wav",
            filename=f"ts_{request.bookId}_{request.page}.wav"
        )
        
    except Exception as e:
        logger.error(f"Ошибка при генерации TTS: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при генерации аудио: {str(e)}")

@app.get("/")
async def root():
    return {"message": "TS Service для EPUB Reader", "status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8002)