from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database_progress import PlaybackProgress, get_db_progress
from pydantic import BaseModel

router = APIRouter(prefix="/progress", tags=["progress"])

class ProgressUpdate(BaseModel):
    item_type: str
    item_id: int
    progress_seconds: float

@router.post("")
def save_progress(data: ProgressUpdate, db: Session = Depends(get_db_progress)):
    progress = db.query(PlaybackProgress).filter(
        PlaybackProgress.item_type == data.item_type,
        PlaybackProgress.item_id == data.item_id
    ).first()

    if progress:
        progress.progress_seconds = data.progress_seconds
    else:
        progress = PlaybackProgress(
            item_type=data.item_type,
            item_id=data.item_id,
            progress_seconds=data.progress_seconds
        )
        db.add(progress)
    
    db.commit()
    db.refresh(progress)
    return {"status": "success", "progress": progress.progress_seconds}

@router.get("/{item_type}/{item_id}")
def get_progress(item_type: str, item_id: int, db: Session = Depends(get_db_progress)):
    progress = db.query(PlaybackProgress).filter(
        PlaybackProgress.item_type == item_type,
        PlaybackProgress.item_id == item_id
    ).first()

    if not progress:
        return {"progress_seconds": 0}
    
    return {"progress_seconds": progress.progress_seconds}
