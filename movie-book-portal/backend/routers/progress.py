from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from database_progress import PlaybackProgress, get_db_progress
from pydantic import BaseModel
from database import Movie
from database_books import Book
from database_tvshows import Episode, Tvshow
from dependencies import get_db as get_db_movies, get_db_books_simple, get_db_tvshows_simple

router = APIRouter(prefix="/progress", tags=["progress"])

class ProgressUpdate(BaseModel):
    item_type: str
    item_id: int
    progress_seconds: float
    scroll_ratio: float = 0.0

@router.post("")
def save_progress(
    data: ProgressUpdate, 
    x_user_id: str = Header("global"),
    db: Session = Depends(get_db_progress)
):
    progress = db.query(PlaybackProgress).filter(
        PlaybackProgress.item_type == data.item_type,
        PlaybackProgress.item_id == data.item_id,
        PlaybackProgress.user_id == x_user_id
    ).first()

    if progress:
        progress.progress_seconds = data.progress_seconds
        progress.scroll_ratio = data.scroll_ratio
    else:
        progress = PlaybackProgress(
            item_type=data.item_type,
            item_id=data.item_id,
            progress_seconds=data.progress_seconds,
            scroll_ratio=data.scroll_ratio,
            user_id=x_user_id
        )
        db.add(progress)
    
    db.commit()
    db.refresh(progress)
    return {"status": "success", "progress": progress.progress_seconds, "scroll_ratio": progress.scroll_ratio}

@router.get("/latest/{item_type}")
def get_latest_progress(
    item_type: str, 
    x_user_id: str = Header("global"),
    db: Session = Depends(get_db_progress),
    db_movies: Session = Depends(get_db_movies),
    db_books: Session = Depends(get_db_books_simple),
    db_tvshows: Session = Depends(get_db_tvshows_simple)
):
    # Map 'tvshow' to 'episode' if sent from frontend
    search_type = "episode" if item_type == "tvshow" else item_type
    
    progress = db.query(PlaybackProgress).filter(
        PlaybackProgress.item_type == search_type,
        PlaybackProgress.user_id == x_user_id
    ).order_by(PlaybackProgress.last_updated.desc()).first()

    if not progress or progress.progress_seconds == 0:
        return None

    item_data = {
        "item_id": progress.item_id, 
        "item_type": item_type,
        "progress": progress.progress_seconds, 
        "scroll_ratio": progress.scroll_ratio,
        "last_updated": progress.last_updated
    }

    try:
        if search_type == "movie":
            item = db_movies.query(Movie).filter(Movie.id == progress.item_id).first()
            if item:
                item_data["title"] = item.title
                item_data["thumbnail"] = item.thumbnail_path
        
        elif search_type == "book":
            item = db_books.query(Book).filter(Book.id == progress.item_id).first()
            if item:
                item_data["title"] = item.title
                item_data["author"] = item.author
                item_data["thumbnail"] = item.thumbnail_path
                
        elif search_type == "episode":
            episode = db_tvshows.query(Episode).filter(Episode.id == progress.item_id).first()
            if episode:
                tvshow = db_tvshows.query(Tvshow).filter(Tvshow.id == episode.tvshow_id).first()
                if tvshow:
                    item_data["title"] = f"{tvshow.title} - С{episode.season_number:02d}Э{episode.episode_number:02d}"
                    item_data["tvshow_id"] = episode.tvshow_id
                    item_data["thumbnail"] = tvshow.thumbnail_path
    except Exception as e:
        print(f"Error fetching details for {search_type} {progress.item_id}: {e}")

    return item_data

@router.get("/{item_type}/{item_id}")
def get_progress(
    item_type: str, 
    item_id: int, 
    x_user_id: str = Header("global"),
    db: Session = Depends(get_db_progress)
):
    progress = db.query(PlaybackProgress).filter(
        PlaybackProgress.item_type == item_type,
        PlaybackProgress.item_id == item_id,
        PlaybackProgress.user_id == x_user_id
    ).first()

    if not progress:
        return {"progress_seconds": 0, "scroll_ratio": 0.0}
    
    return {
        "progress_seconds": progress.progress_seconds,
        "scroll_ratio": getattr(progress, "scroll_ratio", 0.0)
    }
