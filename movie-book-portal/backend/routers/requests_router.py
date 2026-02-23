"""
Requests Router — unified search and download API for the "Предложка" page.
Aggregates search across books (Flibusta), movies (KinoRush), and audiobooks (Audioboo).
"""
import os
import re
import shutil
import uuid
import time
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

router = APIRouter(prefix="/requests", tags=["requests"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---- Active downloads tracking ----
active_downloads = {}  # id -> { type, title, status, progress, error, started_at }


def _update_download(download_id: str, **kwargs):
    if download_id in active_downloads:
        active_downloads[download_id].update(kwargs)


# ---- Search endpoints ----

@router.get("/search")
async def search_content(query: str, type: str = "all"):
    """
    Search content across sources.
    type: all | books | movies | audiobooks
    """
    results = []

    if type in ("all", "books"):
        results.extend(_search_books(query))

    if type in ("all", "movies"):
        results.extend(_search_movies(query))

    if type in ("all", "audiobooks"):
        results.extend(_search_audiobooks(query))

    return results


def _search_books(query: str):
    """Search books on Flibusta via existing discovery module"""
    try:
        from routers.discovery import search_flibusta, PROVIDERS

        base_url = PROVIDERS.get("flibusta", "http://flibusta.is")
        items = search_flibusta(query, base_url, limit=15)

        results = []
        for item in items:
            results.append({
                "id": item.get("id", ""),
                "type": "book",
                "title": item.get("title", ""),
                "author": item.get("author", ""),
                "year": item.get("year"),
                "rating": item.get("rating"),
                "description": item.get("description", ""),
                "image": item.get("image", ""),
                "source_url": item.get("source_url", ""),
                "download_url": item.get("download_url", ""),
                "source": "flibusta"
            })
        return results
    except Exception as e:
        print(f"[Requests] Book search error: {e}")
        return []


def _search_movies(query: str):
    """Search movies on KinoRush"""
    try:
        from services.kinorush_service import search_movies_by_name

        movies = search_movies_by_name(query, limit=10)

        results = []
        for m in movies:
            results.append({
                "id": m.url,
                "type": "movie",
                "title": m.title,
                "author": "",
                "year": m.year,
                "rating": m.rating,
                "description": "",
                "image": "",
                "source_url": m.url,
                "download_url": "",
                "source": "kinorush"
            })
        return results
    except Exception as e:
        print(f"[Requests] Movie search error: {e}")
        return []


def _search_audiobooks(query: str):
    """Search audiobooks on Audioboo"""
    try:
        # search_audioboo is a FastAPI route handler but can be called directly
        from routers.audiobooks_source import search_audioboo

        items = search_audioboo(q=query)

        results = []
        for item in items:
            results.append({
                "id": item.get("link", ""),
                "type": "audiobook",
                "title": item.get("title", ""),
                "author": item.get("author", ""),
                "year": item.get("year"),
                "rating": item.get("rating"),
                "description": item.get("description", ""),
                "image": item.get("image", ""),
                "source_url": item.get("link", ""),
                "download_url": "",
                "source": "audioboo"
            })
        return results
    except Exception as e:
        print(f"[Requests] Audiobook search error: {e}")
        return []


# ---- Details endpoint ----

@router.get("/details")
async def get_content_details(id: str, type: str):
    """Get full details for a content item"""
    if type == "movie":
        try:
            from services.kinorush_service import get_movie_details
            details = get_movie_details(id)
            if details:
                torrents = []
                for t in details.torrents:
                    torrents.append({
                        "quality": t.quality,
                        "translation": t.translation,
                        "size_gb": t.size_gb,
                        "download_url": t.download_url
                    })
                return {
                    "title": details.title,
                    "year": details.year,
                    "director": details.director,
                    "genre": details.genre,
                    "rating": details.rating_kp or details.rating_imdb,
                    "description": details.description,
                    "image": details.poster_url,
                    "torrents": torrents,
                    "source_url": details.source_url
                }
        except Exception as e:
            print(f"[Requests] Movie details error: {e}")
        return None

    elif type == "book":
        try:
            from routers.discovery import scrape_book_details, PROVIDERS
            base_url = PROVIDERS.get("flibusta", "http://flibusta.is")
            details = scrape_book_details(id, base_url)
            if details:
                return {
                    "title": details.title,
                    "author": details.author_director,
                    "year": details.year,
                    "description": details.description,
                    "image": details.image,
                    "download_url": details.download_url,
                    "source_url": details.source_url,
                    "pages": details.pages
                }
        except Exception as e:
            print(f"[Requests] Book details error: {e}")
        return None

    elif type == "audiobook":
        try:
            from routers.audiobooks_source import fetch_audioboo_details
            details = fetch_audioboo_details(url=id)
            return details
        except Exception as e:
            print(f"[Requests] Audiobook details error: {e}")
        return None

    return None


# ---- Download endpoint ----

class DownloadRequest(BaseModel):
    type: str  # book | movie | audiobook
    id: str
    title: str
    author: Optional[str] = None
    year: Optional[int] = None
    genre: Optional[str] = None
    rating: Optional[float] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    download_url: Optional[str] = None
    source_url: Optional[str] = None
    # Movie-specific
    director: Optional[str] = None
    torrent_url: Optional[str] = None
    # Audiobook-specific
    narrator: Optional[str] = None


@router.post("/download")
async def download_content(req: DownloadRequest, background_tasks: BackgroundTasks):
    """Start downloading content in the background"""
    download_id = str(uuid.uuid4())[:8]

    active_downloads[download_id] = {
        "id": download_id,
        "type": req.type,
        "title": req.title,
        "status": "starting",
        "progress": 0,
        "error": None,
        "started_at": datetime.now().isoformat()
    }

    if req.type == "book":
        background_tasks.add_task(_download_book, download_id, req)
    elif req.type == "movie":
        background_tasks.add_task(_download_movie, download_id, req)
    elif req.type == "audiobook":
        background_tasks.add_task(_download_audiobook, download_id, req)
    else:
        active_downloads[download_id]["status"] = "error"
        active_downloads[download_id]["error"] = f"Unknown type: {req.type}"

    return {"download_id": download_id, "status": "started"}


def _download_book(download_id: str, req: DownloadRequest):
    """Download a book from Flibusta"""
    try:
        _update_download(download_id, status="downloading", progress=10)

        from routers.discovery import create_session, get_headers, PROVIDERS

        base_url = PROVIDERS.get("flibusta", "http://flibusta.is")

        # Determine download URL
        download_url = req.download_url
        if not download_url and req.id:
            download_url = f"{base_url}/b/{req.id}/epub"

        if not download_url:
            _update_download(download_id, status="error", error="Нет ссылки для скачивания")
            return

        _update_download(download_id, status="downloading", progress=30)

        # Download file via proxy
        session = create_session()
        headers = get_headers(referer=base_url)
        resp = session.get(download_url, headers=headers, timeout=60, stream=True)
        resp.raise_for_status()

        _update_download(download_id, progress=60)

        # Determine content
        content_type = resp.headers.get('content-type', '')
        ext = '.epub'

        # Check for zip
        if content_type.startswith('application/zip') or 'zip' in download_url:
            import zipfile
            import io
            z = zipfile.ZipFile(io.BytesIO(resp.content))
            epub_files = [n for n in z.namelist() if n.endswith('.epub')]
            fb2_files = [n for n in z.namelist() if n.endswith('.fb2')]

            if epub_files:
                file_content = z.read(epub_files[0])
                ext = '.epub'
            elif fb2_files:
                file_content = z.read(fb2_files[0])
                ext = '.fb2'
            else:
                for name in z.namelist():
                    if not name.endswith('/'):
                        file_content = z.read(name)
                        break
                else:
                    _update_download(download_id, status="error", error="Пустой архив")
                    return
        else:
            file_content = resp.content

        # Create book record
        from database_books import SessionLocalBooks as BooksSession, Book as BooksBook
        db = BooksSession()
        try:
            new_book = BooksBook(
                title=req.title,
                author=req.author or "Неизвестен",
                year=req.year or 0,
                genre=req.genre or "Общее",
                rating=req.rating or 0.0,
                description=req.description or ""
            )
            db.add(new_book)
            db.commit()
            db.refresh(new_book)
            book_id = new_book.id

            BOOK_UPLOADS = os.path.join(BASE_DIR, "uploads", "books")
            os.makedirs(BOOK_UPLOADS, exist_ok=True)

            safe_title = re.sub(r'[^\w\s-]', '', req.title)[:50].strip()
            filename = f"{book_id}_{safe_title}{ext}"
            filepath = os.path.join(BOOK_UPLOADS, filename)

            with open(filepath, "wb") as f:
                f.write(file_content)

            rel_path = os.path.relpath(filepath, BASE_DIR).replace(os.sep, '/')
            new_book.file_path = rel_path

            _update_download(download_id, progress=80)

            # Download cover
            if req.image_url:
                try:
                    img_resp = session.get(req.image_url, headers=headers, timeout=15)
                    if img_resp.ok:
                        img_ext = '.jpg'
                        ct = img_resp.headers.get('content-type', '')
                        if 'png' in ct:
                            img_ext = '.png'
                        elif 'webp' in ct:
                            img_ext = '.webp'
                        thumb_path = os.path.join(BOOK_UPLOADS, f"{book_id}_thumb{img_ext}")
                        with open(thumb_path, "wb") as f:
                            f.write(img_resp.content)
                        new_book.thumbnail_path = os.path.relpath(thumb_path, BASE_DIR).replace(os.sep, '/')
                except Exception as img_err:
                    print(f"[Requests] Cover download failed: {img_err}")

            db.commit()
            _update_download(download_id, status="completed", progress=100)

        except Exception as db_err:
            db.rollback()
            raise db_err
        finally:
            db.close()

    except Exception as e:
        print(f"[Requests] Book download error: {e}")
        _update_download(download_id, status="error", error=str(e))


def _download_movie(download_id: str, req: DownloadRequest):
    """Download a movie via torrent"""
    try:
        from services.kinorush_service import get_movie_details, filter_by_size
        from services.torrent_downloader import download_torrent, check_qbittorrent_connection, remove_torrent
        from services.video_converter import convert_to_mp4, check_ffmpeg_available
        from database import Movie, SessionLocal
        import json

        _update_download(download_id, status="checking", progress=5)

        # Load qBittorrent settings
        settings_file = os.path.join(BASE_DIR, "movie_discovery_settings.json")
        qbt_params = {
            "qbt_host": "localhost",
            "qbt_port": 8080,
            "qbt_username": "admin",
            "qbt_password": "adminadmin"
        }
        try:
            if os.path.exists(settings_file):
                with open(settings_file, "r") as f:
                    settings = json.load(f)
                for k in qbt_params:
                    if k in settings:
                        qbt_params[k] = settings[k]
        except Exception:
            pass

        if not check_ffmpeg_available():
            _update_download(download_id, status="error", error="FFmpeg не установлен")
            return

        if not check_qbittorrent_connection(**qbt_params):
            _update_download(download_id, status="error", error="qBittorrent не запущен")
            return

        # Get movie details if need torrent
        torrent_url = req.torrent_url
        source_url = req.source_url or req.id

        if not torrent_url:
            _update_download(download_id, status="fetching_details", progress=10)
            details = get_movie_details(source_url)
            if not details:
                _update_download(download_id, status="error", error="Не удалось получить данные о фильме")
                return

            suitable = filter_by_size(details.torrents, 1.0)
            if not suitable:
                suitable = details.torrents
            if not suitable:
                _update_download(download_id, status="error", error="Торренты не найдены")
                return

            torrent_url = suitable[0].download_url
            if not req.director:
                req.director = details.director
            if not req.genre:
                req.genre = details.genre
            if not req.description:
                req.description = details.description
            if not req.rating:
                req.rating = details.rating_kp or details.rating_imdb
            if not req.year:
                req.year = details.year
            if not req.image_url:
                req.image_url = details.poster_url

        # Create DB record
        db = SessionLocal()
        try:
            movie = Movie(
                title=req.title,
                year=req.year or 0,
                director=req.director or "Неизвестен",
                genre=req.genre or "Неизвестно",
                rating=req.rating or 0.0,
                description=req.description or ""
            )
            db.add(movie)
            db.commit()
            db.refresh(movie)
            movie_id = movie.id

            MOVIE_UPLOADS = os.path.join(BASE_DIR, "uploads", "movies")
            os.makedirs(MOVIE_UPLOADS, exist_ok=True)

            # Poster
            if req.image_url:
                try:
                    import requests as http_requests
                    img_resp = http_requests.get(req.image_url, timeout=15, verify=False,
                                                  headers={'User-Agent': 'Mozilla/5.0'})
                    if img_resp.ok:
                        img_ext = os.path.splitext(req.image_url.split('?')[0])[1] or ".jpg"
                        thumb_path = os.path.join(MOVIE_UPLOADS, f"{movie_id}_thumb{img_ext}")
                        with open(thumb_path, "wb") as f:
                            f.write(img_resp.content)
                        movie.thumbnail_path = os.path.relpath(thumb_path, BASE_DIR).replace(os.sep, '/')
                        db.commit()
                except Exception as img_err:
                    print(f"[Requests] Poster download failed: {img_err}")

            _update_download(download_id, status="downloading_torrent", progress=20)

            temp_dir = os.path.join(BASE_DIR, "temp_torrents", f"req_{movie_id}_{uuid.uuid4().hex[:8]}")
            os.makedirs(temp_dir, exist_ok=True)

            result = download_torrent(
                torrent_url,
                temp_dir,
                timeout=7200,
                referer=source_url,
                **qbt_params
            )

            if result and result[0]:
                video_file, torrent_hash = result
            else:
                video_file, torrent_hash = None, None

            if video_file and os.path.exists(video_file):
                _update_download(download_id, status="converting", progress=70)

                safe_title = re.sub(r'[^\w\s-]', '', req.title)[:50].strip()
                output_filename = f"{movie_id}_{safe_title}.mp4"
                output_path = os.path.join(MOVIE_UPLOADS, output_filename)

                if convert_to_mp4(video_file, output_path, delete_source=False):
                    movie.file_path = os.path.relpath(output_path, BASE_DIR).replace(os.sep, '/')
                    db.commit()

                    if torrent_hash:
                        remove_torrent(torrent_hash, **qbt_params)

                    _update_download(download_id, status="completed", progress=100)
                else:
                    _update_download(download_id, status="error", error="Ошибка конвертации")
                    db.delete(movie)
                    db.commit()
            else:
                _update_download(download_id, status="error", error="Ошибка скачивания торрента")
                db.delete(movie)
                db.commit()

            # Cleanup
            try:
                time.sleep(2)
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)
            except Exception:
                pass

        except Exception as db_err:
            db.rollback()
            raise db_err
        finally:
            db.close()

    except Exception as e:
        print(f"[Requests] Movie download error: {e}")
        _update_download(download_id, status="error", error=str(e))


def _download_audiobook(download_id: str, req: DownloadRequest):
    """Download an audiobook from Audioboo"""
    try:
        _update_download(download_id, status="fetching_details", progress=10)

        from routers.audiobooks_source import fetch_audioboo_details, AudiobooDownloadRequest, process_audioboo_background

        # Get details
        details = fetch_audioboo_details(url=req.source_url or req.id)
        if not details:
            _update_download(download_id, status="error", error="Не удалось получить данные аудиокниги")
            return

        _update_download(download_id, status="downloading", progress=30)

        # Build download request compatible with existing logic
        audioboo_req = AudiobooDownloadRequest(
            title=req.title or details.get("title", ""),
            author=req.author or details.get("author", ""),
            download_url=details.get("download_link", ""),
            image_url=req.image_url or details.get("image", ""),
            genre=req.genre or details.get("genre", "Общее"),
            description=req.description or details.get("description", ""),
            narrator=req.narrator or details.get("narrator", ""),
            year=str(req.year) if req.year else details.get("year"),
            source_url=req.source_url or req.id
        )

        if not audioboo_req.download_url:
            _update_download(download_id, status="error", error="Ссылка на скачивание не найдена")
            return

        # Use existing download logic
        process_audioboo_background(audioboo_req)
        _update_download(download_id, status="completed", progress=100)

    except Exception as e:
        print(f"[Requests] Audiobook download error: {e}")
        _update_download(download_id, status="error", error=str(e))


# ---- Status endpoint ----

@router.get("/status")
async def get_download_status():
    """Get status of all active downloads"""
    # Clean up old entries (>1 hour)
    to_remove = []
    cutoff = datetime.now().timestamp() - 3600
    for did, info in active_downloads.items():
        if info["status"] in ("completed", "error"):
            try:
                started = datetime.fromisoformat(info["started_at"]).timestamp()
                if started < cutoff:
                    to_remove.append(did)
            except Exception:
                pass
    for did in to_remove:
        del active_downloads[did]

    return list(active_downloads.values())
