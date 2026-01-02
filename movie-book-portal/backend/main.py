# main.py - Reloaded after endpoint fix
import os
import sys
import shutil
import io
import fitz  # PyMuPDF
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from PIL import Image

from sqlalchemy.orm import Session
from pydantic import BaseModel

# Add backend directory to Python path to support absolute imports
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import get_db, create_tables, add_sample_data as add_sample_data_movies, Movie
from database_books import get_db_books, create_books_tables, Book  # ← обязательно импортируем модель Book
from database_tvshows import get_db_tvshows, create_tvshows_tables, Tvshow, Episode
from database_gallery import get_db_gallery, create_gallery_tables, Photo
import json
from fastapi.responses import JSONResponse

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
BOOKS_UPLOADS = os.path.join(UPLOADS_PATH, "books")
GALLERY_UPLOADS = os.path.join(UPLOADS_PATH, "gallery")

os.makedirs(UPLOADS_PATH, exist_ok=True)
os.makedirs(BOOKS_UPLOADS, exist_ok=True)
os.makedirs(GALLERY_UPLOADS, exist_ok=True)

# Статические файлы
app.mount("/static", StaticFiles(directory=FRONTEND_PATH), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOADS_PATH), name="uploads")

# Добавляем маршрут для favicon.ico
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    favicon_path = os.path.join(FRONTEND_PATH, "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/x-icon")
    else:
        # Возвращаем пустой ответ, если favicon не найден
        raise HTTPException(status_code=404, detail="Favicon not found")

# Создание таблиц и тестовых данных
create_tables()
create_books_tables()          # ← это создаст books со ВСЕМИ колонками из модели
create_tvshows_tables()        # ← создание таблиц для сериалов
create_gallery_tables()        # ← создание таблиц для галереи


@app.get("/")
async def root():
    return FileResponse(os.path.join(FRONTEND_PATH, "index.html"))

@app.get("/gallery.html")
async def gallery():
    return FileResponse(os.path.join(FRONTEND_PATH, "gallery.html"))


@app.get("/reader.html")
async def reader():
    return FileResponse(os.path.join(FRONTEND_PATH, "reader.html"))


# ==================== Pydantic модели ====================

class MovieCreate(BaseModel):
    title: str
    year: Optional[int] = None
    director: Optional[str] = None  # Разрешаем None
    genre: Optional[str] = None
    rating: Optional[float] = None
    description: Optional[str] = None

    model_config = {
        "extra": "ignore",              # Игнорируем лишние поля
        "populate_by_name": True,
    }

class TvshowCreate(BaseModel):
    title: str
    year: Optional[int] = None
    director: Optional[str] = None  # Разрешаем None
    genre: Optional[str] = None
    rating: Optional[float] = None
    description: Optional[str] = None
    episodes_count: Optional[int] = None
    season_count: Optional[int] = None

    model_config = {
        "extra": "ignore",              # Игнорируем лишние поля
        "populate_by_name": True,
    }

class EpisodeCreate(BaseModel):
    tvshow_id: int
    season_number: int
    episode_number: int
    title: Optional[str] = None
    description: Optional[str] = None

    model_config = {
        "extra": "ignore",              # Игнорируем лишние поля
        "populate_by_name": True,
    }

class BookCreate(BaseModel):
    title: str
    year: Optional[int] = None
    author: Optional[str] = None
    genre: Optional[str] = None
    rating: Optional[float] = None
    description: Optional[str] = None

    model_config = {
        "extra": "ignore",
        "populate_by_name": True,
    }

class PhotoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = "general"  # Категория фото

    model_config = {
        "extra": "ignore",
        "populate_by_name": True,
    }

# ==================== ФИЛЬМЫ ====================

@app.get("/movies")
def get_movies(genre: str = None, db: Session = Depends(get_db)):
    query = db.query(Movie)
    if genre and genre != "Все":
        query = query.filter(Movie.genre.ilike(f"%{genre}%"))
    return query.all()


@app.post("/movies")
def create_movie(movie: MovieCreate, db: Session = Depends(get_db)):
    db_movie = Movie(**movie.dict())
    db.add(db_movie)
    db.commit()
    db.refresh(db_movie)
    return db_movie


@app.get("/movies/{movie_id}")
def get_movie(movie_id: int, db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return movie


@app.put("/movies/{movie_id}")
def update_movie(movie_id: int, movie: MovieCreate, db: Session = Depends(get_db)):
    db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not db_movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    for key, value in movie.dict().items():
        setattr(db_movie, key, value)
    db.commit()
    db.refresh(db_movie)
    return db_movie


@app.delete("/movies/{movie_id}")
def delete_movie(movie_id: int, db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    # Удаляем файл видео, если он существует
    if movie.file_path:
        try:
            file_path = os.path.join(BASE_DIR, movie.file_path)
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Ошибка при удалении файла фильма: {e}")
    
    # Удаляем файл миниатюры, если он существует
    if movie.thumbnail_path:
        try:
            thumb_path = os.path.join(BASE_DIR, movie.thumbnail_path)
            if os.path.exists(thumb_path):
                os.remove(thumb_path)
        except Exception as e:
            print(f"Ошибка при удалении миниатюры фильма: {e}")
    
    db.delete(movie)
    db.commit()
    return {"message": "Movie deleted successfully"}


@app.post("/movies/{movie_id}/upload")
async def upload_movie_file(movie_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    allowed_ext = {".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm", ".m4v", ".3gp", ".3g2", ".ogv", ".qt"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"Неподдерживаемый формат видео.")

    file_path = os.path.abspath(f"uploads/movies/{movie_id}_{file.filename}")
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Сохраняем относительный путь для корректной отдачи через статический маршрут
    relative_path = os.path.relpath(file_path, BASE_DIR)
    # Приводим к стандартным слэшам для URL
    movie.file_path = relative_path.replace(os.sep, '/').replace('\\', '/')
    db.commit()
    return movie


@app.post("/movies/{movie_id}/upload_thumbnail")
async def upload_movie_thumbnail(movie_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    allowed_ext = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Неподдерживаемый формат изображения")

    thumb_path = os.path.abspath(f"uploads/movies/{movie_id}_thumb{ext}")
    os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
    with open(thumb_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Сохраняем относительный путь для корректной отдачи через статический маршрут
    relative_path = os.path.relpath(thumb_path, BASE_DIR)
    # Приводим к стандартным слэшам для URL
    movie.thumbnail_path = relative_path.replace(os.sep, '/').replace('\\', '/')
    db.commit()
    return movie


@app.get("/movies/search")
def search_movies(query: str, db: Session = Depends(get_db)):
    return db.query(Movie).filter(Movie.title.ilike(f"%{query}%")).all()


# ==================== КНИГИ ====================

def get_db_books_simple():
    db = next(get_db_books())
    try:
        yield db
    finally:
        db.close()


@app.get("/books")
def get_books(genre: str = None, db: Session = Depends(get_db_books_simple)):
    query = db.query(Book)
    if genre and genre != "Все":
        query = query.filter(Book.genre.ilike(f"%{genre}%"))
    return query.all()


@app.post("/books")
def create_book(book: BookCreate, db: Session = Depends(get_db_books_simple)):
    db_book = Book(**book.dict(), total_pages=1)
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    return db_book


@app.get("/books/{book_id}")
def get_book(book_id: int, db: Session = Depends(get_db_books_simple)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@app.put("/books/{book_id}")
def update_book(book_id: int, book: BookCreate, db: Session = Depends(get_db_books_simple)):
    db_book = db.query(Book).filter(Book.id == book_id).first()
    if not db_book:
        raise HTTPException(status_code=404, detail="Book not found")
    for key, value in book.dict().items():
        setattr(db_book, key, value)
    db.commit()
    db.refresh(db_book)
    return db_book


@app.delete("/books/{book_id}")
def delete_book(book_id: int, db: Session = Depends(get_db_books_simple)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Удаляем файл книги, если он существует
    if book.file_path:
        try:
            file_path = os.path.join(BASE_DIR, book.file_path)
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Ошибка при удалении файла книги: {e}")
    
    # Удаляем файл миниатюры, если он существует
    if book.thumbnail_path:
        try:
            thumb_path = os.path.join(BASE_DIR, book.thumbnail_path)
            if os.path.exists(thumb_path):
                os.remove(thumb_path)
        except Exception as e:
            print(f"Ошибка при удалении миниатюры книги: {e}")
    
    db.delete(book)
    db.commit()
    return {"message": "Book deleted successfully"}


@app.post("/books/{book_id}/upload")
async def upload_book_file(book_id: int, file: UploadFile = File(...), db: Session = Depends(get_db_books_simple)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    allowed_ext = {".pdf", ".djvu", ".djv", ".cbz", ".zip", ".epub"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Неподдерживаемый формат книги")

    file_path = os.path.abspath(f"uploads/books/{book_id}_{file.filename}")
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Сохраняем относительный путь для корректной отдачи через статический маршрут
    relative_path = os.path.relpath(file_path, BASE_DIR)
    # Приводим к стандартным слэшам для URL
    book.file_path = relative_path.replace(os.sep, '/').replace('\\', '/')
    book.total_pages = 1  # будет обновлено при первом открытии
    db.commit()
    return book


@app.post("/books/{book_id}/upload_thumbnail")
async def upload_book_thumbnail(book_id: int, file: UploadFile = File(...), db: Session = Depends(get_db_books_simple)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    allowed_ext = {".jpg", ".jpeg", ".png", ".webp"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Неподдерживаемый формат изображения")

    thumb_path = os.path.abspath(f"uploads/books/{book_id}_thumb{ext}")
    os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
    with open(thumb_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Сохраняем относительный путь для корректной отдачи через статический маршрут
    relative_path = os.path.relpath(thumb_path, BASE_DIR)
    # Приводим к стандартным слэшам для URL
    book.thumbnail_path = relative_path.replace(os.sep, '/').replace('\\', '/')
    db.commit()
    return book


@app.get("/books/{book_id}/info")
def get_book_info(book_id: int, db: Session = Depends(get_db_books_simple)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"total_pages": book.total_pages}


@app.get("/books/{book_id}/page/{page_num}")
async def get_book_page(book_id: int, page_num: int, db: Session = Depends(get_db_books_simple)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book or not book.file_path or not os.path.exists(book.file_path):
        raise HTTPException(status_code=404, detail="Book or file not found")

    full_path = book.file_path
    ext = Path(full_path).suffix.lower()

    try:
        if ext == ".epub":
            with zipfile.ZipFile(full_path, 'r') as epub:
                # === Правильный способ найти OPF: через container.xml ===
                if 'META-INF/container.xml' not in epub.namelist():
                    raise HTTPException(status_code=400, detail="Invalid EPUB: no container.xml")

                container_content = epub.read('META-INF/container.xml').decode('utf-8')
                root = ET.fromstring(container_content)
                ns = {'c': 'urn:oasis:names:tc:opendocument:xmlns:container'}
                rootfile = root.find('.//c:rootfile', ns)
                if rootfile is None:
                    raise HTTPException(status_code=400, detail="Invalid container.xml")
                opf_path = rootfile.get('full-path')
                if not opf_path or opf_path not in epub.namelist():
                    raise HTTPException(status_code=400, detail="OPF file specified in container not found")

                opf_dir = os.path.dirname(opf_path) or ''
                opf_content = epub.read(opf_path).decode('utf-8')

                # Парсинг OPF
                opf_root = ET.fromstring(opf_content)
                # Поддержка как версии 2, так и 3
                ns_opf = {'opf': 'http://www.idpf.org/2007/opf'}

                manifest = {}
                for item in opf_root.findall('.//opf:manifest/opf:item', ns_opf):
                    item_id = item.get('id')
                    href = item.get('href')
                    if item_id and href:
                        manifest[item_id] = href

                spine = []
                for itemref in opf_root.findall('.//opf:spine/opf:itemref', ns_opf):
                    item_id = itemref.get('idref')
                    if item_id and item_id in manifest:
                        spine.append(manifest[item_id])

                if not spine:
                    raise HTTPException(status_code=400, detail="EPUB has no readable chapters in spine")

                total_pages = len(spine)
                if book.total_pages != total_pages:
                    book.total_pages = total_pages
                    db.commit()

                if page_num < 1 or page_num > total_pages:
                    raise HTTPException(status_code=404, detail="Page number out of range")

                content_file = spine[page_num - 1]

                # Формируем полный путь внутри EPUB
                if opf_dir:
                    content_path = os.path.normpath(os.path.join(opf_dir, content_file)).replace('\\', '/')
                else:
                    content_path = content_file.replace('\\', '/')

                # Попытки чтения
                try:
                    content_bytes = epub.read(content_path)
                except KeyError:
                    try:
                        content_bytes = epub.read(content_file)  # без папки
                    except KeyError:
                        # Последний fallback: поиск по имени файла
                        basename = os.path.basename(content_path)
                        matches = [n for n in epub.namelist() if n.endswith(basename)]
                        if not matches:
                            raise HTTPException(status_code=500, detail=f"Chapter file '{content_file}' not found in EPUB")
                        content_bytes = epub.read(matches[0])

                content = content_bytes.decode('utf-8')
                return {"content": content, "total": total_pages}
        else:
            # PDF, DjVu, CBZ и др. — рендерим как изображение
            doc = fitz.open(full_path)
            if page_num < 1 or page_num > doc.page_count:
                doc.close()
                raise HTTPException(status_code=404, detail="Page number out of range")

            page = doc.load_page(page_num - 1)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), colorspace=fitz.csRGB)
            img_bytes = pix.tobytes("png")
            doc.close()

            return StreamingResponse(io.BytesIO(img_bytes), media_type="image/png")

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()  # Это выведет полный traceback в логи сервера
        raise HTTPException(status_code=500, detail=f"Ошибка обработки EPUB: {str(e)}")


@app.get("/books/{book_id}/file_resource/{file_path:path}")
def get_book_file_resource(book_id: int, file_path: str, db: Session = Depends(get_db_books_simple)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book or not book.file_path or not book.file_path.endswith(".epub"):
        raise HTTPException(status_code=400, detail="Only EPUB files support resource access")

    try:
        with zipfile.ZipFile(book.file_path, "r") as epub:
            normalized = file_path.replace("\\", "/")
            try:
                data = epub.read(normalized)
            except KeyError:
                # Поиск по имени файла (без пути)
                basename = os.path.basename(normalized).lower()
                matches = [name for name in epub.namelist() if name.lower().endswith(basename)]
                if not matches:
                    raise HTTPException(status_code=404, detail="Resource not found")
                data = epub.read(matches[0])
                normalized = matches[0]

            # Определяем MIME-тип
            lower = normalized.lower()
            if lower.endswith((".jpg", ".jpeg")):
                ctype = "image/jpeg"
            elif lower.endswith(".png"):
                ctype = "image/png"
            elif lower.endswith(".gif"):
                ctype = "image/gif"
            elif lower.endswith(".svg"):
                ctype = "image/svg+xml"
            elif lower.endswith(".css"):
                ctype = "text/css"
            elif lower.endswith(".js"):
                ctype = "application/javascript"
            else:
                ctype = "application/octet-stream"

            return StreamingResponse(io.BytesIO(data), media_type=ctype)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accessing resource: {str(e)}")


def get_db_tvshows_simple():
    db = next(get_db_tvshows())
    try:
        yield db
    finally:
        db.close()


@app.get("/tvshows")
def get_tvshows(genre: str = None, db: Session = Depends(get_db_tvshows_simple)):
    query = db.query(Tvshow)
    if genre and genre != "Все":
        query = query.filter(Tvshow.genre.ilike(f"%{genre}%"))
    return query.all()


@app.post("/tvshows")
def create_tvshow(tvshow: TvshowCreate, db: Session = Depends(get_db_tvshows_simple)):
    db_tvshow = Tvshow(**tvshow.dict())
    db.add(db_tvshow)
    db.commit()
    db.refresh(db_tvshow)
    return db_tvshow


@app.get("/tvshows/{tvshow_id}")
def get_tvshow(tvshow_id: int, db: Session = Depends(get_db_tvshows_simple)):
    tvshow = db.query(Tvshow).filter(Tvshow.id == tvshow_id).first()
    if not tvshow:
        raise HTTPException(status_code=404, detail="Tvshow not found")
    return tvshow


@app.put("/tvshows/{tvshow_id}")
def update_tvshow(tvshow_id: int, tvshow: TvshowCreate, db: Session = Depends(get_db_tvshows_simple)):
    db_tvshow = db.query(Tvshow).filter(Tvshow.id == tvshow_id).first()
    if not db_tvshow:
        raise HTTPException(status_code=404, detail="Tvshow not found")
    for key, value in tvshow.dict().items():
        setattr(db_tvshow, key, value)
    db.commit()
    db.refresh(db_tvshow)
    return db_tvshow


@app.delete("/tvshows/{tvshow_id}")
def delete_tvshow(tvshow_id: int, db: Session = Depends(get_db_tvshows_simple)):
    tvshow = db.query(Tvshow).filter(Tvshow.id == tvshow_id).first()
    if not tvshow:
        raise HTTPException(status_code=404, detail="Tvshow not found")
    
    # Удаляем файл видео, если он существует
    if tvshow.file_path:
        try:
            file_path = os.path.join(BASE_DIR, tvshow.file_path)
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Ошибка при удалении файла сериала: {e}")
    
    # Удаляем файл миниатюры, если он существует
    if tvshow.thumbnail_path:
        try:
            thumb_path = os.path.join(BASE_DIR, tvshow.thumbnail_path)
            if os.path.exists(thumb_path):
                os.remove(thumb_path)
        except Exception as e:
            print(f"Ошибка при удалении миниатюры сериала: {e}")
    
    db.delete(tvshow)
    db.commit()
    return {"message": "Tvshow deleted successfully"}


@app.post("/tvshows/{tvshow_id}/upload")
async def upload_tvshow_file(tvshow_id: int, file: UploadFile = File(...), db: Session = Depends(get_db_tvshows_simple)):
    tvshow = db.query(Tvshow).filter(Tvshow.id == tvshow_id).first()
    if not tvshow:
        raise HTTPException(status_code=404, detail="Tvshow not found")

    allowed_ext = {".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm", ".m4v", ".3gp", ".3g2", ".ogv", ".qt"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"Неподдерживаемый формат видео.")

    file_path = os.path.abspath(f"uploads/tvshows/{tvshow_id}_{file.filename}")
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Сохраняем относительный путь для корректной отдачи через статический маршрут
    relative_path = os.path.relpath(file_path, BASE_DIR)
    # Приводим к стандартным слэшам для URL
    tvshow.file_path = relative_path.replace(os.sep, '/').replace('\\', '/')
    db.commit()
    return tvshow


@app.post("/tvshows/{tvshow_id}/upload_thumbnail")
async def upload_tvshow_thumbnail(tvshow_id: int, file: UploadFile = File(...), db: Session = Depends(get_db_tvshows_simple)):
    tvshow = db.query(Tvshow).filter(Tvshow.id == tvshow_id).first()
    if not tvshow:
        raise HTTPException(status_code=404, detail="Tvshow not found")

    allowed_ext = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Неподдерживаемый формат изображения")

    thumb_path = os.path.abspath(f"uploads/tvshows/{tvshow_id}_thumb{ext}")
    os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
    with open(thumb_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Сохраняем относительный путь для корректной отдачи через статический маршрут
    relative_path = os.path.relpath(thumb_path, BASE_DIR)
    # Приводим к стандартным слэшам для URL
    tvshow.thumbnail_path = relative_path.replace(os.sep, '/').replace('\\', '/')
    db.commit()
    return tvshow


@app.get("/tvshows/search")
def search_tvshows(query: str, db: Session = Depends(get_db_tvshows_simple)):
    return db.query(Tvshow).filter(Tvshow.title.ilike(f"%{query}%")).all()


# ==================== ЭПИЗОДЫ ====================

@app.get("/episodes")
def get_episodes(tvshow_id: Optional[int] = None, season: Optional[int] = None, db: Session = Depends(get_db_tvshows_simple)):
    try:
        query = db.query(Episode)
        if tvshow_id:
            query = query.filter(Episode.tvshow_id == tvshow_id)
        if season:
            query = query.filter(Episode.season_number == season)
        return query.all()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка при получении эпизодов: {str(e)}")


@app.get("/episodes/{episode_id}")
def get_episode(episode_id: int, db: Session = Depends(get_db_tvshows_simple)):
    try:
        episode = db.query(Episode).filter(Episode.id == episode_id).first()
        if not episode:
            raise HTTPException(status_code=404, detail="Episode not found")
        return episode
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка при получении эпизода: {str(e)}")


@app.post("/episodes")
def create_episode(episode: EpisodeCreate, db: Session = Depends(get_db_tvshows_simple)):
    try:
        # Проверяем, существует ли сериал
        tvshow = db.query(Tvshow).filter(Tvshow.id == episode.tvshow_id).first()
        if not tvshow:
            raise HTTPException(status_code=404, detail="Tvshow not found")
        
        # Создаем новый эпизод
        db_episode = Episode(**episode.dict())
        db.add(db_episode)
        db.commit()
        db.refresh(db_episode)
        return db_episode
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка при создании эпизода: {str(e)}")


@app.put("/episodes/{episode_id}")
def update_episode(episode_id: int, episode: EpisodeCreate, db: Session = Depends(get_db_tvshows_simple)):
    try:
        db_episode = db.query(Episode).filter(Episode.id == episode_id).first()
        if not db_episode:
            raise HTTPException(status_code=404, detail="Episode not found")
        for key, value in episode.dict().items():
            setattr(db_episode, key, value)
        db.commit()
        db.refresh(db_episode)
        return db_episode
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка при обновлении эпизода: {str(e)}")


@app.delete("/episodes/{episode_id}")
def delete_episode(episode_id: int, db: Session = Depends(get_db_tvshows_simple)):
    try:
        episode = db.query(Episode).filter(Episode.id == episode_id).first()
        if not episode:
            raise HTTPException(status_code=404, detail="Episode not found")
        
        # Удаляем файл видео эпизода, если он существует
        if episode.file_path:
            try:
                file_path = os.path.join(BASE_DIR, episode.file_path)
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                print(f"Ошибка при удалении файла эпизода: {e}")
        
        db.delete(episode)
        db.commit()
        return {"message": "Episode deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении эпизода: {str(e)}")


@app.post("/episodes/{episode_id}/upload")
async def upload_episode_file(episode_id: int, file: UploadFile = File(...), db: Session = Depends(get_db_tvshows_simple)):
    try:
        episode = db.query(Episode).filter(Episode.id == episode_id).first()
        if not episode:
            raise HTTPException(status_code=404, detail="Episode not found")

        allowed_ext = {".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm", ".m4v", ".3gp", ".3g2", ".ogv", ".qt"}
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_ext:
            raise HTTPException(status_code=400, detail=f"Неподдерживаемый формат видео.")

        file_path = os.path.abspath(f"uploads/tvshows/{episode.tvshow_id}/S{episode.season_number:02d}E{episode.episode_number:02d}_{file.filename}")
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Сохраняем относительный путь для корректной отдачи через статический маршрут
        relative_path = os.path.relpath(file_path, BASE_DIR)
        # Приводим к стандартным слэшам для URL
        episode.file_path = relative_path.replace(os.sep, '/').replace('\\', '/')
        db.commit()
        return episode
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке файла эпизода: {str(e)}")


# ==================== ГАЛЕРЕЯ ====================

# Добавляем новый маршрут для получения содержимого папки галереи
@app.get("/gallery")
def get_gallery_contents(folder: str = ""):
    try:
        # Проверяем, что путь не выходит за пределы папки gallery
        base_path = os.path.abspath(GALLERY_UPLOADS)
        requested_path = os.path.abspath(os.path.join(GALLERY_UPLOADS, folder))
        
        # Проверяем, что запрашиваемый путь находится внутри базовой папки
        if not requested_path.startswith(base_path):
            raise HTTPException(status_code=400, detail="Недопустимый путь")
        
        if not os.path.exists(requested_path):
            raise HTTPException(status_code=404, detail="Папка не найдена")
        
        contents = []
        for item in os.listdir(requested_path):
            item_path = os.path.join(requested_path, item)
            is_directory = os.path.isdir(item_path)
            
            # Если это папка, добавляем информацию о ней
            if is_directory:
                contents.append({
                    "id": None,
                    "name": item,
                    "type": "folder",
                    "path": os.path.join(folder, item).replace('\\', '/'),
                    "size": None,
                    "modified": os.path.getmtime(item_path),
                    "thumbnail_path": "/static/assets/images/folder-icon_thumb.png"  # Заглушка для папки
                })
            # Если это файл изображения, добавляем информацию о нем
            elif os.path.isfile(item_path):
                # Пропускаем файлы миниатюр, чтобы они не дублировались в галерее
                if '_thumb.' in item:
                    continue

                _, ext = os.path.splitext(item)
                if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                    # Генерируем ID на основе пути к файлу для совместимости
                    import hashlib
                    file_id = int(hashlib.md5(item_path.encode()).hexdigest(), 16) % 10**8
                    
                    # Проверяем наличие миниатюры
                    thumb_path = os.path.join(requested_path, f"{os.path.splitext(item)[0]}_thumb.webp")
                    if not os.path.exists(thumb_path):
                        thumb_path = item_path  # Используем оригинал, если миниатюры нет
                    
                    thumb_filename = os.path.basename(thumb_path)
                    
                    contents.append({
                        "id": file_id,
                        "name": item,
                        "type": "photo",
                        "path": os.path.join(folder, item).replace('\\', '/'),
                        "size": os.path.getsize(item_path),
                        "modified": os.path.getmtime(item_path),
                        "thumbnail_path": f"/uploads/gallery/{os.path.join(folder, thumb_filename).replace('\\', '/')}",
                        "file_path": f"/uploads/gallery/{os.path.join(folder, item).replace('\\', '/')}"
                    })
        
        return contents
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении содержимого галереи: {str(e)}")


@app.get("/gallery/{photo_id}")
def get_photo(photo_id: int):
    # Находим фото по ID (который теперь генерируется на основе пути)
    try:
        # Ищем файл по ID в папке галереи
        for root, dirs, files in os.walk(GALLERY_UPLOADS):
            for file in files:
                file_path = os.path.join(root, file)
                import hashlib
                file_id = int(hashlib.md5(file_path.encode()).hexdigest(), 16) % 10**8
                
                if file_id == photo_id:
                    _, ext = os.path.splitext(file)
                    if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                        relative_path = os.path.relpath(file_path, BASE_DIR).replace('\\', '/')
                        
                        # Проверяем наличие миниатюры
                        thumb_path = os.path.join(os.path.dirname(file_path), f"{os.path.splitext(file)[0]}_thumb.webp")
                        if not os.path.exists(thumb_path):
                            thumb_path = file_path  # Используем оригинал, если миниатюры нет
                        
                        relative_thumb_path = os.path.relpath(thumb_path, BASE_DIR).replace('\\', '/')
                        
                        return {
                            "id": file_id,
                            "title": os.path.splitext(file)[0],
                            "description": "",
                            "file_path": f"/{relative_path}",
                            "thumbnail_path": f"/{relative_thumb_path}",
                            "upload_date": os.path.getmtime(file_path)
                        }
        
        raise HTTPException(status_code=404, detail="Photo not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении фото: {str(e)}")


@app.post("/gallery")
def create_photo(photo_data: dict):
    # Создание папки в галерее
    try:
        folder_name = photo_data.get("title", "")
        if not folder_name:
            raise HTTPException(status_code=400, detail="Название папки не указано")
        
        # Очищаем имя папки от недопустимых символов
        import re
        folder_name = re.sub(r'[<>:"/\\|?*]', '_', folder_name)
        folder_path = os.path.join(GALLERY_UPLOADS, folder_name)
        
        if os.path.exists(folder_path):
            raise HTTPException(status_code=400, detail="Папка с таким именем уже существует")
        
        os.makedirs(folder_path, exist_ok=True)
        return {"message": "Папка создана успешно", "path": folder_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при создании папки: {str(e)}")


@app.delete("/gallery/manage/folder_delete")
def delete_folder(path: str):
    # Рекурсивно удаляем папку в галерее
    try:
        # Проверяем, что путь не выходит за пределы папки gallery
        base_path = os.path.abspath(GALLERY_UPLOADS)
        requested_path = os.path.abspath(os.path.join(GALLERY_UPLOADS, path))
        
        # Проверяем, что запрашиваемый путь находится внутри базовой папки
        if not requested_path.startswith(base_path) or requested_path == base_path:
            raise HTTPException(status_code=400, detail="Недопустимый путь или попытка удалить корень")
        
        if not os.path.exists(requested_path):
            raise HTTPException(status_code=404, detail="Папка не найдена")
        
        if not os.path.isdir(requested_path):
            raise HTTPException(status_code=400, detail="Указанный путь не является папкой")
        
        # Рекурсивно удаляем папку
        shutil.rmtree(requested_path)
        
        return {"message": "Папка и её содержимое удалены успешно"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении папки: {str(e)}")


@app.delete("/gallery/{photo_id}")
def delete_photo(photo_id: int):
    # Удаляем файл изображения по ID
    try:
        # Ищем файл по ID в папке галереи
        for root, dirs, files in os.walk(GALLERY_UPLOADS):
            for file in files:
                file_path = os.path.join(root, file)
                import hashlib
                file_id = int(hashlib.md5(file_path.encode()).hexdigest(), 16) % 10**8
                
                if file_id == photo_id:
                    os.remove(file_path)
                    
                    # Удаляем связанную миниатюру, если она существует
                    thumb_path = os.path.join(os.path.dirname(file_path), f"{os.path.splitext(file)[0]}_thumb.webp")
                    if os.path.exists(thumb_path):
                        os.remove(thumb_path)
                    
                    return {"message": "Фото удалено успешно"}
        
        raise HTTPException(status_code=404, detail="Photo not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении фото: {str(e)}")


@app.post("/gallery/{photo_id}/upload")
async def upload_photo_file(photo_id: int, file: UploadFile = File(...)):
    raise HTTPException(status_code=400, detail="Загрузка файлов по ID больше не поддерживается. Используйте /gallery/upload_to_folder")


@app.post("/gallery/upload_to_folder")
async def upload_photo_to_folder(folder: str = Form(""), file: UploadFile = File(...)):
    try:
        # Проверяем, что путь не выходит за пределы папки gallery
        base_path = os.path.abspath(GALLERY_UPLOADS)
        if folder:
            requested_path = os.path.abspath(os.path.join(GALLERY_UPLOADS, folder))
        else:
            requested_path = base_path
        
        # Проверяем, что запрашиваемый путь находится внутри базовой папки
        if not requested_path.startswith(base_path):
            raise HTTPException(status_code=400, detail="Недопустимый путь")
        
        # Создаем папку, если она не существует
        os.makedirs(requested_path, exist_ok=True)
        
        allowed_ext = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_ext:
            raise HTTPException(status_code=400, detail="Неподдерживаемый формат изображения")
        
        file_path = os.path.join(requested_path, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Создаем миниатюру
        try:
            with Image.open(file_path) as img:
                # Определяем размеры миниатюры (например, 300x300)
                img.thumbnail((300, 300), Image.Resampling.LANCZOS)
                # Сохраняем миниатюру
                thumb_path = os.path.join(requested_path, f"{os.path.splitext(file.filename)[0]}_thumb.webp")
                img.save(thumb_path, "WEBP", quality=85)
        except Exception as e:
            print(f"Ошибка при создании миниатюры: {e}")
            # Если не удалось создать миниатюру, продолжаем без нее
            thumb_path = file_path  # Используем оригинал, если миниатюра не создалась
        
        return {"message": "Файл загружен успешно", "file_path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке файла: {str(e)}")


@app.post("/gallery/move_photo")
async def move_photo(photo_path: str = Form(...), target_folder: str = Form(...)):
    try:
        # Проверяем, что пути не выходят за пределы папки gallery
        base_path = os.path.abspath(GALLERY_UPLOADS)
        source_path = os.path.abspath(os.path.join(GALLERY_UPLOADS, photo_path))
        target_path = os.path.abspath(os.path.join(GALLERY_UPLOADS, target_folder))
        
        # Проверяем, что пути находятся внутри базовой папки
        if not source_path.startswith(base_path) or not target_path.startswith(base_path):
            raise HTTPException(status_code=400, detail="Недопустимый путь")
        
        # Проверяем, что исходный файл существует
        if not os.path.exists(source_path):
            raise HTTPException(status_code=404, detail="Файл не найден")
        
        # Проверяем, что целевая папка существует
        if not os.path.isdir(target_path):
            raise HTTPException(status_code=404, detail="Целевая папка не найдена")
        
        # Перемещаем файл
        filename = os.path.basename(source_path)
        destination_path = os.path.join(target_path, filename)
        shutil.move(source_path, destination_path)
        
        # Перемещаем связанную миниатюру, если она существует
        source_thumb_path = os.path.join(os.path.dirname(source_path), f"{os.path.splitext(filename)[0]}_thumb.webp")
        dest_thumb_path = os.path.join(target_path, f"{os.path.splitext(filename)[0]}_thumb.webp")
        if os.path.exists(source_thumb_path):
            shutil.move(source_thumb_path, dest_thumb_path)
        
        return {"message": "Фото перемещено успешно", "new_path": destination_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при перемещении фото: {str(e)}")


@app.post("/gallery/{photo_id}/apply_filter")
async def apply_filter_to_photo(photo_id: int, filter_type: str = None):
    try:
        # Находим фото по ID
        source_file_path = None
        for root, dirs, files in os.walk(GALLERY_UPLOADS):
            for file in files:
                file_path = os.path.join(root, file)
                import hashlib
                file_id = int(hashlib.md5(file_path.encode()).hexdigest(), 16) % 10**8
                
                if file_id == photo_id and os.path.isfile(file_path):
                    _, ext = os.path.splitext(file)
                    if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                        source_file_path = file_path
                        break
            if source_file_path:
                break
        
        if not source_file_path:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        try:
            with Image.open(source_file_path) as img:
                # Apply the filter based on filter_type
                filtered_img = apply_image_filter(img, filter_type)
                
                # Save the filtered image back to the same file path
                filtered_img.save(source_file_path, quality=95, optimize=True)
                
                # Create a new thumbnail from the filtered original image
                # This ensures the thumbnail and original both have the same filter
                thumb_path = os.path.join(os.path.dirname(source_file_path), f"{os.path.splitext(os.path.basename(source_file_path))[0]}_thumb.webp")
                filtered_thumb = filtered_img.copy()
                filtered_thumb.thumbnail((300, 300), Image.Resampling.LANCZOS)
                filtered_thumb.save(thumb_path, "WEBP", quality=85)
        except Exception as e:
            print(f"Error applying filter: {e}")
            raise HTTPException(status_code=500, detail=f"Ошибка при применении фильтра: {str(e)}")
        
        return {"message": "Filter applied successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при применении фильтра: {str(e)}")


def apply_image_filter(img, filter_type):
    """Apply a filter to the image based on the filter type"""
    import numpy as np
    
    # Convert to RGB if necessary
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    if filter_type == 'brightness':
        # Increase brightness
        np_img = np.array(img)
        np_img = np.clip(np_img * 1.3, 0, 255).astype(np.uint8)
        return Image.fromarray(np_img)
    
    elif filter_type == 'contrast':
        # Increase contrast
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(img)
        return enhancer.enhance(1.3)
    
    elif filter_type == 'saturation':
        # Increase saturation
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Color(img)
        return enhancer.enhance(1.5)
    
    elif filter_type == 'bw':
        # Convert to grayscale
        return img.convert('L').convert('RGB')
    
    elif filter_type == 'vintage':
        # Apply vintage effect
        np_img = np.array(img)
        # Add sepia tone
        sepia_filter = np.array([[0.393, 0.769, 0.189],
                                [0.349, 0.686, 0.168],
                                [0.272, 0.534, 0.131]])
        sepia_img = np.dot(np_img, sepia_filter.T)
        sepia_img = np.clip(sepia_img, 0, 255).astype(np.uint8)
        
        # Increase contrast and reduce saturation for vintage look
        from PIL import ImageEnhance
        img = Image.fromarray(sepia_img)
        img = ImageEnhance.Contrast(img).enhance(1.2)
        img = ImageEnhance.Color(img).enhance(0.8)
        return img
    
    elif filter_type == 'none':
        # Return original image
        return img
    
    else:
        # Return original image if no filter type specified
        return img


@app.get("/gallery/search")
def search_photos(query: str):
    # Поиск по именам файлов в галерее
    try:
        results = []
        for root, dirs, files in os.walk(GALLERY_UPLOADS):
            for file in files:
                _, ext = os.path.splitext(file)
                if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                    if query.lower() in file.lower():
                        file_path = os.path.join(root, file)
                        import hashlib
                        file_id = int(hashlib.md5(file_path.encode()).hexdigest(), 16) % 10**8
                        
                        relative_path = os.path.relpath(file_path, BASE_DIR).replace('\\', '/')
                        
                        # Проверяем наличие миниатюры
                        thumb_path = os.path.join(root, f"{os.path.splitext(file)[0]}_thumb.webp")
                        if not os.path.exists(thumb_path):
                            thumb_path = file_path  # Используем оригинал, если миниатюры нет
                        
                        relative_thumb_path = os.path.relpath(thumb_path, BASE_DIR).replace('\\', '/')
                        
                        results.append({
                            "id": file_id,
                            "name": file,
                            "type": "photo",
                            "path": relative_path,
                            "size": os.path.getsize(file_path),
                            "modified": os.path.getmtime(file_path),
                            "thumbnail_path": f"/{relative_thumb_path}",
                            "file_path": f"/{relative_path}"
                        })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при поиске фото: {str(e)}")


@app.get("/books/search")
def search_books(query: str, db: Session = Depends(get_db_books_simple)):
    return db.query(Book).filter(Book.title.ilike(f"%{query}%")).all()