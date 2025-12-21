from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, FileResponse
from sqlalchemy.orm import Session
import os
import shutil
from database import get_db, create_tables, add_sample_data, Movie, Book
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend"))
uploads_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "uploads"))
os.makedirs(uploads_path, exist_ok=True)
app.mount("/static", StaticFiles(directory=frontend_path), name="static")
app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")

create_tables()
add_sample_data()

@app.get("/")
async def read_root():
    return FileResponse(os.path.join(frontend_path, "index.html"))

class MovieCreate(BaseModel):
    title: str
    year: int
    director: str
    genre: str
    rating: float
    description: str = None
    file_path: str = None

class BookCreate(BaseModel):
    title: str
    author: str
    year: int
    genre: str
    rating: float
    description: str = None

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

@app.post("/movies/{movie_id}/upload")
async def upload_movie_file(movie_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    # Проверяем тип файла
    allowed_extensions = {".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm", ".mp4v", ".m4v", ".3gp", ".3g2", ".ogv", ".qt"}
    file_extension = os.path.splitext(file.filename)[1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Формат файла не поддерживается. Разрешены: {', '.join(allowed_extensions)}")
    
    file_path = f"uploads/{movie_id}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    movie.file_path = file_path
    db.commit()
    db.refresh(movie)
    return movie

@app.post("/movies/{movie_id}/upload_thumbnail")
async def upload_movie_thumbnail(movie_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    # Проверяем тип файла
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    file_extension = os.path.splitext(file.filename)[1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Формат файла не поддерживается. Разрешены: {', '.join(allowed_extensions)}")
    
    file_path = f"uploads/{movie_id}_thumbnail{file_extension}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    movie.thumbnail_path = file_path
    db.commit()
    db.refresh(movie)
    return movie

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
    return {"message": "Movie deleted"}

@app.get("/movies/search")
def search_movies(query: str, db: Session = Depends(get_db)):
    return db.query(Movie).filter(Movie.title.contains(query)).all()

@app.get("/books")
def get_books(db: Session = Depends(get_db)):
    return db.query(Book).all()

@app.post("/books")
def create_book(book: BookCreate, db: Session = Depends(get_db)):
    db_book = Book(**book.dict())
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    return db_book

@app.get("/books/{book_id}")
def get_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book

@app.put("/books/{book_id}")
def update_book(book_id: int, book: BookCreate, db: Session = Depends(get_db)):
    db_book = db.query(Book).filter(Book.id == book_id).first()
    if not db_book:
        raise HTTPException(status_code=404, detail="Book not found")
    for key, value in book.dict().items():
        setattr(db_book, key, value)
    db.commit()
    db.refresh(db_book)
    return db_book

@app.delete("/books/{book_id}")
def delete_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    db.delete(book)
    db.commit()
    return {"message": "Book deleted"}

@app.get("/books/search")
def search_books(query: str, db: Session = Depends(get_db)):
    return db.query(Book).filter(Book.title.contains(query)).all()