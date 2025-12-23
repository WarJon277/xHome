# main.py
import os
import shutil
import io
import fitz  # PyMuPDF
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse

from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db, create_tables, add_sample_data as add_sample_data_movies, Movie
from database_books import (
    get_db_books,
    create_books_tables,
    add_sample_books_data,
    Book,
)

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

os.makedirs(UPLOADS_PATH, exist_ok=True)
os.makedirs(BOOKS_UPLOADS, exist_ok=True)

# Статические файлы
app.mount("/static", StaticFiles(directory=FRONTEND_PATH), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOADS_PATH), name="uploads")

# Создание таблиц и тестовых данных
create_tables()
create_books_tables()
add_sample_data_movies()
add_sample_books_data()


@app.get("/")
async def root():
    return FileResponse(os.path.join(FRONTEND_PATH, "index.html"))


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

# ==================== ФИЛЬМЫ ====================

@app.get("/movies")
def get_movies(db: Session = Depends(get_db)):
    return db.query(Movie).all()


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

    file_path = f"uploads/movies/{movie_id}_{file.filename}"
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    movie.file_path = file_path
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

    thumb_path = f"uploads/movies/{movie_id}_thumb{ext}"
    os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
    with open(thumb_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    movie.thumbnail_path = thumb_path
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
def get_books(db: Session = Depends(get_db_books_simple)):
    return db.query(Book).all()


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

    file_path = f"uploads/books/{book_id}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    book.file_path = file_path
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

    thumb_path = f"uploads/books/{book_id}_thumb{ext}"
    with open(thumb_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    book.thumbnail_path = thumb_path
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


@app.get("/books/search")
def search_books(query: str, db: Session = Depends(get_db_books_simple)):
    return db.query(Book).filter(Book.title.ilike(f"%{query}%")).all()