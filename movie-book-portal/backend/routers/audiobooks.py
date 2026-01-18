import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database_audiobooks import Audiobook
from models import AudiobookCreate
from dependencies import get_db_audiobooks_simple
from utils import get_book_page_content

router = APIRouter(prefix="/audiobooks", tags=["audiobooks"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@router.get("")
def get_audiobooks(genre: str = None, db: Session = Depends(get_db_audiobooks_simple)):
    query = db.query(Audiobook)
    if genre and genre != "Все":
        query = query.filter(Audiobook.genre.ilike(f"%{genre}%"))
    return query.all()

@router.post("")
def create_audiobook(audiobook: AudiobookCreate, db: Session = Depends(get_db_audiobooks_simple)):
    db_audiobook = Audiobook(**audiobook.dict(), source="manual")
    db.add(db_audiobook)
    db.commit()
    db.refresh(db_audiobook)
    return db_audiobook

@router.get("/{audiobook_id}")
def get_audiobook(audiobook_id: int, db: Session = Depends(get_db_audiobooks_simple)):
    audiobook = db.query(Audiobook).filter(Audiobook.id == audiobook_id).first()
    if not audiobook:
        raise HTTPException(status_code=404, detail="Audiobook not found")
    return audiobook

@router.put("/{audiobook_id}")
def update_audiobook(audiobook_id: int, audiobook: AudiobookCreate, db: Session = Depends(get_db_audiobooks_simple)):
    db_audiobook = db.query(Audiobook).filter(Audiobook.id == audiobook_id).first()
    if not db_audiobook:
        raise HTTPException(status_code=404, detail="Audiobook not found")
    for key, value in audiobook.dict().items():
        setattr(db_audiobook, key, value)
    db.commit()
    db.refresh(db_audiobook)
    return db_audiobook

@router.delete("/{audiobook_id}")
def delete_audiobook(audiobook_id: int, db: Session = Depends(get_db_audiobooks_simple)):
    audiobook = db.query(Audiobook).filter(Audiobook.id == audiobook_id).first()
    if not audiobook:
        raise HTTPException(status_code=404, detail="Audiobook not found")
    
    if audiobook.file_path:
        try:
            file_path = os.path.join(BASE_DIR, audiobook.file_path)
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Ошибка при удалении файла аудиокниги: {e}")
    
    if audiobook.thumbnail_path:
        try:
            thumbnail_path = os.path.join(BASE_DIR, audiobook.thumbnail_path)
            if os.path.exists(thumbnail_path):
                os.remove(thumbnail_path)
        except Exception as e:
            print(f"Ошибка при удалении обложки аудиокниги: {e}")
    
    db.delete(audiobook)
    db.commit()
    return {"status": "deleted"}

@router.post("/{audiobook_id}/upload")
async def upload_audiobook_file(
    audiobook_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db_audiobooks_simple)
):
    """Upload an audio file for an audiobook"""
    audiobook = db.query(Audiobook).filter(Audiobook.id == audiobook_id).first()
    if not audiobook:
        raise HTTPException(status_code=404, detail="Audiobook not found")
    
    try:
        AUDIOBOOKS_UPLOADS = os.path.join(BASE_DIR, "uploads", "audiobooks")
        os.makedirs(AUDIOBOOKS_UPLOADS, exist_ok=True)
        
        if file.filename.lower().endswith('.zip'):
             # Unzip logic
             import uuid
             temp_zip_name = f"temp_{uuid.uuid4()}.zip"
             temp_zip_path = os.path.join(AUDIOBOOKS_UPLOADS, temp_zip_name)
             
             with open(temp_zip_path, "wb") as buffer:
                 content = await file.read()
                 buffer.write(content)
                 
             # Create a directory for the audiobook
             book_dir_name = f"audiobook_{audiobook_id}_{audiobook.title[:30].replace(' ', '_')}"
             book_dir_path = os.path.join(AUDIOBOOKS_UPLOADS, book_dir_name)
             
             from utils import unzip_file, find_audio_files, find_thumbnail_in_dir
             
             if unzip_file(temp_zip_path, book_dir_path):
                 # Find first audio file
                 audio_files = find_audio_files(book_dir_path)
                 if audio_files:
                     # Use the first audio file relative to BASE_DIR
                     first_file = audio_files[0]
                     relative_path = os.path.relpath(first_file, BASE_DIR)
                     audiobook.file_path = relative_path
                     
                     # Look for thumbnail if not already present or if we want to overwrite
                     if not audiobook.thumbnail_path:
                         thumb_path = find_thumbnail_in_dir(book_dir_path)
                         if thumb_path:
                             audiobook.thumbnail_path = os.path.relpath(thumb_path, BASE_DIR)
                     
                     db.commit()
                     
                     # Remove absolute zip file
                     try:
                        os.remove(temp_zip_path)
                     except: pass
                     
                     return {"status": "uploaded_and_unzipped", "file_path": relative_path}
                 else:
                     raise HTTPException(status_code=400, detail="No audio files found in ZIP")
             else:
                 raise HTTPException(status_code=400, detail="Failed to unzip file")
                 
        else:
            # Save file normally
            file_extension = os.path.splitext(file.filename)[1]
            safe_filename = f"audiobook_{audiobook_id}_{audiobook.title[:30].replace(' ', '_')}{file_extension}"
            file_path = os.path.join(AUDIOBOOKS_UPLOADS, safe_filename)
            
            with open(file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)
            
            # Update database
            relative_path = os.path.relpath(file_path, BASE_DIR)
            audiobook.file_path = relative_path
            db.commit()
            
            return {"status": "uploaded", "file_path": relative_path}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке файла: {str(e)}")

@router.post("/{audiobook_id}/thumbnail")
async def upload_audiobook_thumbnail(
    audiobook_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db_audiobooks_simple)
):
    """Upload a thumbnail for an audiobook"""
    audiobook = db.query(Audiobook).filter(Audiobook.id == audiobook_id).first()
    if not audiobook:
        raise HTTPException(status_code=404, detail="Audiobook not found")
    
    try:
        THUMBNAILS_PATH = os.path.join(BASE_DIR, "uploads", "audiobooks", "thumbnails")
        os.makedirs(THUMBNAILS_PATH, exist_ok=True)
        
        file_extension = os.path.splitext(file.filename)[1]
        safe_filename = f"thumb_{audiobook_id}{file_extension}"
        file_path = os.path.join(THUMBNAILS_PATH, safe_filename)
        
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        relative_path = os.path.relpath(file_path, BASE_DIR)
        audiobook.thumbnail_path = relative_path
        db.commit()
        
        return {"status": "uploaded", "thumbnail_path": relative_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке обложки: {str(e)}")
