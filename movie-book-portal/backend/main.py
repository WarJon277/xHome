# main.py - Entry point for the Media Portal
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import create_tables
from database_books import create_books_tables
from database_tvshows import create_tvshows_tables
from database_gallery import create_gallery_tables

from routers import movies, books, tvshows, gallery, admin

app = FastAPI(title="Медиа-портал: Фильмы и Книги")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Пути
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_PATH = os.path.abspath(os.path.join(BASE_DIR, "../frontend"))
UPLOADS_PATH = os.path.abspath(os.path.join(BASE_DIR, "uploads"))

# Статические файлы
os.makedirs(UPLOADS_PATH, exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "books"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "movies"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "tvshows"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "gallery"), exist_ok=True)

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
app.include_router(movies.router)
app.include_router(books.router)
app.include_router(tvshows.router)
app.include_router(gallery.router)
app.include_router(admin.router)