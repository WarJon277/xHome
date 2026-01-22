import os
import time
import json
import uuid
import shutil
from sqlalchemy.orm import Session
from database_audiobooks import Audiobook, SessionLocalAudiobooks
from routers.discovery import suggest_audiobook, GENRE_MAPPING
from utils import unzip_file, find_audio_files, find_thumbnail_in_dir
from discovery_shared import log, load_settings, get_weighted_genre, download_file

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "audiobooks_discovery.log")
SETTINGS_FILE = os.path.join(BASE_DIR, "auto_discovery_settings.json")

def log_audio(msg):
    log(msg, LOG_FILE)

def process_auto_audiobook(genre_name):
    max_attempts = 3
    for attempt in range(max_attempts):
        db: Session = SessionLocalAudiobooks()
        new_audio = None
        try:
            log_audio(f"Attempt {attempt+1}/{max_attempts}: Suggesting audiobook for genre: {genre_name}")
            suggestion = suggest_audiobook(genre_name)
            if not suggestion or suggestion.title == "Ничего не найдено":
                log_audio("No audiobook suggestion found.")
                break

            # Check for duplicates
            existing = db.query(Audiobook).filter(Audiobook.title == suggestion.title, Audiobook.author == suggestion.author_director).first()
            if existing:
                log_audio(f"Audiobook '{suggestion.title}' by {suggestion.author_director} already exists. Trying another...")
                db.close()
                continue

            # Create record
            new_audio = Audiobook(
                title=suggestion.title,
                author=suggestion.author_director,
                genre=genre_name,
                description=suggestion.description,
                year=suggestion.year or 2024,
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
                if download_file(suggestion.image, thumb_path, log_audio, referer=suggestion.source_url):
                    new_audio.thumbnail_path = os.path.relpath(thumb_path, BASE_DIR).replace(os.sep, '/')
                    thumb_success = True

            # Download file (usually ZIP or MP3)
            file_success = False
            if suggestion.download_url:
                is_zip = ".zip" in suggestion.download_url.lower()
                ext = ".zip" if is_zip else ".mp3"
                
                if is_zip:
                    temp_zip_path = os.path.join(AUDIO_UPLOADS, f"temp_{uuid.uuid4()}.zip")
                    if download_file(suggestion.download_url, temp_zip_path, log_audio, referer=suggestion.source_url):
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
                                log_audio(f"Successfully added multi-track audiobook: {new_audio.title}")
                            
                        try: os.remove(temp_zip_path)
                        except: pass
                else:
                    safe_name = f"audiobook_{audio_id}_{new_audio.title[:30].replace(' ', '_')}{ext}"
                    file_path = os.path.join(AUDIO_UPLOADS, safe_name)
                    if download_file(suggestion.download_url, file_path, log_audio, referer=suggestion.source_url):
                        new_audio.file_path = os.path.relpath(file_path, BASE_DIR).replace(os.sep, '/')
                        file_success = True
                        log_audio(f"Successfully added single-file audiobook: {new_audio.title}")

            if not file_success:
                log_audio(f"Failed to download audiobook file for: {suggestion.title}. Rolling back record.")
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
            log_audio(f"Error processing audiobook (attempt {attempt+1}): {e}")
            if new_audio:
                try:
                    db.delete(new_audio)
                    db.commit()
                except: pass
        finally:
            if db: db.close()

    log_audio(f"Failed to add any audiobook for genre {genre_name} after {max_attempts} attempts.")

def main_loop():
    log_audio("Audiobook discovery script started.")
    last_audiobook_run = 0
    
    while True:
        settings = load_settings()
        if not settings.get("enabled", True):
            log_audio("Auto-discovery is disabled in settings. Sleeping for 10 minutes.")
            time.sleep(600)
            continue
        
        current_time = time.time()
        
        # Get interval
        audiobook_interval = settings.get("audiobook_interval_minutes", settings.get("interval_minutes", 60)) * 60
        
        force_audio = settings.get("force_run_audiobooks", False)
        if force_audio or (current_time - last_audiobook_run >= audiobook_interval):
            if force_audio:
                log_audio("⚠️ Force run triggered for Audiobooks!")
                # Reset flag
                try:
                    with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    data["force_run_audiobooks"] = False
                    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=4, ensure_ascii=False)
                except Exception as e:
                    log_audio(f"Error resetting force_run_audiobooks flag: {e}")

            try:
                genre = get_weighted_genre(settings.get("genre_priorities", {}), GENRE_MAPPING)
                log_audio(f"--- Starting audiobook discovery cycle for genre: {genre} ---")
                process_auto_audiobook(genre)
                last_audiobook_run = time.time()
                log_audio(f"Audiobook cycle completed. Next audiobook in {settings.get('audiobook_interval_minutes', settings.get('interval_minutes', 60))} minutes.")
            except Exception as e:
                log_audio(f"Error in audiobook processing: {e}")
        
        time.sleep(10) # Check every 10 seconds

if __name__ == "__main__":
    main_loop()
