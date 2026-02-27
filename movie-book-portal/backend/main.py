# main.py - Entry point for the Media Portal
import os
import ipaddress
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from database import create_tables
from database_books import create_books_tables
from database_audiobooks import create_audiobooks_tables
from database_tvshows import create_tvshows_tables
from database_gallery import create_gallery_tables
from database_progress import create_progress_tables
from database_kaleidoscope import create_kaleidoscope_tables
from database_videogallery import create_videogallery_tables

from routers import movies, books, audiobooks, admin, gallery, videogallery, tvshows, kaleidoscopes, progress, dashboard, flibusta, audiobooks_source, discovery, system
from routers import requests_router

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
    # Логируем для отладки, если запрос идет не из локальной сети
    if not is_local:
        print(f"External access attempt: IP={real_ip}, App={is_app}, UA={user_agent}")

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
                <script>
                    if (window.AndroidApp && window.AndroidApp.hideLoadingScreen) {{
                        window.AndroidApp.hideLoadingScreen();
                    }}
                </script>
            </div>
            """
        )
            
    response = await call_next(request)
    return response

# Пути
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Use React frontend build directory
FRONTEND_PATH = os.path.abspath(os.path.join(BASE_DIR, "../frontend-react/dist"))
UPLOADS_PATH = os.path.abspath(os.path.join(BASE_DIR, "uploads"))

# Статические файлы
os.makedirs(UPLOADS_PATH, exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "books"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "movies"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "tvshows"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "tvshows"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "gallery"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "videogallery"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "kaleidoscopes_music"), exist_ok=True)

# Mount static files only if dist directory exists (production mode)
if os.path.exists(FRONTEND_PATH):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_PATH, "assets")), name="assets")
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
create_audiobooks_tables()
create_tvshows_tables()
create_gallery_tables()
create_videogallery_tables()
create_progress_tables()
create_kaleidoscope_tables()

# Подключение роутеров
app.include_router(movies.router, prefix="/api")
app.include_router(books.router, prefix="/api")
app.include_router(audiobooks.router, prefix="/api")
app.include_router(tvshows.router, prefix="/api")
app.include_router(gallery.router, prefix="/api")
app.include_router(videogallery.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(progress.router, prefix="/api")
app.include_router(kaleidoscopes.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(flibusta.router, prefix="/api")
app.include_router(audiobooks_source.router, prefix="/api")
# Register discovery with explicit sub-prefix
app.include_router(discovery.router, prefix="/api/discovery")
app.include_router(system.router, prefix="/api")
app.include_router(requests_router.router, prefix="/api")

# IMPORTANT: React SPA routing - MUST be registered LAST (catch-all route)
# This serves index.html for all non-API routes to support React Router
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    # Serve index.html for React Router (SPA)
    index_path = os.path.join(FRONTEND_PATH, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        # Development mode - frontend not built yet
        return HTMLResponse(
            content="""
            <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>⚠️ Frontend Not Built</h1>
                    <p>Please build the frontend first:</p>
                    <pre style="background: #f5f5f5; padding: 20px; border-radius: 8px; display: inline-block; text-align: left;">
cd frontend-react
npm run build
                    </pre>
                    <p>Or run in development mode:</p>
                    <pre style="background: #f5f5f5; padding: 20px; border-radius: 8px; display: inline-block; text-align: left;">
cd frontend-react
npm run dev
                    </pre>
                    <p>Then access at <a href="http://localhost:5050">http://localhost:5050</a></p>
                </body>
            </html>
            """,
            status_code=503
        )

