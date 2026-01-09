# main.py - Entry point for the Media Portal
import os
import ipaddress
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from database import create_tables
from database_books import create_books_tables
from database_tvshows import create_tvshows_tables
from database_gallery import create_gallery_tables
from database_progress import create_progress_tables
from database_kaleidoscope import create_kaleidoscope_tables

from routers import movies, books, tvshows, gallery, admin, progress, kaleidoscopes

app = FastAPI(title="Медиа-портал: Фильмы и Книги")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware для проверки доступа (безопасность портала)
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    # 1. Определение реального IP адреса
    real_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "127.0.0.1")
    if "," in real_ip:
        real_ip = real_ip.split(",")[0].strip()
        
    # 2. Проверка: является ли подключение локальным (домашняя сеть)
    is_local = False
    if real_ip in ("127.0.0.1", "localhost", "::1"):
        is_local = True
    else:
        try:
            ip_obj = ipaddress.ip_address(real_ip)
            # is_private покрывает 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
            is_local = ip_obj.is_private or ip_obj.is_loopback
        except ValueError:
            pass
            
    # 3. Проверка: является ли подключение из нашего приложения
    user_agent = request.headers.get("user-agent", "").lower()
    # Рекомендуется использовать поиск в нижнем регистре для надежности
    is_app = "xwv2-app-identifier" in user_agent

    # 4. Правила блокировки
    # Правило: Если запрос НЕ из локальной сети И это НЕ приложение -> Блокируем.
    if not is_local and not is_app:
        # Разрешаем favicon, чтобы браузеры не спамили в консоль
        if request.url.path == "/favicon.ico":
            return await call_next(request)

        # Если это запрос к API, возвращаем JSON
        if request.url.path.startswith("/api"):
            return JSONResponse(
                status_code=403,
                content={"detail": "Access Denied. Only authorized app connections allowed outside local network."}
            )
        
        # Для остальных запросов возвращаем красивый HTML
        return HTMLResponse(
            status_code=403,
            content=f"""
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; margin-top: 100px; padding: 20px;">
                <h1 style="color: #e50914; font-size: 3em;">Вход заблокирован</h1>
                <p style="font-size: 1.2em; color: #333;">Этот сервер — частная территория.</p>
                <div style="background: #f8f8f8; border: 1px solid #ddd; padding: 20px; border-radius: 8px; max-width: 500px; margin: 30px auto; text-align: left;">
                    <p>Для доступа необходимо выполнить одно из условий:</p>
                    <ul style="line-height: 1.6;">
                        <li>Находиться в <b>локальной домашней сети</b>.</li>
                        <li>Использовать <b>официальное приложение xWV2</b>.</li>
                    </ul>
                </div>
                <p style="color: #999; font-size: 0.9em;">Ваш IP: {real_ip}</p>
            </div>
            """
        )
            
    response = await call_next(request)
    return response

# Пути
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_PATH = os.path.abspath(os.path.join(BASE_DIR, "../frontend"))
UPLOADS_PATH = os.path.abspath(os.path.join(BASE_DIR, "uploads"))

# Статические файлы
os.makedirs(UPLOADS_PATH, exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "books"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "movies"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "tvshows"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "tvshows"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "gallery"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "kaleidoscopes_music"), exist_ok=True)

app.mount("/static", StaticFiles(directory=FRONTEND_PATH), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOADS_PATH), name="uploads")

# Добавляем маршрут для favicon.ico
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    favicon_path = os.path.join(FRONTEND_PATH, "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/x-icon")
    else:
        raise HTTPException(status_code=404, detail="Favicon not found")

# Инициализация БД
create_tables()
create_books_tables()
create_tvshows_tables()
create_gallery_tables()
create_progress_tables()
create_kaleidoscope_tables()

# Основные маршруты для фронтенда
@app.get("/")
async def root():
    return FileResponse(os.path.join(FRONTEND_PATH, "index.html"))

@app.get("/gallery.html")
async def gallery_page():
    return FileResponse(os.path.join(FRONTEND_PATH, "gallery.html"))

@app.get("/reader.html")
async def reader_page():
    return FileResponse(os.path.join(FRONTEND_PATH, "reader.html"))

@app.get("/admin")
async def admin_page():
    return FileResponse(os.path.join(FRONTEND_PATH, "admin.html"))

# Подключение роутеров
app.include_router(movies.router, prefix="/api")
app.include_router(books.router, prefix="/api")
app.include_router(tvshows.router, prefix="/api")
app.include_router(gallery.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(progress.router, prefix="/api")
app.include_router(kaleidoscopes.router, prefix="/api")
