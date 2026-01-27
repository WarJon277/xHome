import os
import time
import json
from sqlalchemy.orm import Session
from database_books import Book, SessionLocalBooks
from routers.discovery import suggest_book, GENRE_MAPPING
from discovery_shared import log, load_settings, get_weighted_genre, download_file
from utils import get_epub_page_count

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "books_discovery.log")
SETTINGS_FILE = os.path.join(BASE_DIR, "auto_discovery_settings.json")

def log_book(msg):
    log(msg, LOG_FILE)

def process_auto_book(genre_name):
    max_attempts = 3
    for attempt in range(max_attempts):
        db: Session = SessionLocalBooks()
        new_book = None
        try:
            log_book(f"Attempt {attempt+1}/{max_attempts}: Suggesting book for genre: {genre_name}")
            suggestion = suggest_book(genre_name)
            if not suggestion or suggestion.title == "Ничего не найдено":
                log_book("No book suggestion found.")
                break

            # Check for duplicates
            existing = db.query(Book).filter(Book.title == suggestion.title, Book.author == suggestion.author_director).first()
            if existing:
                log_book(f"Book '{suggestion.title}' by {suggestion.author_director} already exists. Trying another...")
                db.close()
                continue

            # NEW: Validate page count (min 10)
            pages = suggestion.pages if suggestion.pages is not None else 0
            if pages < 10:
                log_book(f"Skipping '{suggestion.title}': too short ({pages} pages). Min: 10.")
                db.close()
                continue
            
            # NEW: Validate EPUB availability
            if not suggestion.download_url:
                log_book(f"Skipping '{suggestion.title}': no EPUB download link available.")
                db.close()
                continue

            # NEW: Mandatory cover image check
            if not suggestion.image:
                log_book(f"Skipping '{suggestion.title}': no cover image available.")
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
                total_pages=pages
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
                if download_file(suggestion.image, thumb_path, log_book, referer=suggestion.source_url):
                    new_book.thumbnail_path = os.path.relpath(thumb_path, BASE_DIR).replace(os.sep, '/')
                    thumb_success = True
            
            # NEW: Second check for mandatory cover success
            if not thumb_success:
                log_book(f"Skipping '{suggestion.title}': failed to download cover image.")
                db.delete(new_book)
                db.commit()
                db.close()
                continue

            # Download book file
            file_success = False
            if suggestion.download_url:
                # Determine extension from URL (EPUB preferred)
                ext = ".epub" 
                url_lower = suggestion.download_url.lower()
                if ".epub" in url_lower or url_lower.endswith("/epub"): ext = ".epub"
                elif ".mobi" in url_lower or url_lower.endswith("/mobi"): ext = ".mobi"
                elif ".pdf" in url_lower or url_lower.endswith("/pdf"): ext = ".pdf"
                elif ".fb2" in url_lower or url_lower.endswith("/fb2"): ext = ".fb2"
                
                file_name = f"{book_id}_auto_added{ext}"
                file_path = os.path.join(BASE_DIR, "uploads", "books", file_name)
                if download_file(suggestion.download_url, file_path, log_book, referer=suggestion.source_url):
                    new_book.file_path = os.path.relpath(file_path, BASE_DIR).replace(os.sep, '/')
                    file_success = True
                    
                    # Update page count from file
                    try:
                        new_book.total_pages = get_epub_page_count(file_path)
                    except Exception as e:
                        log_book(f"Error counting pages: {e}")
                    
                    log_book(f"Successfully added book: {suggestion.title} (ext: {ext})")

            if not file_success:
                log_book(f"Failed to download book file for: {suggestion.title}. Rolling back record.")
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
            log_book(f"Error processing book (attempt {attempt+1}): {e}")
            if new_book:
                try:
                    db.delete(new_book)
                    db.commit()
                except: pass
        finally:
            if db: db.close()
    
    log_book(f"Failed to add any book for genre {genre_name} after {max_attempts} attempts.")

def main_loop():
    log_book("Book discovery script started.")
    last_book_run = 0
    
    while True:
        settings = load_settings()
        if not settings.get("enabled", True):
            log_book("Auto-discovery is disabled in settings. Sleeping for 10 minutes.")
            time.sleep(600)
            continue
        
        current_time = time.time()
        
        # Get interval
        book_interval = settings.get("book_interval_minutes", settings.get("interval_minutes", 60)) * 60
        
        force_books = settings.get("force_run_books", False)
        if force_books or (current_time - last_book_run >= book_interval):
            if force_books:
                log_book("⚠️ Force run triggered for Books!")
                # Reset flag
                try:
                    with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    data["force_run_books"] = False
                    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=4, ensure_ascii=False)
                except Exception as e:
                    log_book(f"Error resetting force_run_books flag: {e}")

            try:
                genre = get_weighted_genre(settings.get("genre_priorities", {}), GENRE_MAPPING)
                log_book(f"--- Starting book discovery cycle for genre: {genre} ---")
                process_auto_book(genre)
                last_book_run = time.time()
                log_book(f"Book cycle completed. Next book in {settings.get('book_interval_minutes', settings.get('interval_minutes', 60))} minutes.")
            except Exception as e:
                log_book(f"Error in book processing: {e}")
        
        time.sleep(10) # Check every 10 seconds

if __name__ == "__main__":
    main_loop()
