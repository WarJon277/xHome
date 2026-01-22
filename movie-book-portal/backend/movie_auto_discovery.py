"""
Автоматическое добавление фильмов с kinorush.name
Отдельный скрипт для автоматизации фильмов
"""
import os
import time
import json
import random
import shutil
import uuid
from datetime import datetime
from sqlalchemy.orm import Session

# Import models and DB
from database import Movie, SessionLocal
from services.kinorush_service import search_films_page, get_movie_details, filter_by_size
from services.torrent_downloader import download_torrent, check_qbittorrent_connection
from services.video_converter import convert_to_mp4, check_ffmpeg_available

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SETTINGS_FILE = os.path.join(BASE_DIR, "movie_discovery_settings.json")
LOG_FILE = os.path.join(BASE_DIR, "movie_discovery.log")

def log(message):
    """Log message to file and console"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    msg = f"[{timestamp}] {message}"
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

def load_settings():
    """Load settings from JSON file"""
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        log(f"Error loading settings: {e}")
    
    # Defaults
    return {
        "interval_minutes": 720,  # 12 hours
        "enabled": True,
        "min_file_size_gb": 3.0,
        "min_rating": 6.0,
        "min_year": 2015,
        "qbt_host": "localhost",
        "qbt_port": 8080,
        "qbt_username": "admin",
        "qbt_password": "adminadmin"
    }

def download_file(url, target_path, referer=None, retries=3):
    """Download a file with retries"""
    import requests
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    for attempt in range(retries):
        try:
            if attempt > 0:
                time.sleep(random.uniform(2, 5))
            
            log(f"Downloading (Attempt {attempt+1}/{retries}) from {url}")
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            }
            if referer:
                headers['Referer'] = referer
            
            response = requests.get(url, stream=True, timeout=30, headers=headers, verify=False, allow_redirects=True)
            response.raise_for_status()
            
            with open(target_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=16384):
                    if chunk:
                        f.write(chunk)
            log(f"Successfully downloaded to {target_path}")
            return True
        except Exception as e:
            log(f"Attempt {attempt+1} failed: {e}")
            if attempt == retries - 1:
                return False
    return False

def process_movie():
    """Process one movie discovery cycle"""
    settings = load_settings()
    
    if not settings.get("enabled", True):
        log("Movie discovery is disabled in settings.")
        return False
    
    # Check FFmpeg
    if not check_ffmpeg_available():
        log("ERROR: FFmpeg is not available. Please install FFmpeg.")
        log("Download from: https://www.gyan.dev/ffmpeg/builds/")
        return False
    
    # Check qBittorrent
    qbt_params = {
        "qbt_host": settings.get("qbt_host", "localhost"),
        "qbt_port": settings.get("qbt_port", 8080),
        "qbt_username": settings.get("qbt_username", "admin"),
        "qbt_password": settings.get("qbt_password", "adminadmin")
    }
    
    if not check_qbittorrent_connection(**qbt_params):
        log("ERROR: qBittorrent is not running or not accessible.")
        log("Please start qBittorrent and enable Web UI (Tools → Options → Web UI)")
        log("Web UI should be accessible at: http://localhost:8080")
        return False
    
    min_file_size_gb = settings.get("min_file_size_gb", 3.0)
    min_rating = settings.get("min_rating", 6.0)
    min_year = settings.get("min_year", 2015)
    
    db: Session = SessionLocal()
    new_movie = None
    temp_torrent_dir = None
    
    try:
        log("Searching for movies on kinorush.name...")
        
        # Browse films page
        movies = search_films_page(page=random.randint(1, 5))
        
        if not movies:
            log("No movies found.")
            return False
        
        log(f"Found {len(movies)} movies, shuffling...")
        random.shuffle(movies)
        
        for movie_info in movies:
            try:
                # Get full details
                log(f"Checking: {movie_info.title}")
                details = get_movie_details(movie_info.url)
                
                if not details:
                    continue
                
                # Apply filters
                if details.year and details.year < min_year:
                    log(f"  ❌ Year {details.year} < {min_year}, skipping")
                    continue
                
                rating = details.rating_kp or details.rating_imdb or 0.0
                if rating < min_rating:
                    log(f"  ❌ Rating {rating} < {min_rating}, skipping")
                    continue
                
                # Filter torrents by size
                suitable_torrents = filter_by_size(details.torrents, min_file_size_gb)
                
                if not suitable_torrents:
                    log(f"  ❌ No torrents >= {min_file_size_gb}GB, skipping")
                    continue
                
                # Check for duplicates
                existing = db.query(Movie).filter(
                    Movie.title == details.title,
                    Movie.year == details.year
                ).first()
                
                if existing:
                    log(f"  ❌ Already exists in database, skipping")
                    continue
                
                # Found suitable movie!
                log(f"  ✅ FOUND: {details.title} ({details.year}) - Rating: {rating}")
                
                # Create movie record
                new_movie = Movie(
                    title=details.title,
                    year=details.year or 0,
                    director=details.director or "Unknown",
                    genre=details.genre or "Неизвестно",
                    rating=rating,
                    description=details.description or ""
                )
                db.add(new_movie)
                db.commit()
                db.refresh(new_movie)
                
                movie_id = new_movie.id
                MOVIE_UPLOADS = os.path.join(BASE_DIR, "uploads", "movies")
                os.makedirs(MOVIE_UPLOADS, exist_ok=True)
                
                # Download poster
                thumb_success = False
                if details.poster_url:
                    ext = os.path.splitext(details.poster_url.split('?')[0])[1] or ".jpg"
                    thumb_path = os.path.join(MOVIE_UPLOADS, f"{movie_id}_thumb{ext}")
                    if download_file(details.poster_url, thumb_path, referer=details.source_url):
                        new_movie.thumbnail_path = os.path.relpath(thumb_path, BASE_DIR).replace(os.sep, '/')
                        thumb_success = True
                        log(f"  📷 Downloaded poster")
                
                # Download torrent and convert
                torrent = suitable_torrents[0]
                log(f"  📥 Downloading torrent: {torrent.quality} - {torrent.size_gb:.2f}GB")
                
                temp_torrent_dir = os.path.join(BASE_DIR, "temp_torrents", f"movie_{movie_id}_{uuid.uuid4().hex[:8]}")
                os.makedirs(temp_torrent_dir, exist_ok=True)
                
                
                # Download torrent with qBittorrent settings
                result = download_torrent(
                    torrent.download_url,
                    temp_torrent_dir,
                    timeout=7200,
                    log_file=LOG_FILE,
                    referer=details.source_url,  # Pass movie page as referer
                    **qbt_params
                )
                
                # Unpack result
                if result and result[0]:
                    video_file, torrent_hash = result
                else:
                    video_file, torrent_hash = None, None
                
                if video_file and os.path.exists(video_file):
                    log(f"  ✅ Torrent download complete")
                    
                    # Convert to MP4
                    output_filename = f"{movie_id}_{details.title[:50].replace(' ', '_').replace('/', '_')}.mp4"
                    output_path = os.path.join(MOVIE_UPLOADS, output_filename)
                    
                    log(f"  🎬 Converting to MP4...")
                    
                    if convert_to_mp4(video_file, output_path, delete_source=False, log_file=LOG_FILE):
                        new_movie.file_path = os.path.relpath(output_path, BASE_DIR).replace(os.sep, '/')
                        log(f"  ✅ Conversion successful!")
                        
                        # Remove torrent from qBittorrent
                        if torrent_hash:
                            from services.torrent_downloader import remove_torrent
                            log(f"  🧹 Cleaning up torrent...")
                            remove_torrent(torrent_hash, log_file=LOG_FILE, **qbt_params)
                        
                        log(f"")
                        log(f"🎉 Successfully added movie: {details.title} ({details.year})")
                        log(f"")
                        
                        db.commit()
                        return True  # Success!
                    else:
                        log(f"  ❌ Failed to convert video")
                else:
                    log(f"  ❌ Failed to download torrent")
                
                # If we get here, download/conversion failed
                log(f"Failed to download/convert. Rolling back...")
                db.delete(new_movie)
                db.commit()
                
                # Cleanup temp files
                if thumb_success and new_movie.thumbnail_path:
                    try:
                        os.remove(os.path.join(BASE_DIR, new_movie.thumbnail_path))
                    except:
                        pass
                
                # Continue to next movie
                continue
                
            except Exception as e:
                log(f"Error processing movie {movie_info.url}: {e}")
                continue
        
        # If we get here, no suitable movie was found/added
        log("No suitable movie found in this cycle.")
        return False
        
    except Exception as e:
        log(f"Error in movie processing: {e}")
        if new_movie:
            try:
                db.delete(new_movie)
                db.commit()
            except:
                pass
        return False
    finally:
        if db:
            db.close()
        # Always cleanup temp directory, even on failure
        if temp_torrent_dir and os.path.exists(temp_torrent_dir):
            log(f"Cleaning up temp directory: {temp_torrent_dir}")
            # Wait a bit for file handles to be released (especially on Windows)
            time.sleep(2)
            
            # Try multiple times with increasing delays
            for attempt in range(3):
                try:
                    shutil.rmtree(temp_torrent_dir)
                    log(f"Successfully removed temp directory")
                    break
                except Exception as e:
                    if attempt < 2:
                        log(f"Cleanup attempt {attempt + 1} failed, retrying in {(attempt + 1) * 2}s...")
                        time.sleep((attempt + 1) * 2)
                    else:
                        log(f"Warning: Could not remove temp directory after 3 attempts: {e}")

def main_loop():
    """Main discovery loop"""
    log("="*60)
    log("Movie Auto-Discovery started")
    log("="*60)
    
    # Track last run times
    last_run = 0
    
    # Load initial settings to log
    settings = load_settings()
    log(f"Settings loaded:")
    log(f"  Interval: {settings.get('interval_minutes', 720)} minutes")
    
    while True:
        try:
            settings = load_settings()
            
            if not settings.get("enabled", True):
                log("Movie discovery is disabled. Sleeping for 10 minutes...")
                time.sleep(600)
                continue
            
            current_time = time.time()
            interval_seconds = settings.get("interval_minutes", 720) * 60
            
            # Check for forced run
            force_run = settings.get("force_run", False)
            
            if force_run or (current_time - last_run >= interval_seconds):
                if force_run:
                    log("⚠️ Force run triggered!")
                    # Reset flag
                    try:
                        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        data["force_run"] = False
                        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                            json.dump(data, f, indent=4, ensure_ascii=False)
                    except Exception as e:
                        log(f"Error resetting force_run flag: {e}")
                
                log("--- Starting new movie discovery cycle ---")
                success = process_movie()
                
                if success:
                    log("✅ Movie added successfully!")
                else:
                    log("❌ No movie added this cycle.")
                
                last_run = time.time()
                
                next_run_min = settings.get("interval_minutes", 720)
                log(f"Cycle completed. Next run in {next_run_min} minutes.")
                log("")
            
            # Sleep for shorter interval to check for force_run
            time.sleep(60)
            
        except KeyboardInterrupt:
            log("Stopping movie discovery (Ctrl+C pressed)")
            break
        except Exception as e:
            log(f"Error in main loop: {e}")
            log("Waiting 60 seconds before retry...")
            time.sleep(60)

if __name__ == "__main__":
    try:
        main_loop()
    except KeyboardInterrupt:
        log("\nMovie discovery stopped by user")
    except Exception as e:
        log(f"Fatal error: {e}")
