import os
import time
import json
import random
import requests
import shutil
import uuid
from datetime import datetime
from sqlalchemy.orm import Session

# Import models and DB sessions
from database_books import Book, SessionLocalBooks
from database_audiobooks import Audiobook, SessionLocalAudiobooks
from routers.discovery import suggest_book, suggest_audiobook, GENRE_MAPPING
from utils import unzip_file, find_audio_files, find_thumbnail_in_dir

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SETTINGS_FILE = os.path.join(BASE_DIR, "auto_discovery_settings.json")
LOG_FILE = os.path.join(BASE_DIR, "auto_discovery.log")

def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    msg = f"[{timestamp}] {message}"
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

def load_settings():
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        log(f"Error loading settings: {e}")
    
    # Defaults if file missing or error
    return {
        "interval_minutes": 60,
        "enabled": True,
        "genre_priorities": {"Фантастика": 1}
    }

def get_weighted_genre(genre_priorities):
    genres = list(genre_priorities.keys())
    weights = list(genre_priorities.values())
    if not genres:
        return random.choice(list(GENRE_MAPPING.keys()))
    return random.choices(genres, weights=weights, k=1)[0]

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def download_file(url, target_path):
    try:
        log(f"Downloading from {url} to {target_path}")
        
        # Determine referer
        from urllib.parse import urlparse
        parsed = urlparse(url)
        referer = f"{parsed.scheme}://{parsed.netloc}/"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': referer,
            'Connection': 'keep-alive',
        }
        
        # Use session for better handling of redirects and persistent state
        session = requests.Session()
        session.trust_env = False # Ignore system proxies
        
        response = session.get(url, stream=True, timeout=60, headers=headers, verify=False, allow_redirects=True)
        response.raise_for_status()
        
        with open(target_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk: # filter out keep-alive new chunks
                    f.write(chunk)
        return True
    except Exception as e:
        log(f"Failed to download {url}: {e}")
        return False

def process_auto_book(genre_name):
    db: Session = SessionLocalBooks()
    try:
        log(f"Suggesting book for genre: {genre_name}")
        suggestion = suggest_book(genre_name)
        if not suggestion or suggestion.title == "Ничего не найдено":
            log("No book suggestion found.")
            return

        # Check for duplicates
        existing = db.query(Book).filter(Book.title == suggestion.title, Book.author == suggestion.author_director).first()
        if existing:
            log(f"Book '{suggestion.title}' by {suggestion.author_director} already exists.")
            return

        # Create record first to get ID
        new_book = Book(
            title=suggestion.title,
            author=suggestion.author_director,
            year=suggestion.year,
            genre=genre_name,
            description=suggestion.description,
            rating=suggestion.rating or 0.0,
            total_pages=1
        )
        db.add(new_book)
        db.commit()
        db.refresh(new_book)
        
        book_id = new_book.id
        
        # Download cover if exists
        if suggestion.image:
            ext = os.path.splitext(suggestion.image)[1] or ".jpg"
            if "?" in ext: ext = ext.split("?")[0]
            thumb_name = f"{book_id}_thumb{ext}"
            thumb_path = os.path.join(BASE_DIR, "uploads", "books", thumb_name)
            os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
            if download_file(suggestion.image, thumb_path):
                new_book.thumbnail_path = os.path.relpath(thumb_path, BASE_DIR).replace(os.sep, '/')
        
        # Download book file
        if suggestion.download_url:
            # Determine extension from URL
            ext = ".fb2" # Default
            url_lower = suggestion.download_url.lower()
            if ".epub" in url_lower or url_lower.endswith("/epub"): ext = ".epub"
            elif ".mobi" in url_lower or url_lower.endswith("/mobi"): ext = ".mobi"
            elif ".pdf" in url_lower or url_lower.endswith("/pdf"): ext = ".pdf"
            elif ".fb2" in url_lower or url_lower.endswith("/fb2"): ext = ".fb2"
            
            file_name = f"{book_id}_auto_added{ext}"
            file_path = os.path.join(BASE_DIR, "uploads", "books", file_name)
            if download_file(suggestion.download_url, file_path):
                new_book.file_path = os.path.relpath(file_path, BASE_DIR).replace(os.sep, '/')
                log(f"Successfully added book: {suggestion.title} (ext: {ext})")
            else:
                log(f"Failed to download book file for: {suggestion.title}")
        
        db.commit()
    except Exception as e:
        log(f"Error processing book: {e}")
    finally:
        db.close()

def process_auto_audiobook(genre_name):
    db: Session = SessionLocalAudiobooks()
    try:
        log(f"Suggesting audiobook for genre: {genre_name}")
        suggestion = suggest_audiobook(genre_name)
        if not suggestion or suggestion.title == "Ничего не найдено":
            log("No audiobook suggestion found.")
            return

        # Check for duplicates
        existing = db.query(Audiobook).filter(Audiobook.title == suggestion.title, Audiobook.author == suggestion.author_director).first()
        if existing:
            log(f"Audiobook '{suggestion.title}' by {suggestion.author_director} already exists.")
            return

        # Create record
        new_audio = Audiobook(
            title=suggestion.title,
            author=suggestion.author_director,
            genre=genre_name,
            description=suggestion.description,
            year=suggestion.year or datetime.now().year,
            rating=suggestion.rating or 0.0,
            source="auto_discovery"
        )
        db.add(new_audio)
        db.commit()
        db.refresh(new_audio)
        
        audio_id = new_audio.id
        AUDIO_UPLOADS = os.path.join(BASE_DIR, "uploads", "audiobooks")
        os.makedirs(AUDIO_UPLOADS, exist_ok=True)

        # Download thumbnail
        if suggestion.image:
            ext = os.path.splitext(suggestion.image.split('?')[0])[1] or ".jpg"
            thumb_path = os.path.join(AUDIO_UPLOADS, "thumbnails", f"thumb_{audio_id}{ext}")
            os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
            if download_file(suggestion.image, thumb_path):
                new_audio.thumbnail_path = os.path.relpath(thumb_path, BASE_DIR).replace(os.sep, '/')

        # Download file (usually ZIP or MP3)
        if suggestion.download_url:
            is_zip = ".zip" in suggestion.download_url.lower()
            ext = ".zip" if is_zip else ".mp3"
            
            if is_zip:
                temp_zip_path = os.path.join(AUDIO_UPLOADS, f"temp_{uuid.uuid4()}.zip")
                if download_file(suggestion.download_url, temp_zip_path):
                    book_dir_name = f"audiobook_{audio_id}_{new_audio.title[:30].replace(' ', '_')}"
                    book_dir_path = os.path.join(AUDIO_UPLOADS, book_dir_name)
                    
                    if unzip_file(temp_zip_path, book_dir_path):
                        audio_files = find_audio_files(book_dir_path)
                        if audio_files:
                            new_audio.file_path = os.path.relpath(audio_files[0], BASE_DIR).replace(os.sep, '/')
                            # Try to find thumbnail in zip if not downloaded yet
                            if not new_audio.thumbnail_path:
                                inner_thumb = find_thumbnail_in_dir(book_dir_path)
                                if inner_thumb:
                                    new_audio.thumbnail_path = os.path.relpath(inner_thumb, BASE_DIR).replace(os.sep, '/')
                            log(f"Successfully added multi-track audiobook: {new_audio.title}")
                        
                    try: os.remove(temp_zip_path)
                    except: pass
            else:
                safe_name = f"audiobook_{audio_id}_{new_audio.title[:30].replace(' ', '_')}{ext}"
                file_path = os.path.join(AUDIO_UPLOADS, safe_name)
                if download_file(suggestion.download_url, file_path):
                    new_audio.file_path = os.path.relpath(file_path, BASE_DIR).replace(os.sep, '/')
                    log(f"Successfully added single-file audiobook: {new_audio.title}")

        db.commit()
    except Exception as e:
        log(f"Error processing audiobook: {e}")
    finally:
        db.close()

def main_loop():
    log("Auto-discovery script started.")
    while True:
        settings = load_settings()
        if not settings.get("enabled", True):
            log("Auto-discovery is disabled in settings. Sleeping for 10 minutes.")
            time.sleep(600)
            continue
            
        try:
            genre = get_weighted_genre(settings.get("genre_priorities", {}))
            log(f"--- Starting new discovery cycle for genre: {genre} ---")
            
            process_auto_book(genre)
            process_auto_audiobook(genre)
            
            log(f"Cycle completed. Waiting for {settings.get('interval_minutes', 60)} minutes.")
        except Exception as e:
            log(f"Error in main loop: {e}")
            
        time.sleep(settings.get("interval_minutes", 60) * 60)

if __name__ == "__main__":
    main_loop()
