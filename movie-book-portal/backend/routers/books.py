import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database_books import Book
from models import BookCreate
from dependencies import get_db_books_simple
from dependencies import get_db_books_simple
from utils import get_book_page_content, get_epub_page_count

router = APIRouter(prefix="/books", tags=["books"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@router.get("")
def get_books(genre: str = None, db: Session = Depends(get_db_books_simple)):
    query = db.query(Book)
    if genre and genre != "Все":
        query = query.filter(Book.genre.ilike(f"%{genre}%"))
    return query.all()

@router.post("")
def create_book(book: BookCreate, db: Session = Depends(get_db_books_simple)):
    db_book = Book(**book.dict(), total_pages=1)
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    return db_book

@router.get("/search")
def search_books(query: str, db: Session = Depends(get_db_books_simple)):
    # SQLite LIKE/ILIKE usually only validates ASCII case-insensitivity.
    # For robust Cyrillic support without extensions, we filter in Python.
    all_books = db.query(Book).all()
    if not query:
        return all_books
    
    query = query.lower()
    return [book for book in all_books if book.title and query in book.title.lower()]

@router.get("/{book_id}")
def get_book(book_id: int, db: Session = Depends(get_db_books_simple)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book

@router.put("/{book_id}")
def update_book(book_id: int, book: BookCreate, db: Session = Depends(get_db_books_simple)):
    db_book = db.query(Book).filter(Book.id == book_id).first()
    if not db_book:
        raise HTTPException(status_code=404, detail="Book not found")
    for key, value in book.dict().items():
        setattr(db_book, key, value)
    db.commit()
    db.refresh(db_book)
    return db_book

@router.delete("/{book_id}")
def delete_book(book_id: int, db: Session = Depends(get_db_books_simple)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if book.file_path:
        try:
            file_path = os.path.join(BASE_DIR, book.file_path)
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Ошибка при удалении файла книги: {e}")
    
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

@router.post("/{book_id}/upload")
async def upload_book_file(book_id: int, file: UploadFile = File(...), db: Session = Depends(get_db_books_simple)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    allowed_ext = {".epub"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Разрешены только файлы формата EPUB")

    file_path = os.path.abspath(os.path.join(BASE_DIR, f"uploads/books/{book_id}_{file.filename}"))
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    relative_path = os.path.relpath(file_path, BASE_DIR)
    book.file_path = relative_path.replace(os.sep, '/').replace('\\', '/')
    
    # Calculate pages
    book.total_pages = get_epub_page_count(file_path)
    
    db.commit()
    return book

@router.post("/{book_id}/upload_thumbnail")
async def upload_book_thumbnail(book_id: int, file: UploadFile = File(...), db: Session = Depends(get_db_books_simple)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    allowed_ext = {".jpg", ".jpeg", ".png", ".webp"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Неподдерживаемый формат изображения")

    thumb_path = os.path.abspath(os.path.join(BASE_DIR, f"uploads/books/{book_id}_thumb{ext}"))
    os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
    with open(thumb_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    relative_path = os.path.relpath(thumb_path, BASE_DIR)
    book.thumbnail_path = relative_path.replace(os.sep, '/').replace('\\', '/')
    db.commit()
    return book

@router.get("/{book_id}/info")
def get_book_info(book_id: int, db: Session = Depends(get_db_books_simple)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"total_pages": book.total_pages}

@router.get("/{book_id}/page/{page_num}")
async def get_book_page(book_id: int, page_num: int, db: Session = Depends(get_db_books_simple)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
         raise HTTPException(status_code=404, detail="Book not found")
    return await get_book_page_content(book, page_num, db)

@router.get("/{book_id}/file_resource/{file_path:path}")
def get_book_file_resource(book_id: int, file_path: str, db: Session = Depends(get_db_books_simple)):
    import zipfile
    import io
    from fastapi.responses import StreamingResponse
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book or not book.file_path or not book.file_path.endswith(".epub"):
        raise HTTPException(status_code=400, detail="Only EPUB files support resource access")

    try:
        with zipfile.ZipFile(book.file_path, "r") as epub:
            normalized = file_path.replace("\\", "/")
            try:
                data = epub.read(normalized)
            except KeyError:
                basename = os.path.basename(normalized).lower()
                matches = [name for name in epub.namelist() if name.lower().endswith(basename)]
                if not matches:
                    raise HTTPException(status_code=404, detail="Resource not found")
                data = epub.read(matches[0])
                normalized = matches[0]

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


