import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database import Movie
from models import MovieCreate
from dependencies import get_db

router = APIRouter(prefix="/movies", tags=["movies"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@router.get("")
def get_movies(genre: str = None, db: Session = Depends(get_db)):
    query = db.query(Movie)
    if genre and genre != "Все":
        query = query.filter(Movie.genre.ilike(f"%{genre}%"))
    return query.all()

@router.post("")
def create_movie(movie: MovieCreate, db: Session = Depends(get_db)):
    db_movie = Movie(**movie.dict())
    db.add(db_movie)
    db.commit()
    db.refresh(db_movie)
    return db_movie

@router.get("/{movie_id}")
def get_movie(movie_id: int, db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return movie

@router.put("/{movie_id}")
def update_movie(movie_id: int, movie: MovieCreate, db: Session = Depends(get_db)):
    db_movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not db_movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    for key, value in movie.dict().items():
        setattr(db_movie, key, value)
    db.commit()
    db.refresh(db_movie)
    return db_movie

@router.delete("/{movie_id}")
def delete_movie(movie_id: int, db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    if movie.file_path:
        try:
            file_path = os.path.join(BASE_DIR, movie.file_path)
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Ошибка при удалении файла фильма: {e}")
    
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

@router.post("/{movie_id}/upload")
async def upload_movie_file(movie_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    allowed_ext = {".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm", ".m4v", ".3gp", ".3g2", ".ogv", ".qt"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"Неподдерживаемый формат видео.")

    file_path = os.path.abspath(os.path.join(BASE_DIR, f"uploads/movies/{movie_id}_{file.filename}"))
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    relative_path = os.path.relpath(file_path, BASE_DIR)
    movie.file_path = relative_path.replace(os.sep, '/').replace('\\', '/')
    db.commit()
    return movie

@router.post("/{movie_id}/upload_thumbnail")
async def upload_movie_thumbnail(movie_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    allowed_ext = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Неподдерживаемый формат изображения")

    thumb_path = os.path.abspath(os.path.join(BASE_DIR, f"uploads/movies/{movie_id}_thumb{ext}"))
    os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
    with open(thumb_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    relative_path = os.path.relpath(thumb_path, BASE_DIR)
    movie.thumbnail_path = relative_path.replace(os.sep, '/').replace('\\', '/')
    db.commit()
    return movie

@router.get("/search")
def search_movies(query: str, db: Session = Depends(get_db)):
    return db.query(Movie).filter(Movie.title.ilike(f"%{query}%")).all()
