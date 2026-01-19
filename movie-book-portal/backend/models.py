from pydantic import BaseModel
from typing import Optional

class MovieCreate(BaseModel):
    title: str
    year: Optional[int] = None
    director: Optional[str] = None
    genre: Optional[str] = None
    rating: Optional[float] = None
    description: Optional[str] = None

    model_config = {
        "extra": "ignore",
        "populate_by_name": True,
    }

class TvshowCreate(BaseModel):
    title: str
    year: Optional[int] = None
    director: Optional[str] = None
    genre: Optional[str] = None
    rating: Optional[float] = None
    description: Optional[str] = None
    episodes_count: Optional[int] = None
    season_count: Optional[int] = None

    model_config = {
        "extra": "ignore",
        "populate_by_name": True,
    }

class EpisodeCreate(BaseModel):
    tvshow_id: int
    season_number: int
    episode_number: int
    title: Optional[str] = None
    description: Optional[str] = None

    model_config = {
        "extra": "ignore",
        "populate_by_name": True,
    }

class BookCreate(BaseModel):
    title: str
    year: Optional[int] = None
    author: Optional[str] = None
    genre: Optional[str] = None
    rating: Optional[float] = None
    description: Optional[str] = None
    series: Optional[str] = None
    series_index: Optional[int] = None

    model_config = {
        "extra": "ignore",
        "populate_by_name": True,
    }

class AudiobookCreate(BaseModel):
    title: str
    year: Optional[int] = None
    author: Optional[str] = None
    narrator: Optional[str] = None
    genre: Optional[str] = None
    rating: Optional[float] = None
    description: Optional[str] = None
    duration: Optional[int] = 0
    series: Optional[str] = None
    series_index: Optional[int] = None

    model_config = {
        "extra": "ignore",
        "populate_by_name": True,
    }


class PhotoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = "general"

    model_config = {
        "extra": "ignore",
        "populate_by_name": True,
    }

class KaleidoscopeItemCreate(BaseModel):
    photo_path: str
    duration: Optional[float] = 5.0
    order: Optional[int] = 0
    transition_effect: Optional[str] = "fade"

class KaleidoscopeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    music_path: Optional[str] = None
    cover_path: Optional[str] = None
    items: list[KaleidoscopeItemCreate]

    model_config = {
        "extra": "ignore",
        "populate_by_name": True,
    }
