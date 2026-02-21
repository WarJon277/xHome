import os
import shutil
import hashlib
import time
import subprocess
import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from database_videogallery import SessionLocalVideoGallery, Video, get_db_videogallery
from sqlalchemy.orm import Session

router = APIRouter(prefix="/videogallery", tags=["videogallery"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEOGALLERY_UPLOADS = os.path.join(BASE_DIR, "uploads", "videogallery")

# Ensure upload directories exist
os.makedirs(VIDEOGALLERY_UPLOADS, exist_ok=True)
os.makedirs(os.path.join(VIDEOGALLERY_UPLOADS, "thumbnails"), exist_ok=True)

def get_db():
    db = SessionLocalVideoGallery()
    try:
        yield db
    finally:
        db.close()

def get_video_creation_date(path):
    try:
        command = [
            'ffprobe',
            '-v', 'quiet',
            '-show_entries', 'format_tags=creation_time',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            path
        ]
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        creation_time_str = result.stdout.strip()
        if creation_time_str:
            # ISO format 2024-02-21T11:30:00.000000Z
            ts_str = creation_time_str.split('.')[0].replace('Z', '')
            dt = datetime.datetime.fromisoformat(ts_str)
            return dt.timestamp()
    except Exception:
        pass
    return None

def search_directory_for_videos(directory: str, relative_path: str = ""):
    items = []
    
    if not os.path.exists(directory):
        return items

    for file in os.listdir(directory):
        if file == "thumbnails":
            continue
            
        full_path = os.path.join(directory, file)
        rel_path = os.path.join(relative_path, file).replace("\\", "/")

        if os.path.isdir(full_path):
            items.append({
                "type": "folder",
                "name": file,
                "path": rel_path
            })
        else:
            ext = os.path.splitext(file)[1].lower()
            if ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
                # Check for thumbnail
                thumb_name = f"{hashlib.md5(rel_path.encode()).hexdigest()}.jpg"
                thumb_path = os.path.join(VIDEOGALLERY_UPLOADS, "thumbnails", thumb_name)
                
                has_thumbnail = os.path.exists(thumb_path)
                
                # Get real creation date
                v_date = get_video_creation_date(full_path)
                modified_time = v_date if v_date else (os.path.getmtime(full_path) if os.path.exists(full_path) else None)

                items.append({
                    "id": hashlib.md5(rel_path.encode()).hexdigest()[:8],
                    "type": "video",
                    "name": file,
                    "title": os.path.splitext(file)[0],
                    "path": rel_path,
                    "thumbnail_path": f"/uploads/videogallery/thumbnails/{thumb_name}" if has_thumbnail else None,
                    "file_path": f"/uploads/videogallery/{rel_path}",
                    "modified": modified_time
                })
    return items

def generate_video_thumbnail(video_path, thumbnail_path):
    try:
        command = [
            'ffmpeg',
            '-i', video_path,
            '-ss', '00:00:01.000',
            '-vframes', '1',
            '-q:v', '2',
            thumbnail_path,
            '-y'
        ]
        subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
        return os.path.exists(thumbnail_path)
    except Exception as e:
        print(f"Error generating thumbnail: {e}")
        return False

@router.get("/")
def get_videogallery_contents(folder: str = ""):
    target_dir = os.path.join(VIDEOGALLERY_UPLOADS, folder)
    if not os.path.exists(target_dir):
        os.makedirs(target_dir, exist_ok=True)

    items = search_directory_for_videos(target_dir, folder)
    
    parent_folder = None
    if folder:
        parent_folder = os.path.dirname(folder)
        
    return {
        "current_folder": folder,
        "parent": parent_folder,
        "items": items
    }

@router.post("/upload")
def upload_video_to_folder(folder: str = Form(""), file: UploadFile = File(...)):
    try:
        target_dir = os.path.join(VIDEOGALLERY_UPLOADS, folder)
        os.makedirs(target_dir, exist_ok=True)

        file_path = os.path.join(target_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Generate thumbnail
        rel_path = os.path.join(folder, file.filename).replace("\\", "/")
        thumb_name = f"{hashlib.md5(rel_path.encode()).hexdigest()}.jpg"
        thumb_path = os.path.join(VIDEOGALLERY_UPLOADS, "thumbnails", thumb_name)
        
        generate_video_thumbnail(file_path, thumb_path)

        return {"status": "success", "file": file.filename, "path": rel_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/folder")
def create_video_folder(data: dict):
    folder_name = data.get("name")
    parent_folder = data.get("parent", "")
    
    if not folder_name:
        raise HTTPException(status_code=400, detail="Folder name is required")
        
    target_dir = os.path.join(VIDEOGALLERY_UPLOADS, parent_folder, folder_name)
    if os.path.exists(target_dir):
        raise HTTPException(status_code=400, detail="Folder already exists")
        
    os.makedirs(target_dir)
    return {"status": "success", "folder": folder_name}

@router.delete("/folder")
def delete_video_folder(path: str):
    target_dir = os.path.join(VIDEOGALLERY_UPLOADS, path)
    if not os.path.exists(target_dir):
        raise HTTPException(status_code=404, detail="Folder not found")
        
    if os.path.abspath(target_dir) == os.path.abspath(VIDEOGALLERY_UPLOADS) or os.path.abspath(target_dir) == os.path.abspath(os.path.join(VIDEOGALLERY_UPLOADS, "thumbnails")):
        raise HTTPException(status_code=400, detail="Cannot delete root directories")

    # Clean up thumbnails for all videos in this folder
    for root, dirs, files in os.walk(target_dir):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
                file_rel_path = os.path.relpath(os.path.join(root, f), VIDEOGALLERY_UPLOADS).replace("\\", "/")
                thumb_name = f"{hashlib.md5(file_rel_path.encode()).hexdigest()}.jpg"
                thumb_path = os.path.join(VIDEOGALLERY_UPLOADS, "thumbnails", thumb_name)
                if os.path.exists(thumb_path):
                    os.remove(thumb_path)
                    
    shutil.rmtree(target_dir)
    return {"status": "success"}

@router.delete("/file")
def delete_video(path: str):
    target_file = os.path.join(VIDEOGALLERY_UPLOADS, path)
    if not os.path.exists(target_file):
        raise HTTPException(status_code=404, detail="Video not found")
        
    # Delete thumbnail
    rel_path = path.replace("\\", "/")
    thumb_name = f"{hashlib.md5(rel_path.encode()).hexdigest()}.jpg"
    thumb_path = os.path.join(VIDEOGALLERY_UPLOADS, "thumbnails", thumb_name)
    if os.path.exists(thumb_path):
        os.remove(thumb_path)
        
    os.remove(target_file)
    return {"status": "success"}

@router.post("/move")
def move_video(video_path: str = Form(...), target_folder: str = Form(None)):
    if not video_path:
        raise HTTPException(status_code=400, detail="video_path is required")

    source_file = os.path.join(VIDEOGALLERY_UPLOADS, video_path)
    if not os.path.exists(source_file):
        raise HTTPException(status_code=404, detail="Source video not found")

    target_dir = VIDEOGALLERY_UPLOADS
    if target_folder:
        target_dir = os.path.join(VIDEOGALLERY_UPLOADS, target_folder)

    if not os.path.exists(target_dir):
        os.makedirs(target_dir, exist_ok=True)

    filename = os.path.basename(source_file)
    target_file = os.path.join(target_dir, filename)

    if source_file == target_file:
         return {"status": "success", "message": "Already in target folder"}

    # Handle renaming of thumbnail for new path
    old_rel_path = video_path.replace("\\", "/")
    new_rel_path = os.path.join(target_folder if target_folder else "", filename).replace("\\", "/")
    
    old_thumb_name = f"{hashlib.md5(old_rel_path.encode()).hexdigest()}.jpg"
    new_thumb_name = f"{hashlib.md5(new_rel_path.encode()).hexdigest()}.jpg"
    
    old_thumb_path = os.path.join(VIDEOGALLERY_UPLOADS, "thumbnails", old_thumb_name)
    new_thumb_path = os.path.join(VIDEOGALLERY_UPLOADS, "thumbnails", new_thumb_name)
    
    if os.path.exists(old_thumb_path):
        os.rename(old_thumb_path, new_thumb_path)

    shutil.move(source_file, target_file)

    return {"status": "success", "new_path": new_rel_path}

@router.post("/move_folder")
def move_video_folder(folder_path: str = Form(...), target_folder: str = Form(None)):
    if not folder_path:
        raise HTTPException(status_code=400, detail="folder_path is required")

    source_dir = os.path.join(VIDEOGALLERY_UPLOADS, folder_path)
    if not os.path.exists(source_dir):
        raise HTTPException(status_code=404, detail="Source folder not found")

    target_dir_base = VIDEOGALLERY_UPLOADS
    if target_folder:
        target_dir_base = os.path.join(VIDEOGALLERY_UPLOADS, target_folder)

    if not os.path.exists(target_dir_base):
        os.makedirs(target_dir_base, exist_ok=True)

    folder_name = os.path.basename(source_dir)
    target_final_dir = os.path.join(target_dir_base, folder_name)
    
    # Needs a complex re-hashing of thumbnails for all items if moving foldering, 
    # but simplest approach for now is to just regenerate thumbnails later or let thumb fetching fail or re-generate.
    # To keep it robust, we'll try to rename thumbnails for top-level files inside.
    
    for root, dirs, files in os.walk(source_dir):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
                old_file_rel_path = os.path.relpath(os.path.join(root, f), VIDEOGALLERY_UPLOADS).replace("\\", "/")
                
                # compute new relative path
                rel_to_source = os.path.relpath(os.path.join(root, f), source_dir)
                new_file_rel_path = os.path.join(target_folder if target_folder else "", folder_name, rel_to_source).replace("\\", "/")
                
                old_thumb_name = f"{hashlib.md5(old_file_rel_path.encode()).hexdigest()}.jpg"
                new_thumb_name = f"{hashlib.md5(new_file_rel_path.encode()).hexdigest()}.jpg"
                
                old_thumb_path = os.path.join(VIDEOGALLERY_UPLOADS, "thumbnails", old_thumb_name)
                new_thumb_path = os.path.join(VIDEOGALLERY_UPLOADS, "thumbnails", new_thumb_name)
                
                if os.path.exists(old_thumb_path):
                    os.rename(old_thumb_path, new_thumb_path)

    shutil.move(source_dir, target_final_dir)
    return {"status": "success"}

@router.post("/rename_folder")
def rename_video_folder(data: dict):
    folder_path = data.get("path")
    new_name = data.get("newName")
    
    if not folder_path or not new_name:
        raise HTTPException(status_code=400, detail="path and newName are required")
        
    source_dir = os.path.join(VIDEOGALLERY_UPLOADS, folder_path)
    if not os.path.exists(source_dir):
        raise HTTPException(status_code=404, detail="Folder not found")
        
    parent_dir = os.path.dirname(source_dir)
    target_dir = os.path.join(parent_dir, new_name)
    
    if os.path.exists(target_dir):
        raise HTTPException(status_code=400, detail="Destination folder already exists")
        
    target_folder = os.path.relpath(parent_dir, VIDEOGALLERY_UPLOADS)
    if target_folder == ".":
        target_folder = ""
        
    # Process thumbnails
    for root, dirs, files in os.walk(source_dir):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
                old_file_rel_path = os.path.relpath(os.path.join(root, f), VIDEOGALLERY_UPLOADS).replace("\\", "/")
                
                rel_to_source = os.path.relpath(os.path.join(root, f), source_dir)
                new_file_rel_path = os.path.join(target_folder if target_folder else "", new_name, rel_to_source).replace("\\", "/")
                
                old_thumb_name = f"{hashlib.md5(old_file_rel_path.encode()).hexdigest()}.jpg"
                new_thumb_name = f"{hashlib.md5(new_file_rel_path.encode()).hexdigest()}.jpg"
                
                old_thumb_path = os.path.join(VIDEOGALLERY_UPLOADS, "thumbnails", old_thumb_name)
                new_thumb_path = os.path.join(VIDEOGALLERY_UPLOADS, "thumbnails", new_thumb_name)
                
                if os.path.exists(old_thumb_path):
                    os.rename(old_thumb_path, new_thumb_path)
                    
    shutil.move(source_dir, target_dir)
    return {"status": "success"}
