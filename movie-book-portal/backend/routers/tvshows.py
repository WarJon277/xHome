import os
import shutil
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database_tvshows import Tvshow, Episode
from models import TvshowCreate, EpisodeCreate
from dependencies import get_db_tvshows_simple

router = APIRouter(tags=["tvshows"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@router.get("/tvshows")
def get_tvshows(genre: str = None, db: Session = Depends(get_db_tvshows_simple)):
    query = db.query(Tvshow)
    if genre and genre != "Все":
        query = query.filter(Tvshow.genre.ilike(f"%{genre}%"))
    return query.all()

@router.post("/tvshows")
def create_tvshow(tvshow: TvshowCreate, db: Session = Depends(get_db_tvshows_simple)):
    db_tvshow = Tvshow(**tvshow.dict())
    db.add(db_tvshow)
    db.commit()
    db.refresh(db_tvshow)
    return db_tvshow

@router.get("/tvshows/{tvshow_id}")
def get_tvshow(tvshow_id: int, db: Session = Depends(get_db_tvshows_simple)):
    tvshow = db.query(Tvshow).filter(Tvshow.id == tvshow_id).first()
    if not tvshow:
        raise HTTPException(status_code=404, detail="Tvshow not found")
    return tvshow

@router.put("/tvshows/{tvshow_id}")
def update_tvshow(tvshow_id: int, tvshow: TvshowCreate, db: Session = Depends(get_db_tvshows_simple)):
    db_tvshow = db.query(Tvshow).filter(Tvshow.id == tvshow_id).first()
    if not db_tvshow:
        raise HTTPException(status_code=404, detail="Tvshow not found")
    for key, value in tvshow.dict().items():
        setattr(db_tvshow, key, value)
    db.commit()
    db.refresh(db_tvshow)
    return db_tvshow

@router.delete("/tvshows/{tvshow_id}")
def delete_tvshow(tvshow_id: int, db: Session = Depends(get_db_tvshows_simple)):
    tvshow = db.query(Tvshow).filter(Tvshow.id == tvshow_id).first()
    if not tvshow:
        raise HTTPException(status_code=404, detail="Tvshow not found")
    
    if tvshow.file_path:
        try:
            file_path = os.path.join(BASE_DIR, tvshow.file_path)
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Ошибка при удалении файла сериала: {e}")
    
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

@router.post("/tvshows/{tvshow_id}/upload")
async def upload_tvshow_file(tvshow_id: int, file: UploadFile = File(...), db: Session = Depends(get_db_tvshows_simple)):
    tvshow = db.query(Tvshow).filter(Tvshow.id == tvshow_id).first()
    if not tvshow:
        raise HTTPException(status_code=404, detail="Tvshow not found")

    allowed_ext = {".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm", ".m4v", ".3gp", ".3g2", ".ogv", ".qt"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"Неподдерживаемый формат видео.")

    file_path = os.path.abspath(os.path.join(BASE_DIR, f"uploads/tvshows/{tvshow_id}_{file.filename}"))
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    relative_path = os.path.relpath(file_path, BASE_DIR)
    tvshow.file_path = relative_path.replace(os.sep, '/').replace('\\', '/')
    db.commit()
    return tvshow

@router.post("/tvshows/{tvshow_id}/upload_thumbnail")
async def upload_tvshow_thumbnail(tvshow_id: int, file: UploadFile = File(...), db: Session = Depends(get_db_tvshows_simple)):
    tvshow = db.query(Tvshow).filter(Tvshow.id == tvshow_id).first()
    if not tvshow:
        raise HTTPException(status_code=404, detail="Tvshow not found")

    allowed_ext = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail="Неподдерживаемый формат изображения")

    thumb_path = os.path.abspath(os.path.join(BASE_DIR, f"uploads/tvshows/{tvshow_id}_thumb{ext}"))
    os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
    with open(thumb_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    relative_path = os.path.relpath(thumb_path, BASE_DIR)
    tvshow.thumbnail_path = relative_path.replace(os.sep, '/').replace('\\', '/')
    db.commit()
    return tvshow

@router.get("/tvshows/search")
def search_tvshows(query: str, db: Session = Depends(get_db_tvshows_simple)):
    return db.query(Tvshow).filter(Tvshow.title.ilike(f"%{query}%")).all()

# Episodes
@router.get("/episodes")
def get_episodes(tvshow_id: Optional[int] = None, season: Optional[int] = None, db: Session = Depends(get_db_tvshows_simple)):
    query = db.query(Episode)
    if tvshow_id:
        query = query.filter(Episode.tvshow_id == tvshow_id)
    if season:
        query = query.filter(Episode.season_number == season)
    return query.all()

@router.get("/episodes/{episode_id}")
def get_episode(episode_id: int, db: Session = Depends(get_db_tvshows_simple)):
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    return episode

@router.post("/episodes")
def create_episode(episode: EpisodeCreate, db: Session = Depends(get_db_tvshows_simple)):
    tvshow = db.query(Tvshow).filter(Tvshow.id == episode.tvshow_id).first()
    if not tvshow:
        raise HTTPException(status_code=404, detail="Tvshow not found")
    db_episode = Episode(**episode.dict())
    db.add(db_episode)
    db.commit()
    db.refresh(db_episode)
    return db_episode

@router.put("/episodes/{episode_id}")
def update_episode(episode_id: int, episode: EpisodeCreate, db: Session = Depends(get_db_tvshows_simple)):
    db_episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not db_episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    for key, value in episode.dict().items():
        setattr(db_episode, key, value)
    db.commit()
    db.refresh(db_episode)
    return db_episode

@router.delete("/episodes/{episode_id}")
def delete_episode(episode_id: int, db: Session = Depends(get_db_tvshows_simple)):
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    
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

@router.post("/episodes/{episode_id}/upload")
async def upload_episode_file(episode_id: int, file: UploadFile = File(...), db: Session = Depends(get_db_tvshows_simple)):
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    allowed_ext = {".mp4", ".avi", ".mov", ".mkv", ".wmv", ".flv", ".webm", ".m4v", ".3gp", ".3g2", ".ogv", ".qt"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"Неподдерживаемый формат видео.")

    file_path = os.path.abspath(os.path.join(BASE_DIR, f"uploads/tvshows/{episode.tvshow_id}/S{episode.season_number:02d}E{episode.episode_number:02d}_{file.filename}"))
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    relative_path = os.path.relpath(file_path, BASE_DIR)
    episode.file_path = relative_path.replace(os.sep, '/').replace('\\', '/')
    db.commit()
    return episode
