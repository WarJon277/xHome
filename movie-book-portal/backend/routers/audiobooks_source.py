from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import requests
import feedparser
from bs4 import BeautifulSoup
import os
import shutil
from sqlalchemy.orm import Session
from database_audiobooks import Audiobook, get_db_audiobooks, SessionLocalAudiobooks
from dependencies import get_db_audiobooks_simple
import uuid
import re
import base64
import json
from urllib.parse import unquote, quote
import threading
import time
import random

from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Global session to maintain cookies
session = requests.Session()
session.trust_env = False  # Disable system proxies
session.verify = False     # Ignore SSL errors (for stability against strict servers/firewalls)

# Limit concurrency to prevent 10054 Connection Reset and SSLErrors
audioboo_semaphore = threading.Semaphore(2)

# Configure robust retry strategy
retries = Retry(
    total=5,
    backoff_factor=1,
    status_forcelist=[500, 502, 503, 504, 429],
    allowed_methods=["GET", "POST", "HEAD", "OPTIONS"],
    raise_on_status=False
)
adapter = HTTPAdapter(max_retries=retries)
session.mount("http://", adapter)
session.mount("https://", adapter)

# Configure robust retry strategy
retries = Retry(
    total=5,
    backoff_factor=1,
    status_forcelist=[500, 502, 503, 504, 429],
    allowed_methods=["GET", "POST", "HEAD", "OPTIONS"],
    raise_on_status=False
)
adapter = HTTPAdapter(max_retries=retries)
session.mount("http://", adapter)
session.mount("https://", adapter)

DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
}
session.headers.update(DEFAULT_HEADERS)

router = APIRouter(prefix="/audiobooks-source", tags=["audiobooks-source"])

FLIBUSTA_BASE_URL = os.environ.get("FLIBUSTA_URL", "http://flibusta.is")
OPDS_URL = f"{FLIBUSTA_BASE_URL}/opds"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIOBOOKS_UPLOADS = os.path.join(BASE_DIR, "uploads", "audiobooks")

@router.get("/flibusta-search")
def search_flibusta_audiobooks(q: str = Query(..., min_length=2)):
    """Search for audiobooks on Flibusta via OPDS"""
    search_url = f"{OPDS_URL}/search?searchType=books&searchTerm={requests.utils.quote(q)}"
    
    try:
        response = requests.get(search_url, timeout=15)
        response.raise_for_status()
        
        feed = feedparser.parse(response.content)
        results = []
        
        for entry in feed.entries:
            links = {}
            for link in entry.links:
                rel = link.get('rel', '')
                type_ = link.get('type', '')
                href = link.get('href', '')
                
                if 'image' in type_ or 'thumbnail' in rel:
                    links['image'] = href if href.startswith('http') else f"{FLIBUSTA_BASE_URL}{href}"
                
                if 'epub' in type_:
                    links['epub'] = href if href.startswith('http') else f"{FLIBUSTA_BASE_URL}{href}"
                elif 'fb2' in type_ or 'application/fb2+zip' in type_:
                    links['fb2'] = href if href.startswith('http') else f"{FLIBUSTA_BASE_URL}{href}"
                elif 'mobi' in type_:
                    links['mobi'] = href if href.startswith('http') else f"{FLIBUSTA_BASE_URL}{href}"

            if any(k in links for k in ['epub', 'fb2', 'mobi']):
                results.append({
                    "id": entry.id.split('/')[-1] if 'id' in entry else str(uuid.uuid4()),
                    "title": entry.title,
                    "author": entry.author if 'author' in entry else "Неизвестен",
                    "description": BeautifulSoup(entry.summary, "html.parser").get_text() if 'summary' in entry else "",
                    "image": links.get('image'),
                    "links": links,
                    "source": "flibusta"
                })
        
        return results
    except Exception as e:
        print(f"Flibusta audiobooks search error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при поиске на Флибусте: {str(e)}")


@router.get("/audioboo-search")
def search_audioboo(q: str = Query(..., min_length=2), page: int = 1):
    """Search for audiobooks on audioboo.org"""
    # Pagination calc
    items_per_page = 10 
    result_from = (page - 1) * items_per_page + 1
    
    # DLE search format
    search_url = "https://audioboo.org/index.php?do=search"
    data = {
        "do": "search",
        "subaction": "search",
        "search_start": page, 
        "full_search": 0,
        "result_from": result_from,
        "story": q
    }
    
    try:
        # DLE often requires POST for search or specific parameters
        response = session.post(search_url, data=data, timeout=15, headers={
            'Referer': 'https://audioboo.org/'
        })
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        results = []
        
        # Select items
        items = soup.select('.card, article, .short-item, .item')
        
        for item in items:
            try:
                # Extract title and link
                # Title link is usually a[href*=".html"]:not(.card__img)
                link_elem = item.select_one('a[href*=".html"]:not(.card__img)')
                if not link_elem:
                    link_elem = item.find('a', href=lambda x: x and '/audioboo.org/' not in x and ('.html' in x or '/index.php?' in x))
                
                if not link_elem:
                    # Try to find any link with text
                    link_elem = item.find('a')
                
                if not link_elem or not link_elem.get('href'):
                    continue
                
                title = link_elem.get_text(strip=True)
                if not title or len(title) < 2: continue
                    
                link = link_elem.get('href')
                if not link.startswith('http'):
                    link = f"https://audioboo.org{link}"
                
                # Extract author info if available
                author_elem = item.select_one('a[href*="/xfsearch/avtora/"], .author-link')
                author = author_elem.get_text(strip=True) if author_elem else "Неизвестен"
                
                # Extract description
                desc_elem = item.select_one('.card__desc, .short-text, .description, .story')
                description = desc_elem.get_text(strip=True) if desc_elem else ""
                
                # Extract image
                img_elem = item.select_one('.card__img img, img')
                image = img_elem.get('src') if img_elem else None
                if image and not image.startswith('http'):
                    image = f"https://audioboo.org{image}"
                
                results.append({
                    "id": link.split('/')[-1].replace('.html', '') if '/' in link else str(uuid.uuid4()),
                    "title": title,
                    "author": author,
                    "description": description[:200] + "..." if len(description) > 200 else description,
                    "image": image,
                    "link": link,
                    "source": "audioboo"
                })
            except Exception as e:
                print(f"Error parsing audioboo short-item: {e}")
                continue
        
        # Fallback to general link search if no specific items found
        if not results:
             items = soup.find_all('a', href=re.compile(r'/\d+-.+\.html'))
             for item in items:
                 link = item.get('href')
                 if not link.startswith('http'): link = f"https://audioboo.org{link}"
                 title = item.get_text(strip=True)
                 if title and len(title) > 5:
                     results.append({
                        "id": link.split('/')[-1].replace('.html', ''),
                        "title": title,
                        "author": "Неизвестен",
                        "link": link,
                        "source": "audioboo"
                     })

        return results[:20]
    except Exception as e:
        print(f"Audioboo search error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при поиске на audioboo.org: {str(e)}")


AUDIOBOO_GENRES = {
    # Mapped from User's accurate list
    "Альтернативная история": "altist",
    "Античность": "antichnost",
    "Аудиоспектакль": "audiospektakl",
    "Бизнес": "biz",
    "Биография": "biogr",
    "Боевик": "boevik",
    "Война": "voina",
    "Вселенная метро 2033": "metrovsel",
    "Детектив": "didiktiva",
    "Детективы": "didiktiva", # Alias
    "Детская литература": "detsklit",
    "Детская": "detsklit", # Alias
    "Драма": "drama",
    "Интервью": "interviu",
    "История": "istoria",
    "Классика": "klassika",
    "Лекция": "lekcia",
    "ЛФФР": "lffr",
    "Мемуары": "memuari",
    "Медицина": "medicina",
    "Мистика": "mistic",
    "Новелла": "novella",
    "Повесть": "povest",
    "Попаданцы": "popadanci",
    "Познавательная литература": "poznaem",
    "Постапокалипсис": "postapakalipsis",
    "Поэзия": "poezia",
    "Притча": "pritch",
    "Приключения": "prikluchenia",
    "Проза": "proza",
    "Психология": "psihologia",
    "Публицистика": "publicictika",
    "Ранобэ": "ranobe",
    "Религия": "rellign",
    "Роман": "roman",
    "Сказка": "skazka",
    "Стихи": "ssstihi",
    "Триллер": "triller",
    "Трэш": "tresh",
    "Трєш": "tresh",
    "Ужасы": "ugas",
    "Учебник": "uchebnik",
    "Фантастика": "fantastika",
    "Философия": "filosophi",
    "Фэнтези": "fenezi",
    "Хоррор": "horror",
    "Эзотерика": "ezoterika",
    "Эротика": "erotika",
    "Этногенез": "entogenez",
    "Юмор": "umor",
    "LitRPG": "litrpg",
    "ЛитРПГ": "litrpg", # Alias
    "Warhammer 40000": "warhammer-40000",
    "S.T.A.L.K.E.R.": "stalker",
    
    # Mappings for frontend composite genres to best guess
    "Детективы и Триллеры": "didiktiva", 
    "Любовные романы": "roman",
    "Наука и Образование": "poznaem",
    "Дом и семья": "psihologia", # weak match but better than nothing
    "Компьютеры и Интернет": "uchebnik",
    "Религия и Эзотерика": "rellign",
    "Искусство и Культура": "klassika",
    "Документальная литература": "biogr",
    "Поэзия и Юмор": "poezia"
}

@router.get("/audioboo-browse")
def browse_audioboo(genre: str, page: int = 1):
    """Browse Audioboo by genre with pagination"""
    # Try looking up direct mapping first
    slug = AUDIOBOO_GENRES.get(genre)
    
    if not slug:
        # Check if it's one of the keys in lowercase or simple match
        # This handles cases where frontend sends 'Fantastika' or something
        genre_lower = genre.lower()
        for k, v in AUDIOBOO_GENRES.items():
            if k.lower() == genre_lower:
                slug = v
                break

    if not slug:
        print(f"DEBUG: No slug for genre '{genre}', falling back to search with page {page}")
        return search_audioboo(genre, page)
        
    url = f"https://audioboo.org/{slug}/"
    if page > 1:
        url += f"page/{page}/"
        
    print(f"DEBUG: Browsing Audioboo: {url}")
    
    try:
        response = session.get(url, timeout=15, headers={
            'Referer': 'https://audioboo.org/'
        })
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        results = []
        
        # Similar parsing to search
        items = soup.select('.card, article, .short-item, .item')
        
        for item in items:
            try:
                link_elem = item.select_one('a[href*=".html"]:not(.card__img)')
                if not link_elem:
                    link_elem = item.find('a', href=lambda x: x and '/audioboo.org/' not in x and ('.html' in x or '/index.php?' in x))
                
                if not link_elem: continue
                
                title = link_elem.get_text(strip=True)
                link = link_elem.get('href')
                if not link.startswith('http'): link = f"https://audioboo.org{link}"
                
                # Image
                img_elem = item.select_one('.card__img img, img')
                image = img_elem.get('src') if img_elem else None
                if image and not image.startswith('http'): image = f"https://audioboo.org{image}"
                
                # Author
                author_elem = item.select_one('a[href*="/xfsearch/avtora/"], .author-link')
                author = author_elem.get_text(strip=True) if author_elem else "Неизвестен"

                results.append({
                    "id": link.split('/')[-1].replace('.html', '') if '/' in link else str(uuid.uuid4()),
                    "title": title,
                    "author": author,
                    "image": image,
                    "link": link,
                    "source": "audioboo"
                })
            except: continue
            
        if not results and page > 1:
            print(f"DEBUG: No results on page {page}, falling back to page 1")
            url = f"https://audioboo.org/{slug}/"
            response = session.get(url, timeout=15, headers={'Referer': 'https://audioboo.org/'})
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            items = soup.select('.card, article, .short-item, .item')
            for item in items:
                try:
                    link_elem = item.select_one('a[href*=".html"]:not(.card__img)')
                    if not link_elem:
                        link_elem = item.find('a', href=lambda x: x and '/audioboo.org/' not in x and ('.html' in x or '/index.php?' in x))
                    if not link_elem: continue
                    title = link_elem.get_text(strip=True)
                    link = link_elem.get('href')
                    if not link.startswith('http'): link = f"https://audioboo.org{link}"
                    img_elem = item.select_one('.card__img img, img')
                    image = img_elem.get('src') if img_elem else None
                    if image and not image.startswith('http'): image = f"https://audioboo.org{image}"
                    author_elem = item.select_one('a[href*="/xfsearch/avtora/"], .author-link')
                    author = author_elem.get_text(strip=True) if author_elem else "Неизвестен"
                    results.append({
                        "id": link.split('/')[-1].replace('.html', '') if '/' in link else str(uuid.uuid4()),
                        "title": title,
                        "author": author,
                        "image": image,
                        "link": link,
                        "source": "audioboo"
                    })
                except: continue

        return results
    except Exception as e:
        print(f"Audioboo browse error: {e}")
        # Fallback to search if browse fails
        return search_audioboo(genre, page)
def decode_playerjs_file(encoded_str):
    """Helper to decode PlayerJS encoded strings (Base64 + potential custom logic)"""
    try:
        # Audioboo uses /engine/go.php?url=BASE64
        if '/engine/go.php?url=' in encoded_str:
            b64_part = encoded_str.split('url=')[-1].split('&')[0]
            # Add padding if necessary
            missing_padding = len(b64_part) % 4
            if missing_padding:
                b64_part += '=' * (4 - missing_padding)
            decoded = base64.b64decode(b64_part).decode('utf-8')
            # Fix HTML entities in decoded URL
            decoded = decoded.replace('&amp;', '&')
            return decoded
        return encoded_str
    except Exception:
        return encoded_str


@router.get("/audioboo-fetch")
def fetch_audioboo_details(url: str = Query(...)):
    """Fetch detailed information from audioboo.org link"""
    # Throttle requests effectively to prevent connection drops
    with audioboo_semaphore:
        # Random delay to mimic human behavior and spread load
        time.sleep(random.uniform(1.0, 3.0))
        
        try:
            # Visit home first if no cookies (optional, session handles it)
            if not session.cookies:
                try: session.get("https://audioboo.org/", timeout=10)
                except: pass

            response = session.get(url, timeout=15, headers={
                'Referer': 'https://audioboo.org/'
            })
            
            # If still 403, try one retry with a small delay
            if response.status_code == 403:
                time.sleep(random.uniform(1, 2))
                response = session.get(url, timeout=15, headers={
                    'Referer': 'https://audioboo.org/index.php?do=search'
                })
                
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract title
            title_elem = soup.find('h1')
            title = title_elem.get_text(strip=True) if title_elem else "Неизвестно"
            
            # Extract metadata
            meta_items = soup.select('.full-meta li')
            metadata = {}
            for li in meta_items:
                text = li.get_text(strip=True)
                if ':' in text:
                    parts = text.split(':', 1)
                    metadata[parts[0].strip()] = parts[1].strip()
            
            # Extract description and fallback metadata
            desc_elem = soup.select_one('.full-text, .story, #news-id, .page__text')
            description_text = desc_elem.get_text("\n") if desc_elem else ""
            description = desc_elem.get_text(strip=True) if desc_elem else ""
            
            if not metadata:
                # Fallback parsing from text block using case-insensitive search and more variants
                description_lower = description_text.lower()
                
                author_match = re.search(r'(?:автор|писатель):\s*([^\n<]+)', description_text, re.I)
                if author_match: metadata['Автор'] = author_match.group(1).strip()
                
                narrator_match = re.search(r'(?:исполнитель|чтец|диктор):\s*([^\n<]+)', description_text, re.I)
                if narrator_match: metadata['Исполнитель'] = narrator_match.group(1).strip()
                
                genre_match = re.search(r'жанр:\s*([^\n<]+)', description_text, re.I)
                if genre_match: metadata['Жанр'] = genre_match.group(1).strip()
                
                year_match = re.search(r'(?:год выпуска|год|дата|выпущено)[^:]*:\s*(\d{4})', description_text, re.I)
                if year_match: metadata['Год'] = year_match.group(1).strip()

            author = metadata.get('Автор', 'Неизвестен')
            # narrator might be in metadata as 'Чтец' or 'Исполнитель'
            narrator = metadata.get('Исполнитель', metadata.get('Чтец', 'Аудиокнига'))
            
            # Extract genres
            genre = metadata.get('Жанр', '')
            if not genre:
                genre_elems = soup.select('.full-tag a, .story a[href*="/xfsearch/"], a[href*="/xfsearch/zhanr/"]')
                genres = [g.get_text(strip=True) for g in genre_elems[:5]]
                genre = ", ".join(genres) if genres else ""
            
            # Extract image
            img_elem = soup.select_one('.full-img img, .story img, article img, .page__text img')
            if not img_elem:
                 # Try data-src as fallback (common for lazy loading)
                 img_elem = soup.find('img', attrs={'data-src': True})
        
            image = img_elem.get('src') or img_elem.get('data-src') if img_elem else None
            if image and not image.startswith('http'):
                image = f"https://audioboo.org{image}"
            
            # Extract audio links from PlayerJS config
            download_link = None
            
            # Find script with PlayerJS config
            scripts = soup.find_all('script')
            for script in scripts:
                if script.string and ('PlayerJS' in script.string or 'file:' in script.string or 'playlist:' in script.string):
                    # Search for file: "..." or playlist: "..."
                    file_match = re.search(r'file\s*:\s*["\']([^"\']+)["\']', script.string)
                    if file_match:
                        encoded_file = file_match.group(1)
                        if encoded_file.startswith('[{'): # JSON playlist
                            try:
                                playlist = json.loads(encoded_file)
                                if playlist and len(playlist) > 0:
                                    # Get first or combine? Usually we want the first to check.
                                    # Or if it's a single file masked as playlist
                                    first_file = playlist[0].get('file')
                                    download_link = decode_playerjs_file(first_file)
                            except: pass
                        else:
                            download_link = decode_playerjs_file(encoded_file)
                        
                        if download_link: break

            # Redundant check for direct zip/torrent links
            if not download_link:
                # Check for archive.org links or black buttons
                zip_link = soup.find('a', href=re.compile(r'archive\.org/(download|compress|details)/.+\.zip', re.I))
                if zip_link:
                    download_link = zip_link.get('href')
                    if '/details/' in download_link:
                         # Convert details link to direct download link if possible
                         download_link = download_link.replace('/details/', '/download/')
                
                if not download_link:
                    # Check button with engine/go.php or any link containing "облака"
                    btn = soup.find('a', href=re.compile(r'go\.php\?url='))
                    if not btn:
                         btn = soup.find('a', string=re.compile(r'облака', re.I))
                    
                    if btn and btn.get('href'):
                        href = btn.get('href')
                        if '/engine/go.php?url=' in href:
                            download_link = decode_playerjs_file(href)
                        elif 'archive.org' in href:
                            download_link = href
                        
                if download_link and download_link.startswith('/'):
                     download_link = f"https://audioboo.org{download_link}"
            
            # Final fallback: search for ANY archive.org link
            if not download_link:
                 any_archive_link = soup.find('a', href=re.compile(r'archive\.org/'))
                 if any_archive_link:
                      download_link = any_archive_link.get('href')
            
            return {
                "title": title,
                "author": author,
                "narrator": narrator,
                "description": description,
                "image": image,
                "genre": genre,
                "download_link": download_link,
                "source_url": url,
                "year": metadata.get('Год')
            }
        except Exception as e:
            print(f"Error fetching audioboo details: {e}")
            raise HTTPException(status_code=500, detail=f"Ошибка при получении информации: {str(e)}")


class AudiobooDownloadRequest(BaseModel):
    title: str
    author: str
    download_url: Optional[str] = None
    image_url: Optional[str] = None
    genre: Optional[str] = None
    description: Optional[str] = None
    narrator: Optional[str] = None
    year: Optional[str] = None # Frontend sends string sometimes
    source_url: Optional[str] = None

def process_audioboo_background(request: AudiobooDownloadRequest):
    print(f"Background: Starting download for {request.title}")
    db = SessionLocalAudiobooks()
    try:
        # Unpack request
        title = request.title
        author = request.author
        download_url = request.download_url
        image_url = request.image_url
        genre = request.genre
        description = request.description
        narrator = request.narrator
        year_str = request.year
        
        # Parse year safely
        year = None
        if year_str:
            try:
                 year = int(str(year_str).strip())
            except: pass
            
        # 1. Download the audio file
        response = session.get(download_url, timeout=60, stream=True, headers={
            'Referer': 'https://audioboo.org/'
        })
        response.raise_for_status()
        
        # Determine filename
        ext = ".mp3"  # Default for audioboo
        cd = response.headers.get('content-disposition')
        if cd and 'filename=' in cd:
            filename = cd.split('filename=')[-1].strip('"')
        else:
            filename = f"{title}_{author}{ext}".replace(" ", "_")
        
        safe_filename = "".join([c for c in filename if c.isalnum() or c in "._-"]).strip()
        temp_file_save_path = os.path.join(AUDIOBOOKS_UPLOADS, safe_filename)
        
        os.makedirs(AUDIOBOOKS_UPLOADS, exist_ok=True)
        
        # Save file with progress
        with open(temp_file_save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)

        # 1.1 Handle ZIP unzipping
        from utils import unzip_file, find_audio_files, find_thumbnail_in_dir
        import uuid
        
        final_file_path = temp_file_save_path
        
        if temp_file_save_path.lower().endswith('.zip') or 'zip' in response.headers.get('content-type', '').lower():
            # Create a dedicated directory
            book_dir_name = f"audiobook_dl_{uuid.uuid4()}"
            book_dir_path = os.path.join(AUDIOBOOKS_UPLOADS, book_dir_name)
            
            if unzip_file(temp_file_save_path, book_dir_path):
                audio_files = find_audio_files(book_dir_path)
                if audio_files:
                    final_file_path = audio_files[0]
                    print(f"DEBUG: Using unzipped file: {final_file_path}")
                    
                    # Try to find a better thumbnail if we don't have one or if we just want to check
                    if not image_url:
                        found_thumb = find_thumbnail_in_dir(book_dir_path)
                        if found_thumb:
                            print(f"DEBUG: Found thumbnail in ZIP: {found_thumb}")
                            pass
                            
                    # Remove the original zip
                    try: os.remove(temp_file_save_path)
                    except: pass
                else:
                     print("WARNING: No audio files found in ZIP, keeping original file")
            else:
                 print("WARNING: Failed to unzip, keeping original file")
        
        # 2. Download thumbnail if provided
        thumbnail_path = None
        
        # Check if we found a thumbnail in ZIP (if unzipped)
        if 'book_dir_path' in locals() and os.path.exists(book_dir_path) and not image_url:
             found_thumb = find_thumbnail_in_dir(book_dir_path)
             if found_thumb:
                 thumbnail_path = os.path.relpath(found_thumb, BASE_DIR)

        if image_url and not thumbnail_path:
            try:
                img_response = session.get(image_url, timeout=15, headers={
                    'Referer': 'https://audioboo.org/'
                })
                img_response.raise_for_status()
                
                img_ext = ".jpg"
                if 'png' in image_url.lower():
                    img_ext = ".png"
                elif 'webp' in image_url.lower():
                    img_ext = ".webp"
                
                # Use a more robust filename to avoid truncation issues and collisions
                # Format: audioboo_<slug_from_url>_<short_title>.jpg
                slug = request.source_url.split('/')[-1].replace('.html', '') if request.source_url else str(uuid.uuid4())[:8]
                safe_title = "".join([c for c in title[:30] if c.isalnum() or c == '_']).strip().replace(' ', '_')
                thumb_filename = f"audioboo_{slug}_{safe_title}{img_ext}"
                
                thumb_path = os.path.join(AUDIOBOOKS_UPLOADS, "thumbnails", thumb_filename)
                os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
                
                with open(thumb_path, 'wb') as f:
                    f.write(img_response.content)
                
                thumbnail_path = os.path.relpath(thumb_path, BASE_DIR)
            except Exception as e:
                print(f"Error downloading thumbnail: {e}")
        
        # 3. Add to database
        relative_path = os.path.relpath(final_file_path, BASE_DIR)
        
        db_audiobook = Audiobook(
            title=title,
            author=author,
            narrator=narrator or "Аудиокнига",
            year=year,
            genre=genre or "Неопределено",
            rating=0.0,
            description=description,
            file_path=relative_path,
            thumbnail_path=thumbnail_path,
            source="audioboo"
        )
        
        db.add(db_audiobook)
        db.commit()
        db.refresh(db_audiobook)
        print(f"Created audiobook in DB: {db_audiobook.id} - {title}")

    except Exception as e:
        print(f"Error in background download task: {e}")
    finally:
        db.close()


@router.post("/download-audioboo")
def download_audioboo_audiobook(
    request: AudiobooDownloadRequest,
    background_tasks: BackgroundTasks
):
    """Download an audiobook from audioboo.org and add to library (Background)"""
    background_tasks.add_task(process_audioboo_background, request)
    return {"status": "queued", "message": f"Загрузка аудиокниги '{request.title}' началась в фоновом режиме. Она скоро появится в библиотеке."}


@router.post("/download-flibusta")
async def download_flibusta_audiobook(
    title: str,
    author: str,
    download_url: str,
    image_url: str = None,
    genre: str = None,
    description: str = None,
    db: Session = Depends(get_db_audiobooks_simple)
):
    """Download an audiobook from Flibusta and add to library"""
    try:
        # 1. Download the audio file
        response = requests.get(download_url, timeout=60, stream=True)
        response.raise_for_status()
        
        ext = ".mp3"
        cd = response.headers.get('content-disposition')
        if cd and 'filename=' in cd:
            filename = cd.split('filename=')[-1].strip('"')
        else:
            filename = f"{title}_{author}{ext}".replace(" ", "_")
        
        safe_filename = "".join([c for c in filename if c.isalnum() or c in "._-"]).strip()
        temp_file_save_path = os.path.join(AUDIOBOOKS_UPLOADS, safe_filename)
        
        os.makedirs(AUDIOBOOKS_UPLOADS, exist_ok=True)
        
        with open(temp_file_save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        # 1.1 Handle ZIP unzipping logic for Flibusta too
        from utils import unzip_file, find_audio_files, find_thumbnail_in_dir
        import uuid
        
        final_file_path = temp_file_save_path
        
        if temp_file_save_path.lower().endswith('.zip') or 'zip' in response.headers.get('content-type', '').lower():
             # Create a dedicated directory
            book_dir_name = f"flibusta_{uuid.uuid4()}"
            book_dir_path = os.path.join(AUDIOBOOKS_UPLOADS, book_dir_name)
            
            if unzip_file(temp_file_save_path, book_dir_path):
                audio_files = find_audio_files(book_dir_path)
                if audio_files:
                    final_file_path = audio_files[0]
                    
                    # Remove the original zip
                    try: os.remove(temp_file_save_path)
                    except: pass
                else:
                    print("WARNING: No audio files found in ZIP")

        # 2. Download thumbnail if provided
        thumbnail_path = None
        
        # Check ZIP for thumbnail first if we unzipped
        if 'book_dir_path' in locals() and os.path.exists(book_dir_path) and not image_url:
             found_thumb = find_thumbnail_in_dir(book_dir_path)
             if found_thumb:
                 thumbnail_path = os.path.relpath(found_thumb, BASE_DIR)

        if image_url and not thumbnail_path:
            try:
                img_response = requests.get(image_url, timeout=15)
                img_response.raise_for_status()
                
                img_ext = ".jpg"
                thumb_filename = f"flibusta_{title[:20].replace(' ', '_')}{img_ext}"
                thumb_path = os.path.join(AUDIOBOOKS_UPLOADS, "thumbnails", thumb_filename)
                os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
                
                with open(thumb_path, 'wb') as f:
                    f.write(img_response.content)
                
                thumbnail_path = os.path.relpath(thumb_path, BASE_DIR)
            except Exception as e:
                print(f"Error downloading thumbnail: {e}")
        
        # 3. Add to database
        relative_path = os.path.relpath(final_file_path, BASE_DIR)

        
        db_audiobook = Audiobook(
            title=title,
            author=author,
            narrator="Аудиокнига",
            genre=genre or "Неопределено",
            rating=0.0,
            description=description,
            file_path=relative_path,
            thumbnail_path=thumbnail_path,
            source="flibusta"
        )
        
        db.add(db_audiobook)
        db.commit()
        db.refresh(db_audiobook)
        
        return {
            "id": db_audiobook.id,
            "title": db_audiobook.title,
            "author": db_audiobook.author,
            "file_path": relative_path,
            "thumbnail_path": thumbnail_path,
            "status": "downloaded"
        }
    except Exception as e:
        print(f"Error downloading audiobook from Flibusta: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке аудиокниги: {str(e)}")
