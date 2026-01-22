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
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def download_file(url, target_path, referer=None, retries=3):
    """Download a file with retries and robustness"""
    for attempt in range(retries):
        try:
            if attempt > 0:
                time.sleep(random.uniform(2, 5))
            
            log(f"Downloading (Attempt {attempt+1}/{retries}) from {url}")
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Connection': 'keep-alive',
            }
            if referer:
                headers['Referer'] = referer
            else:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                headers['Referer'] = f"{parsed.scheme}://{parsed.netloc}/"
            
            session = requests.Session()
            session.trust_env = False
            
            # Use False for first attempt, maybe True for others if SSL fails?
            verify_ssl = False
            
            response = session.get(url, stream=True, timeout=30, headers=headers, verify=verify_ssl, allow_redirects=True)
            
            if response.status_code == 403:
                log(f"403 Forbidden on {url}. Site might be blocking automated downloads.")
                # Try without referer if it failed
                if referer and attempt == 0:
                    log("Retrying without referer...")
                    continue
                if attempt == retries - 1: return False
                continue

            response.raise_for_status()
            
            with open(target_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=16384):
                    if chunk:
                        f.write(chunk)
            log(f"Successfully downloaded to {target_path}")
            return True
        except Exception as e:
            log(f"Attempt {attempt+1} failed for {url}: {e}")
            if "SSL" in str(e) or "EOF" in str(e):
                 log("SSL error detected, will retry with different settings.")
            if attempt == retries - 1:
                return False
    return False

def process_auto_book(genre_name):
    max_attempts = 3
    for attempt in range(max_attempts):
        db: Session = SessionLocalBooks()
        new_book = None
        try:
            log(f"Attempt {attempt+1}/{max_attempts}: Suggesting book for genre: {genre_name}")
            suggestion = suggest_book(genre_name)
            if not suggestion or suggestion.title == "Ничего не найдено":
                log("No book suggestion found.")
                break

            # Check for duplicates
            existing = db.query(Book).filter(Book.title == suggestion.title, Book.author == suggestion.author_director).first()
            if existing:
                log(f"Book '{suggestion.title}' by {suggestion.author_director} already exists. Trying another...")
                db.close()
                continue

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
            thumb_success = False
            if suggestion.image:
                ext = os.path.splitext(suggestion.image.split('?')[0])[1] or ".jpg"
                thumb_name = f"{book_id}_thumb{ext}"
                thumb_path = os.path.join(BASE_DIR, "uploads", "books", thumb_name)
                os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
                if download_file(suggestion.image, thumb_path, referer=suggestion.source_url):
                    new_book.thumbnail_path = os.path.relpath(thumb_path, BASE_DIR).replace(os.sep, '/')
                    thumb_success = True
            
            # Download book file
            file_success = False
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
                if download_file(suggestion.download_url, file_path, referer=suggestion.source_url):
                    new_book.file_path = os.path.relpath(file_path, BASE_DIR).replace(os.sep, '/')
                    file_success = True
                    log(f"Successfully added book: {suggestion.title} (ext: {ext})")

            if not file_success:
                log(f"Failed to download book file for: {suggestion.title}. Rolling back record.")
                db.delete(new_book)
                db.commit()
                # Clean up thumbnail if it was downloaded
                if thumb_success and new_book.thumbnail_path:
                    try: os.remove(os.path.join(BASE_DIR, new_book.thumbnail_path))
                    except: pass
                db.close()
                continue # Try next attempt

            db.commit()
            return # Success!
        except Exception as e:
            log(f"Error processing book (attempt {attempt+1}): {e}")
            if new_book:
                try:
                    db.delete(new_book)
                    db.commit()
                except: pass
        finally:
            if db: db.close()
    
    log(f"Failed to add any book for genre {genre_name} after {max_attempts} attempts.")


def process_auto_audiobook(genre_name):
    max_attempts = 3
    for attempt in range(max_attempts):
        db: Session = SessionLocalAudiobooks()
        new_audio = None
        try:
            log(f"Attempt {attempt+1}/{max_attempts}: Suggesting audiobook for genre: {genre_name}")
            suggestion = suggest_audiobook(genre_name)
            if not suggestion or suggestion.title == "Ничего не найдено":
                log("No audiobook suggestion found.")
                break

            # Check for duplicates
            existing = db.query(Audiobook).filter(Audiobook.title == suggestion.title, Audiobook.author == suggestion.author_director).first()
            if existing:
                log(f"Audiobook '{suggestion.title}' by {suggestion.author_director} already exists. Trying another...")
                db.close()
                continue

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
            thumb_success = False
            if suggestion.image:
                ext = os.path.splitext(suggestion.image.split('?')[0])[1] or ".jpg"
                thumb_path = os.path.join(AUDIO_UPLOADS, "thumbnails", f"thumb_{audio_id}{ext}")
                os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
                if download_file(suggestion.image, thumb_path, referer=suggestion.source_url):
                    new_audio.thumbnail_path = os.path.relpath(thumb_path, BASE_DIR).replace(os.sep, '/')
                    thumb_success = True

            # Download file (usually ZIP or MP3)
            file_success = False
            if suggestion.download_url:
                is_zip = ".zip" in suggestion.download_url.lower()
                ext = ".zip" if is_zip else ".mp3"
                
                if is_zip:
                    temp_zip_path = os.path.join(AUDIO_UPLOADS, f"temp_{uuid.uuid4()}.zip")
                    if download_file(suggestion.download_url, temp_zip_path, referer=suggestion.source_url):
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
                                file_success = True
                                log(f"Successfully added multi-track audiobook: {new_audio.title}")
                            
                        try: os.remove(temp_zip_path)
                        except: pass
                else:
                    safe_name = f"audiobook_{audio_id}_{new_audio.title[:30].replace(' ', '_')}{ext}"
                    file_path = os.path.join(AUDIO_UPLOADS, safe_name)
                    if download_file(suggestion.download_url, file_path, referer=suggestion.source_url):
                        new_audio.file_path = os.path.relpath(file_path, BASE_DIR).replace(os.sep, '/')
                        file_success = True
                        log(f"Successfully added single-file audiobook: {new_audio.title}")

            if not file_success:
                log(f"Failed to download audiobook file for: {suggestion.title}. Rolling back record.")
                db.delete(new_audio)
                db.commit()
                # Clean up thumbnail if it was downloaded
                if thumb_success and new_audio.thumbnail_path:
                    try: os.remove(os.path.join(BASE_DIR, new_audio.thumbnail_path))
                    except: pass
                db.close()
                continue # Try next attempt

            db.commit()
            return # Success!
        except Exception as e:
            log(f"Error processing audiobook (attempt {attempt+1}): {e}")
            if new_audio:
                try:
                    db.delete(new_audio)
                    db.commit()
                except: pass
        finally:
            if db: db.close()

    log(f"Failed to add any audiobook for genre {genre_name} after {max_attempts} attempts.")


def main_loop():
    log("Auto-discovery script started.")
    
    # Track last run times
    last_book_run = 0
    last_audiobook_run = 0
    
    while True:
        settings = load_settings()
        if not settings.get("enabled", True):
            log("Auto-discovery is disabled in settings. Sleeping for 10 minutes.")
            time.sleep(600)
            continue
        
        current_time = time.time()
        
        # Get intervals (in seconds)
        book_interval = settings.get("book_interval_minutes", settings.get("interval_minutes", 60)) * 60
        audiobook_interval = settings.get("audiobook_interval_minutes", settings.get("interval_minutes", 60)) * 60
        
        # Check if it's time to process books
        force_books = settings.get("force_run_books", False)
        if force_books or (current_time - last_book_run >= book_interval):
            if force_books:
                log("⚠️ Force run triggered for Books!")
                # Reset flag
                try:
                    with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    data["force_run_books"] = False
                    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=4, ensure_ascii=False)
                except Exception as e:
                    log(f"Error resetting force_run_books flag: {e}")

            try:
                genre = get_weighted_genre(settings.get("genre_priorities", {}))
                log(f"--- Starting book discovery cycle for genre: {genre} ---")
                process_auto_book(genre)
                last_book_run = time.time()
                log(f"Book cycle completed. Next book in {settings.get('book_interval_minutes', settings.get('interval_minutes', 60))} minutes.")
            except Exception as e:
                log(f"Error in book processing: {e}")
        
        # Check if it's time to process audiobooks
        force_audio = settings.get("force_run_audiobooks", False)
        if force_audio or (current_time - last_audiobook_run >= audiobook_interval):
            if force_audio:
                log("⚠️ Force run triggered for Audiobooks!")
                # Reset flag
                try:
                    with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    data["force_run_audiobooks"] = False
                    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=4, ensure_ascii=False)
                except Exception as e:
                    log(f"Error resetting force_run_audiobooks flag: {e}")

            try:
                genre = get_weighted_genre(settings.get("genre_priorities", {}))
                log(f"--- Starting audiobook discovery cycle for genre: {genre} ---")
                process_auto_audiobook(genre)
                last_audiobook_run = time.time()
                log(f"Audiobook cycle completed. Next audiobook in {settings.get('audiobook_interval_minutes', settings.get('interval_minutes', 60))} minutes.")
            except Exception as e:
                log(f"Error in audiobook processing: {e}")
        
        # Sleep for a short time before checking again (1 minute)
        time.sleep(60)

if __name__ == "__main__":
    main_loop()
