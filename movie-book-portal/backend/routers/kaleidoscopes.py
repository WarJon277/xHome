# routers/kaleidoscopes.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
from datetime import datetime
from database_kaleidoscope import get_db_kaleidoscope, Kaleidoscope, KaleidoscopeItem
from models import KaleidoscopeCreate

router = APIRouter(prefix="/kaleidoscopes", tags=["kaleidoscopes"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KALEIDOSCOPE_MUSIC_PATH = os.path.join(BASE_DIR, "uploads", "kaleidoscopes_music")

os.makedirs(KALEIDOSCOPE_MUSIC_PATH, exist_ok=True)

@router.post("/")
def create_kaleidoscope(k_data: KaleidoscopeCreate, db: Session = Depends(get_db_kaleidoscope)):
    try:
        new_k = Kaleidoscope(
            title=k_data.title,
            description=k_data.description,
            music_path=k_data.music_path,
            cover_path=k_data.cover_path,
            created_at=datetime.utcnow()
        )
        db.add(new_k)
        db.commit()
        db.refresh(new_k)

        for item in k_data.items:
            new_item = KaleidoscopeItem(
                kaleidoscope_id=new_k.id,
                photo_path=item.photo_path,
                duration=item.duration,
                order=item.order,
                transition_effect=item.transition_effect
            )
            db.add(new_item)
        
        db.commit()
        db.refresh(new_k) # Refresh again to load items if needed
        return {"message": "Kaleidoscope created successfully", "id": new_k.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
def list_kaleidoscopes(db: Session = Depends(get_db_kaleidoscope)):
    return db.query(Kaleidoscope).all()

@router.get("/{k_id}")
def get_kaleidoscope(k_id: int, db: Session = Depends(get_db_kaleidoscope)):
    k = db.query(Kaleidoscope).filter(Kaleidoscope.id == k_id).first()
    if not k:
        raise HTTPException(status_code=404, detail="Kaleidoscope not found")
    
    # Manually construction response to include items
    items = db.query(KaleidoscopeItem).filter(KaleidoscopeItem.kaleidoscope_id == k_id).order_by(KaleidoscopeItem.order).all()
    
    return {
        "id": k.id,
        "title": k.title,
        "description": k.description,
        "music_path": k.music_path,
        "cover_path": k.cover_path,
        "created_at": k.created_at,
        "items": items
    }

@router.delete("/{k_id}")
def delete_kaleidoscope(k_id: int, db: Session = Depends(get_db_kaleidoscope)):
    k = db.query(Kaleidoscope).filter(Kaleidoscope.id == k_id).first()
    if not k:
        raise HTTPException(status_code=404, detail="Kaleidoscope not found")
    
    # Optional: Delete music file if it's not used by others? 
    # For now, we leave the music file as it might be reused.
    
    db.delete(k)
    db.commit()
    return {"message": "Kaleidoscope deleted"}

@router.post("/upload_music")
async def upload_music(file: UploadFile = File(...)):
    try:
        file_ext = os.path.splitext(file.filename)[1]
        if file_ext.lower() not in ['.mp3', '.wav', '.ogg']:
             raise HTTPException(status_code=400, detail="Invalid audio format")

        file_path = os.path.join(KALEIDOSCOPE_MUSIC_PATH, file.filename)
        
        # Avoid overwriting or decide strategy. Here simple overwrite.
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        relative_path = f"/uploads/kaleidoscopes_music/{file.filename}"
        return {"music_path": relative_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
