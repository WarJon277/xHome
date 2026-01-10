from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
import random

from database import Movie, get_db as get_db_movies
from database_books import Book
from database_tvshows import Tvshow, Episode
from database_gallery import Photo, get_db_gallery
from database_progress import PlaybackProgress, get_db_progress
from dependencies import get_db as get_db_main, get_db_books_simple, get_db_tvshows_simple

import os
import hashlib

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GALLERY_UPLOADS = os.path.join(BASE_DIR, "uploads", "gallery")

@router.get("")
def get_dashboard_data(
    x_user_id: str = Header("global"),
    db_movies: Session = Depends(get_db_movies),
    db_books: Session = Depends(get_db_books_simple),
    db_tvshows: Session = Depends(get_db_tvshows_simple),
    db_gallery: Session = Depends(get_db_gallery),
    db_progress: Session = Depends(get_db_progress)
):
    # 1. Continue Watching (Top 5 recently updated progress)
    continue_watching = []
    recent_progress = db_progress.query(PlaybackProgress).filter(
        PlaybackProgress.user_id == x_user_id
    ).order_by(PlaybackProgress.last_updated.desc()).limit(10).all()

    for p in recent_progress:
        if p.progress_seconds == 0 and p.scroll_ratio == 0:
            continue
            
        item_data = {
            "id": p.item_id,
            "type": p.item_type,
            "progress": p.progress_seconds,
            "scroll_ratio": p.scroll_ratio,
            "last_updated": p.last_updated
        }
        
        try:
            if p.item_type == "movie":
                item = db_movies.query(Movie).filter(Movie.id == p.item_id).first()
                if item:
                    item_data["title"] = item.title
                    item_data["thumbnail"] = item.thumbnail_path
                    continue_watching.append(item_data)
            
            elif p.item_type == "book":
                item = db_books.query(Book).filter(Book.id == p.item_id).first()
                if item:
                    item_data["title"] = item.title
                    item_data["thumbnail"] = item.thumbnail_path
                    continue_watching.append(item_data)
                    
            elif p.item_type == "episode":
                episode = db_tvshows.query(Episode).filter(Episode.id == p.item_id).first()
                if episode:
                    tvshow = db_tvshows.query(Tvshow).filter(Tvshow.id == episode.tvshow_id).first()
                    if tvshow:
                        item_data["title"] = f"{tvshow.title} - S{episode.season_number:02d}E{episode.episode_number:02d}"
                        item_data["tvshow_id"] = episode.tvshow_id
                        item_data["thumbnail"] = tvshow.thumbnail_path
                        continue_watching.append(item_data)
        except Exception:
            continue
            
        if len(continue_watching) >= 5:
            break

    # 2. New Arrivals (Latest added items from each category)
    new_movies = db_movies.query(Movie).order_by(Movie.id.desc()).limit(3).all()
    new_books = db_books.query(Book).order_by(Book.id.desc()).limit(3).all()
    new_tvshows = db_tvshows.query(Tvshow).order_by(Tvshow.id.desc()).limit(3).all()
    
    new_arrivals = []
    for m in new_movies:
        new_arrivals.append({"id": m.id, "title": m.title, "thumbnail": m.thumbnail_path, "type": "movie"})
    for b in new_books:
        new_arrivals.append({"id": b.id, "title": b.title, "thumbnail": b.thumbnail_path, "type": "book"})
    for t in new_tvshows:
        new_arrivals.append({"id": t.id, "title": t.title, "thumbnail": t.thumbnail_path, "type": "tvshow"})
    
    # Sort by ID (assuming higher ID = newer) and take top 6
    new_arrivals = sorted(new_arrivals, key=lambda x: x['id'], reverse=True)[:6]

    # 3. Random Recommendation
    recommendation = None
    rec_pool = []
    
    all_movies = db_movies.query(Movie.id, Movie.title, Movie.thumbnail_path).all()
    all_books = db_books.query(Book.id, Book.title, Book.thumbnail_path).all()
    
    for m in all_movies:
        rec_pool.append({"id": m.id, "title": m.title, "thumbnail": m.thumbnail_path, "type": "movie"})
    for b in all_books:
        rec_pool.append({"id": b.id, "title": b.title, "thumbnail": b.thumbnail_path, "type": "book"})
        
    if rec_pool:
        recommendation = random.choice(rec_pool)

    # 4. Quick Access to Latest Photos (Fsys scan to match Admin/Gallery logic)
    photos_data = []
    if os.path.exists(GALLERY_UPLOADS):
        all_photos = []
        for root, dirs, files in os.walk(GALLERY_UPLOADS):
            for file in files:
                if '_thumb.' in file:
                    continue
                _, ext = os.path.splitext(file)
                if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                    full_path = os.path.join(root, file)
                    mtime = os.path.getmtime(full_path)
                    all_photos.append((mtime, full_path, file))
        
        # Sort by modification time
        all_photos.sort(key=lambda x: x[0], reverse=True)
        
        for mtime, full_path, file in all_photos[:10]:
            rel_path = os.path.relpath(full_path, BASE_DIR).replace('\\', '/')
            # Check for thumb
            thumb_name = f"{os.path.splitext(file)[0]}_thumb.webp"
            thumb_full = os.path.join(os.path.dirname(full_path), thumb_name)
            thumb_rel = rel_path
            if os.path.exists(thumb_full):
                thumb_rel = os.path.relpath(thumb_full, BASE_DIR).replace('\\', '/')
            
            photos_data.append({
                "id": int(hashlib.md5(full_path.encode()).hexdigest(), 16) % 10**8,
                "url": f"/{rel_path}",
                "thumbnail": f"/{thumb_rel}"
            })

    # 5. Daily Stats
    photo_count = 0
    if os.path.exists(GALLERY_UPLOADS):
        for root, dirs, files in os.walk(GALLERY_UPLOADS):
            for file in files:
                if '_thumb.' in file: continue
                _, ext = os.path.splitext(file)
                if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                    photo_count += 1

    stats = {
        "movies_count": db_movies.query(func.count(Movie.id)).scalar(),
        "books_count": db_books.query(func.count(Book.id)).scalar(),
        "tvshows_count": db_tvshows.query(func.count(Tvshow.id)).scalar(),
        "photos_count": photo_count
    }

    return {
        "continue_watching": continue_watching,
        "new_arrivals": new_arrivals,
        "recommendation": recommendation,
        "latest_photos": photos_data,
        "stats": stats
    }
