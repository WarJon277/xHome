import os
import json
from typing import Dict, Any
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fastapi import APIRouter, HTTPException, Body, Depends

from dependencies import get_db, get_db_books_simple, get_db_tvshows_simple, get_db_gallery_simple
from database import Movie, Settings
from database_books import Book
from database_tvshows import Tvshow
from database_gallery import Photo

router = APIRouter(prefix="/admin", tags=["admin"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEME_SETTINGS_FILE = os.path.join(BASE_DIR, "theme_settings.json")

# Default theme settings
DEFAULT_THEME = {
    "--bg-primary": "#0a0a1a",
    "--bg-secondary": "#1e1e1e",
    "--text-primary": "#ffffff",
    "--text-secondary": "#e0e0e0",
    "--accent-color": "#e50914",
    "--card-bg": "#1f1f1f",
    "--header-bg": "rgba(18, 18, 28, 0.8)",
    "--font-family": "Arial, sans-serif"
}

class ThemeSettings(BaseModel):
    settings: Dict[str, str]

def load_theme_settings():
    if not os.path.exists(THEME_SETTINGS_FILE):
        return DEFAULT_THEME
    try:
        with open(THEME_SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_THEME

def save_theme_settings(settings: Dict[str, str]):
    with open(THEME_SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=4)

@router.get("/theme")
def get_theme(db: Session = Depends(get_db)):
    """Get current theme settings from DB"""
    try:
        settings_record = db.query(Settings).filter(Settings.key == "app_theme").first()
        if settings_record:
            return json.loads(settings_record.value)
        return DEFAULT_THEME
    except Exception:
        return DEFAULT_THEME

@router.post("/theme")
def update_theme(theme: ThemeSettings = Body(...), db: Session = Depends(get_db)):
    """Update theme settings in DB"""
    try:
        settings_record = db.query(Settings).filter(Settings.key == "app_theme").first()
        if not settings_record:
            settings_record = Settings(key="app_theme", value=json.dumps(theme.settings))
            db.add(settings_record)
        else:
            settings_record.value = json.dumps(theme.settings)
        db.commit()
        return {"message": "Theme updated successfully", "settings": theme.settings}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save theme: {str(e)}")

@router.post("/theme/reset")
def reset_theme(db: Session = Depends(get_db)):
    """Reset theme to defaults in DB"""
    try:
        settings_record = db.query(Settings).filter(Settings.key == "app_theme").first()
        if settings_record:
            settings_record.value = json.dumps(DEFAULT_THEME)
            db.commit()
        return {"message": "Theme reset successfully", "settings": DEFAULT_THEME}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reset theme: {str(e)}")

@router.get("/stats")
def get_stats(
    db_movies: Session = Depends(get_db),
    db_books: Session = Depends(get_db_books_simple),
    db_tvshows: Session = Depends(get_db_tvshows_simple),
    db_gallery: Session = Depends(get_db_gallery_simple)
):
    """Get real usage stats"""
    try:
        # Count photos by scanning filesystem recursively
        gallery_path = os.path.join(BASE_DIR, "uploads", "gallery")
        photo_count = 0
        
        if os.path.exists(gallery_path):
            for root, dirs, files in os.walk(gallery_path):
                for file in files:
                    # Count image files (excluding thumbnails and service files)
                    if (file.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')) 
                        and not file.startswith('thumb_')
                        and 'folder-icon' not in file.lower()):
                        photo_count += 1
        
        stats = {
            "movies": db_movies.query(Movie).count(),
            "books": db_books.query(Book).count(),
            "tvshows": db_tvshows.query(Tvshow).count(),
            "photos": photo_count
        }
        return stats
    except Exception as e:
        print(f"Error fetching stats: {e}")
        return {
            "movies": 0,
            "books": 0,
            "tvshows": 0,
            "photos": 0
        }

