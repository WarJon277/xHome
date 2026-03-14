import os
import sys
import re
import sqlite3
import time
from datetime import datetime

# Add current directory to path to import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from database import Movie, SessionLocal
    from services.kinorush_service import search_movies_by_name, get_movie_details
except ImportError:
    print("Error: Could not import database or services. Make sure you are running this from the backend directory.")
    sys.exit(1)

# Directories to scan
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIRS = [
    os.path.join(BACKEND_DIR, "uploads", "movies"),
    os.path.join(os.path.dirname(BACKEND_DIR), "uploads", "movies")
]

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def clean_title(filename):
    """Extract clean title from filename"""
    # Remove extension
    name = os.path.splitext(filename)[0]
    
    # Remove ID prefix if it exists (e.g., "10_")
    name = re.sub(r'^\d+_', '', name)
    
    # Replace underscores and dots with spaces
    name = name.replace('_', ' ').replace('.', ' ')
    
    # Remove common tags
    tags = [
        '1080p', '720p', 'BDRip', 'WEBRip', 'WEB-DL', 'HDRip', 'x264', 'x265', 
        'HEVC', 'AAC', 'AC3', 'DTS', 'RUS', 'ENG', 'seleZen', 'ExKinoRay', 'OPUS'
    ]
    for tag in tags:
        name = re.sub(r'\b' + tag + r'\b', '', name, flags=re.IGNORECASE)
    
    # Remove year if present
    name = re.sub(r'\b(19|20)\d{2}\b', '', name)
    
    # Trim whitespace
    name = name.strip()
    return name

def restore_movies():
    db = SessionLocal()
    log("Starting movie database restoration...")
    
    processed_files = 0
    restored_count = 0
    errors_count = 0
    
    # Get existing movies to avoid duplicates
    existing_records = db.query(Movie).all()
    existing_paths = {m.file_path for m in existing_records if m.file_path}
    existing_titles = {(m.title, m.year) for m in existing_records}
    
    for upload_dir in UPLOADS_DIRS:
        if not os.path.exists(upload_dir):
            log(f"Directory not found: {upload_dir}")
            continue
            
        log(f"Scanning directory: {upload_dir}")
        for filename in os.listdir(upload_dir):
            if filename.lower().endswith(('.mp4', '.mkv', '.avi')) and not filename.endswith('_backup.mp4'):
                processed_files += 1
                full_path = os.path.join(upload_dir, filename)
                rel_path = os.path.relpath(full_path, BACKEND_DIR).replace(os.sep, '/')
                
                # Check if already in DB
                if rel_path in existing_paths:
                    log(f"  - Already exists: {filename}")
                    continue
                
                # Extract ID from filename if possible
                movie_id = None
                id_match = re.match(r'^(\d+)_', filename)
                if id_match:
                    movie_id = int(id_match.group(1))
                    # Check if ID already exists
                    existing_by_id = db.query(Movie).filter(Movie.id == movie_id).first()
                    if existing_by_id and existing_by_id.file_path:
                        log(f"  - ID {movie_id} already exists with file path: {existing_by_id.file_path}")
                        continue
                
                title_for_search = clean_title(filename)
                log(f"  * Processing: {filename} (Searching for: {title_for_search})")
                
                # Search on kinorush
                search_results = search_movies_by_name(title_for_search)
                if not search_results:
                    log(f"    ! No results found for '{title_for_search}'")
                    # Still create a basic record if files exist
                    new_movie = Movie(
                        title=title_for_search,
                        file_path=rel_path
                    )
                    if movie_id: new_movie.id = movie_id
                else:
                    # Pick first result and get details
                    movie_info = search_results[0]
                    details = get_movie_details(movie_info.url)
                    
                    if details:
                        # Find thumbnail in the same dir
                        thumb_name = f"{movie_id}_thumb.webp" if movie_id else f"{os.path.splitext(filename)[0]}_thumb.webp"
                        thumb_path = os.path.join(upload_dir, thumb_name)
                        rel_thumb = None
                        if os.path.exists(thumb_path):
                            rel_thumb = os.path.relpath(thumb_path, BACKEND_DIR).replace(os.sep, '/')
                        elif movie_id:
                            # Try just thumb.webp or other extensions
                            for ext in ['.webp', '.jpg', '.png']:
                                t = os.path.join(upload_dir, f"{movie_id}_thumb{ext}")
                                if os.path.exists(t):
                                    rel_thumb = os.path.relpath(t, BACKEND_DIR).replace(os.sep, '/')
                                    break

                        new_movie = Movie(
                            title=details.title or title_for_search,
                            year=details.year or 0,
                            director=details.director or "Unknown",
                            genre=details.genre or "Неизвестно",
                            rating=details.rating_kp or details.rating_imdb or 0.0,
                            description=details.description or "",
                            file_path=rel_path,
                            thumbnail_path=rel_thumb
                        )
                        if movie_id: new_movie.id = movie_id
                    else:
                        new_movie = Movie(
                            title=title_for_search,
                            file_path=rel_path
                        )
                        if movie_id: new_movie.id = movie_id
                
                # Validation: Only add if rating, description, and thumbnail are present
                if not new_movie.rating or new_movie.rating == 0:
                    log(f"    - Skipping: No rating found for '{new_movie.title}'")
                    continue
                if not new_movie.description or len(new_movie.description) < 10:
                    log(f"    - Skipping: Missing or too short description for '{new_movie.title}'")
                    continue
                if not new_movie.thumbnail_path:
                    log(f"    - Skipping: No local thumbnail found for '{new_movie.title}'")
                    continue

                try:
                    # Check if ID exists (could be if name search was redundant)
                    if movie_id:
                        existing = db.query(Movie).filter(Movie.id == movie_id).first()
                        if existing:
                            # Update existing record
                            existing.title = new_movie.title
                            existing.year = new_movie.year
                            existing.director = new_movie.director
                            existing.genre = new_movie.genre
                            existing.rating = new_movie.rating
                            existing.description = new_movie.description
                            existing.file_path = new_movie.file_path
                            existing.thumbnail_path = new_movie.thumbnail_path
                            log(f"    + Updated record with ID {movie_id}: {new_movie.title}")
                        else:
                            db.add(new_movie)
                            log(f"    + Added new record with ID {movie_id}: {new_movie.title}")
                    else:
                        db.add(new_movie)
                        log(f"    + Added new record: {new_movie.title}")
                    
                    db.commit()
                    restored_count += 1
                except Exception as e:
                    db.rollback()
                    log(f"    ! Error saving to DB: {e}")
                    errors_count += 1
                
                # Be nice to the server
                time.sleep(1)

    log("="*60)
    log(f"Restoration complete!")
    log(f"Processed files: {processed_files}")
    log(f"Restored/Updated records: {restored_count}")
    log(f"Errors: {errors_count}")
    log("="*60)
    db.close()

if __name__ == "__main__":
    restore_movies()
