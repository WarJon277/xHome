from fastapi import APIRouter, Depends, HTTPException, Query
import requests
import feedparser
from bs4 import BeautifulSoup
import os
import random
from typing import List, Optional
from pydantic import BaseModel
import re
from urllib.parse import urlparse, urljoin, quote
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

router = APIRouter(tags=["discovery"])

# Providers config
PROVIDERS = {
    "flibusta": "http://flibusta.is",
    "coollib": "https://pda.coollib.net",
    "royallib": "https://royallib.com"
}

FLIBUSTA_MIRRORS = [
    "http://flibusta.is",
]

def get_headers(referer=None):
    # Simplified headers to avoid WAF blocking (mismatch between requests and Chrome fingerprints)
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
    }
    if referer:
        # Extract domain for cleaner Referer
        try:
            from urllib.parse import urlparse
            parts = urlparse(referer)
            if parts.netloc:
                headers['Referer'] = f"{parts.scheme}://{parts.netloc}/"
            else:
                headers['Referer'] = referer
        except:
            headers['Referer'] = referer
            
    return headers

def create_session():
    """Create a requests session with retries and proxy bypass"""
    session = requests.Session()
    # Disable system proxies
    session.trust_env = False
    
    # Configure retries
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session

def request_flibusta(path: str, timeout: int = 15):
    """Try to request path from the primary domain"""
    mirrors = FLIBUSTA_MIRRORS.copy()
    
    # Prioritize environment variable if set
    env_url = os.environ.get("FLIBUSTA_URL")
    if env_url:
        mirrors = [env_url]

    last_error = None
    for mirror in mirrors:
        url = f"{mirror.rstrip('/')}/{path.lstrip('/')}"
        try:
            print(f"Requesting Flibusta: {url}")
            # Use session with disabled system proxy and safe headers
            session = create_session()
            response = session.get(url, headers=get_headers(), timeout=10)
            if response.status_code == 200:
                # Add base_url attribute for absolute link resolution
                response.base_url = mirror
                return response
            print(f"Mirror {mirror} returned status {response.status_code}")
        except Exception as e:
            print(f"Mirror {mirror} failed: {e}")
            last_error = e
            continue
            
    raise Exception(f"All mirrors failed. Last error: {last_error}")

# Simplified Genre Mapping (works for both Flibusta and Coollib - they use identical FB2 slugs)
GENRE_MAPPING = {
    # Фантастика и Фэнтези
    "Альтернативная история": "sf_history",
    "Боевая фантастика": "sf_action",
    "Героическая фантастика": "sf_heroic",
    "Городское фэнтези": "sf_fantasy_city",
    "Киберпанк": "sf_cyberpunk",
    "Космическая фантастика": "sf_space",
    "ЛитРПГ": "sf_litrpg",
    "Мистика": "sf_mystic",
    "Научная фантастика": "sf",
    "Попаданцы": "popadancy",
    "Постапокалипсис": "sf_postapocalyptic",
    "Социальная фантастика": "sf_social",
    "Стимпанк": "sf_stimpank",
    "Тёмное фэнтези": "dark_fantasy",
    "Ужасы": "sf_horror",  # FIXED: was "ugasi"
    "Фантастика": "sf_etc",
    "Фэнтези": "sf_fantasy",  # FIXED: was "fentezi"
    "Эпическая фантастика": "sf_epic",
    "Юмористическая фантастика": "sf_humor",
    
    # Детективы и триллеры
    "Артефакт-детективы": "det_artifact",
    "Боевик": "det_action",
    "Дамский детективный роман": "det_lady",
    "Детективы": "detective",
    "Детективы и Триллеры": "detective",
    "Иронический детектив": "det_irony",
    "Исторический детектив": "det_history",
    "Классический детектив": "det_classic",
    "Криминальный детектив": "det_crime",
    "Крутой детектив": "det_hard",
    "Политический детектив": "det_political",
    "Полицейский детектив": "det_police",
    "Про маньяков": "det_maniac",
    "Советский детектив": "det_su",
    "Триллер": "thriller",
    "Шпионский детектив": "det_espionage",
    
    # Любовные романы
    "Исторические любовные романы": "love_history",
    "Короткие любовные романы": "love_short",
    "Любовное фэнтези": "love_sf",
    "Любовные романы": "love",
    "Остросюжетные любовные романы": "love_detective",
    "Современные любовные романы": "love_contemporary",
    "Эротика": "love_erotica",
    
    # Приключения
    "Вестерн": "adv_indian",
    "Исторические приключения": "adv_history",
    "Морские приключения": "adv_maritime",
    "Приключения": "adventure",
    "Природа и животные": "adv_animal",
    "Путешествия и география": "adv_geo",
    
    # Проза
    "Историческая проза": "prose_history",
    "Классическая проза": "prose_classic",
    "Проза": "prose",
    "Проза о войне": "prose_military",
    "Современная проза": "prose_contemporary",
    "Русская классика": "prose_rus_classic",
    "Советская классика": "prose_su_classics",
    
    # Детская литература
    "Детская литература": "children",
    "Детская образовательная литература": "child_education",
    "Детская проза: приключения": "child_adv",
    "Детская фантастика": "child_sf",
    "Зарубежная литература для детей": "foreign_children",
    "Классическая детская литература": "child_classical",
    "Народные сказки": "folk_tale",
    "Сказки зарубежных писателей": "child_tale_foreign_writers",
    "Сказки отечественных писателей": "child_tale_russian_writers",
    "Стихи для детей и подростков": "child_verse",
    
    # Наука и Образование
    "История": "sci_history",
    "Литературоведение": "sci_philology",
    "Математика": "sci_math",
    "Наука и Образование": "science",
    "Политика": "sci_politics",
    "Психология": "sci_psychology",
    "Физика": "sci_phys",
    "Философия": "sci_philosophy",
    "Языкознание": "sci_linguistic",
    
    # Поэзия и Юмор
    "Анекдоты": "humor_anecdote",
    "Классическая поэзия": "poetry_classical",
    "Поэзия": "poetry",
    "Юмор": "humor",
    "Юмористическая проза": "humor_prose",
    "Юмористические стихи": "humor_verse",
    
    # Документальная литература
    "Биографии и мемуары": "nonf_biography",
    "Военная документалистика": "nonf_military",
    "Документальная литература": "nonfiction",
    "Публицистика": "nonf_publicism",
    
    # Религия и Эзотерика
    "Православие": "religion_orthodoxy",
    "Религия": "religion",
    "Религия и Эзотерика": "religion",
    "Самосовершенствование": "religion_self",
    "Эзотерика": "religion_esoterics",
    
    # Деловая литература
    "Деловая литература": "economics_ref",
    "Карьера, кадры": "popular_business",
    "Маркетинг, PR": "org_behavior",
    "Финансы": "banking",
    "Экономика": "economics",
    
    # Дом и семья
    "Боевые искусства, спорт": "home_sport",
    "Домашние животные": "home_pets",
    "Дом и семья": "home",
    "Здоровье": "home_health",
    "Кулинария": "home_cooking",
    "Педагогика, воспитание": "sci_pedagogy",
    "Популярная психология": "sci_psychology_popular",
    "Семейные отношения, секс": "home_sex",
    "Хобби и ремесла": "home_crafts",
    
    # Искусство и Культура
    "Искусство и Дизайн": "design",
    "Искусство и Культура": "art",
    "Кино": "cine",
    "Культурология": "sci_culture",
    "Музыка": "music",
    
    # Компьютеры и Интернет
    "Интернет и Сети": "comp_www",
    "Компьютеры и Интернет": "computers",
    "Программирование": "comp_db",
}

ROYALLIB_GENRE_MAPPING = {
    "Деловая литература": "delovaya_literatura",
    "Детективы и триллеры": "detektivi_i_trilleri",
    "Детективы и Триллеры": "detektivi_i_trilleri",
    "Детская литература": "detskoe",
    "Документальная литература": "dokumentalnaya_literatura",
    "Дом и семья": "domovodstvo_dom_i_semya",
    "Искусство и Культура": "iskusstvo_i_dizayn",
    "Компьютеры и Интернет": "kompyuteri_i_internet",
    "Любовные романы": "lyubovnie_romani",
    "Наука и Образование": "nauka_obrazovanie",
    "Поэзия": "poeziya",
    "Поэзия и Юмор": "poeziya",
    "Приключения": "priklyucheniya",
    "Проза": "proza",
    "Религия и Эзотерика": "religiya_i_duhovnost",
    "Фантастика": "fantastika",
    "Юмор": "yumor"
}

class Suggestion(BaseModel):
    title: str
    author_director: Optional[str] = None
    year: Optional[int] = None
    description: Optional[str] = None
    rating: Optional[float] = None
    image: Optional[str] = None
    download_url: Optional[str] = None
    source_url: str
    type: str # movie, book
    series: Optional[str] = None
    series_index: Optional[int] = None

@router.get("/search")
def search_books(query: str, provider: str = "flibusta", limit: int = 25):
    """Search for books by title, author, or keyword"""
    if not query or len(query) < 2:
        raise HTTPException(status_code=400, detail="Query too short")
    
    base_url = PROVIDERS.get(provider, PROVIDERS["flibusta"])
    print(f"DEBUG: Searching '{query}' with provider={provider}, base_url={base_url}")
    
    if provider == "audioboo":
        from routers.audiobooks_source import search_audioboo
        return search_audioboo(query)
    
    if "royallib" in base_url:
        return search_royallib(query, base_url, limit)
    elif "coollib" in base_url:
        return search_coollib(query, base_url, limit)
    else:
        return search_flibusta(query, base_url, limit)

@router.get("/browse")
def browse_content(ctype: str, genre: str, provider: str = "flibusta", refresh: bool = False):
    """
    Browse content list based on genre and provider.
    If refresh=True, it will try to pick a random page.
    """
    
    print(f"DEBUG: browse_content called for {ctype}/{genre}. Refresh={refresh}")
    
    # Random page logic
    page = 1
    if refresh:
        # Pick a random page between 1 and 20 to shake things up (limited depth to ensure results)
        page = random.randint(1, 20)
        print(f"DEBUG: Refresh requested, using random page {page}")

    if ctype == "books":
        base_url = PROVIDERS.get(provider, PROVIDERS["flibusta"])
        print(f"DEBUG: Browsing with provider={provider}, base_url={base_url}, page={page}")
        return browse_library_genre(genre, base_url, page=page)
    elif ctype == "audiobooks":
        # Use proper browsing with genre mapping and pagination
        from routers.audiobooks_source import browse_audioboo
        print(f"DEBUG: Browsing audiobooks with genre={genre}, page={page}")
        return browse_audioboo(genre, page=page)
    # Placeholder for movies
    return []

@router.get("/details")
def get_details(book_id: str, provider: str = "flibusta"):
    """Get full details for a specific book"""
    if provider == "audioboo" or provider == "audiobooks":
        # Check if book_id is full URL or just ID
        # Audioboo fetcher expects full URL usually, but browse returns IDs as slugs
        # If ID is just a slug or number, we might need to reconstruct URL?
        # Browse returns 'link' which is full URL. But 'id' which is slug.
        # Frontend passes 'id' usually.
        # Let's check what ID is passed. Log says: 102515-staryh-aleksej-obekt-sever-03-temnyj-signal
        # The fetch_audioboo_details expects a URL.
        # We can reconstruct it: https://audioboo.org/{book_id}.html
        from routers.audiobooks_source import fetch_audioboo_details
        url = book_id
        if not url.startswith("http"):
             url = f"https://audioboo.org/{book_id}.html"
        return fetch_audioboo_details(url)

    base_url = PROVIDERS.get(provider, PROVIDERS["flibusta"])
    # Ensure function exists (it's defined below)
    return scrape_book_details(book_id, base_url)

@router.get("/suggest")
def suggest_content(ctype: str, genre: str, provider: str = "flibusta"):
    """Suggest a random piece of content based on genre"""
    if ctype == "books":
        return suggest_book(genre, provider)
    elif ctype == "audiobooks":
        return suggest_audiobook(genre)
    elif ctype == "movies":
        return suggest_movie(genre)
    else:
        raise HTTPException(status_code=400, detail="Invalid content type")

def suggest_audiobook(genre_name: str):
    """Suggest a random audiobook from a genre using search"""
    from routers.audiobooks_source import search_audioboo, fetch_audioboo_details
    try:
        # Search for the genre name
        books = search_audioboo(genre_name)
        if not books:
            # Try a default genre or just random search if nothing found
            books = search_audioboo("бестселлер")
            
        if books:
            random_book = random.choice(books[:10])
            # Fetch full details
            details = fetch_audioboo_details(random_book['link'])
            if details:
                # Map to Suggestion model format
                return Suggestion(
                    title=details.get('title', random_book.get('title')),
                    author_director=details.get('author', random_book.get('author')),
                    description=details.get('description', ''),
                    rating=None,
                    image=details.get('image', random_book.get('image')),
                    download_url=details.get('download_link'),
                    source_url=random_book.get('link'),
                    year=int(details.get('year')) if details.get('year') and str(details.get('year')).isdigit() else None,
                    type="audiobook"
                )
    except Exception as e:
        print(f"Error suggesting audiobook: {e}")
        
    # Fallback suggestion
    return Suggestion(
        title="Ничего не найдено",
        author_director="Система",
        description="К сожалению, не удалось автоматически подобрать аудиокнигу.",
        source_url="#",
        type="audiobook"
    )

def suggest_book(genre_name: str, provider: str = "flibusta"):
    """Suggest a random book from a genre using search"""
    
    # Map genre to search keywords
    genre_keywords = {
        "Фантастика": ["фантастика", "sci-fi", "научная фантастика"],
        "Детективы и триллеры": ["детектив", "триллер", "криминал"],
        "Любовные романы": ["роман", "любовь", "романтика"],
        "Приключения": ["приключения", "adventure"],
        "Ужасы": ["ужасы", "хоррор", "мистика"],
        "Проза": ["проза", "роман"],
        "Поэзия": ["поэзия", "стихи"],
        "Юмор": ["юмор", "комедия", "сатира"],
        "Наука и Образование": ["наука", "научпоп", "образование"],
        "Детская литература": ["детская", "сказка"],
    }
    
    # Get keywords for genre, or use genre name itself
    keywords = genre_keywords.get(genre_name, [genre_name.lower()])
    
    # Try each keyword until we get results
    for keyword in keywords:
        try:
            print(f"DEBUG: Suggesting book for genre '{genre_name}' using keyword '{keyword}'")
            
            # Try search first
            base_url = PROVIDERS.get(provider, PROVIDERS["flibusta"])
            
            if provider == "royallib":
                books = search_royallib(keyword, base_url, limit=30)
            elif provider == "coollib":
                books = search_coollib(keyword, base_url, limit=30)
            else:
                books = search_flibusta(keyword, base_url, limit=30)
            
            if books and len(books) > 0:
                # Pick a random book
                random_book = random.choice(books)
                print(f"DEBUG: Selected random book: {random_book['title']}")
                
                # Get full details
                details = scrape_book_details(random_book['id'], base_url)
                if details:
                    return details
            
        except Exception as e:
            print(f"DEBUG: Error suggesting book with keyword '{keyword}': {e}")
            continue
    
    # Fallback: try browse (might still work for some providers)
    try:
        result = try_flibusta_genre(genre_name)
        if result:
            return result
    except:
        pass
    
    # Last resort: return a curated classic
    print(f"WARNING: Could not suggest book for genre '{genre_name}', using fallback")
    return get_russian_classic_by_genre(genre_name)


@router.get("/cover")
def get_cover_url(book_id: str):
    """Get the cover image URL for a specific book"""
    img_url = get_book_image_url(book_id)
    if img_url:
        return {"url": img_url}
    return {"url": None}

def get_book_image_url(book_id: str):
    """Helper to scrape just the image URL from a book page"""
    try:
        response = request_flibusta(f"b/{book_id}", timeout=5)
        soup = BeautifulSoup(response.content, 'html.parser')
        base_url = response.base_url
        
        # Image (Cover)
        img_tag = soup.find('img', title='Cover image')
        if not img_tag:
            main_block = soup.find('div', id='main')
            if main_block:
                for img in main_block.find_all('img'):
                    src = img.get('src', '')
                    if '/i/' in src and ('cover' in src or 'jpg' in src) and not 'znak.gif' in src:
                        img_tag = img
                        break
        
        if img_tag:
            src = img_tag.get('src')
            return src if src.startswith('http') else f"{base_url}{src}"
    except:
        return None

def scrape_book_details(book_id: str, base_url: str = PROVIDERS["flibusta"]):
    """Scrape detailed info from a book page"""
    from urllib.parse import urljoin, urlparse
    try:
        # Construct URL based on provider
        if "royallib.com" in base_url:
            # Clean up book_id to get only the path
            parsed = urlparse(book_id)
            path = parsed.path if parsed.path else book_id
            if 'royallib.com' in path:
                 path = path.split('royallib.com')[-1]
            if not path.startswith('/'): path = '/' + path
            
            url = f"https://royallib.com{path}"
        else:
            url = f"{base_url.rstrip('/')}/b/{book_id}"
        
        print(f"DEBUG: Scraping book details from: {url}")
        
        title = "Без названия"
        description = ""
        image = None
        title_tag = None

        # Requests with headers including referer
        session = create_session()
        session.headers.update(get_headers(referer=base_url))
        
        # RoyalLib doesn't usually block, but headers are good
        if "royallib.com" in base_url:
            session.headers.update({'Host': 'royallib.com'})

        response = session.get(url, timeout=15)
        print(f"DEBUG: Response status for {url}: {response.status_code}")
        
        if response.status_code == 403:
             print("WARNING: 403 Forbidden detected. Site might be blocking requests.")
             # Fallback attempt?
        
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        title = "Без названия"
        description = ""
        image = None

        if "royallib.com" in base_url:
             # RoyalLib parsing
             title_tag = soup.find('h1')
             if title_tag:
                 raw_title = title_tag.get_text(strip=True)
                 # RoyalLib often has "Author - Title" in H1
                 if " - " in raw_title:
                     parts = raw_title.split(" - ", 1)
                     author_parts = parts[0].strip()
                     title = parts[1].strip()
                 else:
                     title = raw_title

             description_tag = soup.find(attrs={"itemprop": "description"}) or \
                               soup.find('div', class_='book-description')
             
             if description_tag: 
                 description = description_tag.get_text("\n", strip=True)
             
             img_tag = soup.find(attrs={"itemprop": "image"}) or \
                       soup.find('img', src=re.compile(r'/covers/'))
             
             if img_tag:
                 src = img_tag.get('src')
                 image = urljoin("https://royallib.com", src)
        elif "flibusta" in base_url or "coollib" in base_url:
             # Flibusta / CoolLib parsing
             # Scope to main content to avoid sidebar "Navigation" etc.
             content_area = soup.find('div', id='main') or soup.find('div', id='container') or soup
             
             title_tag = content_area.find('h1', class_='title') or content_area.find('h1') or content_area.find('h3')
             if title_tag: 
                 raw_title = title_tag.get_text(strip=True)
                 # Ignore common sidebar headers if they get picked up
                 if raw_title.lower() not in ['навигация', 'вход', 'поиск', 'меню']:
                    title = raw_title
             
             # Description (Annotation)
             # CoolLib PDA often uses <b>Аннотация</b> or <h2>Аннотация</h2>
             anno_header = content_area.find(['h2', 'b', 'h3', 'strong'], string=re.compile('Аннотация', re.I))
             if anno_header:
                 curr = anno_header.next_sibling
                 while curr and (not hasattr(curr, 'name') or (curr.name not in ['h2', 'h3', 'hr', 'table'])):
                     if hasattr(curr, 'get_text'):
                         text = curr.get_text(strip=True)
                         if text and not text.startswith('Поделиться'):
                             description += text + "\n"
                     elif isinstance(curr, str):
                         text = curr.strip()
                         if text: description += text + "\n"
                     curr = curr.next_sibling
             
             # Image (Cover)
             img_tag = content_area.find('img', title='Cover image') or content_area.find('img', src=re.compile(r'/b/'))
             if not img_tag:
                 if content_area:
                     for img in content_area.find_all('img'):
                         src = img.get('src', '')
                         if ('/i/' in src or '/b/' in src) and ('cover' in src or 'jpg' in src) and not 'znak.gif' in src:
                             img_tag = img
                             break
             if img_tag:
                 src = img_tag.get('src')
                 image = src if src.startswith('http') else f"{base_url.rstrip('/')}{src}"
        
        # Cleanup title
        if '(' in title: title = title.split('(')[0].strip()

        # Authors
        authors = []
        if "royallib.com" in base_url:
            for a in soup.select('a[href*="/author/"]'):
                name = a.get_text(strip=True)
                if name and name not in authors and len(name) > 2:
                    authors.append(name)
        else:
            # Scope authors to content area usually
            search_area = soup.find('div', id='main') or soup
            for a in search_area.select('a[href^="/a/"]'):
                if not a.find_parent(class_='comment') and not a.find_parent(class_='sidebar'):
                    name = a.get_text(strip=True)
                    if name and name not in authors and len(name) > 2 and 'читать' not in name.lower():
                        authors.append(name)
        
        author = ", ".join(authors[:2]) if authors else "Неизвестен"

        # Year
        year = None
        # ... (Year logic usually fine) ...
        # (omitted for brevity, assume existing year logic works or requires less change)
        
        if not year:
            text_content = soup.get_text()
            year_match = re.search(r'(?:издание|год|выпуск)[\s:]+(\d{4})', text_content, re.I)
            if not year_match:
                year_match = re.search(r'(\d{4})\s*г\.', text_content)
            if year_match:
                year = int(year_match.group(1))

        if not description:
             description = "Описание отсутствует"

        # Download/Read URL
        download_url = None
        if "royallib.com" in base_url:
            # ... (RoyalLib logic) ...
            pass # Skipping RoyalLib edits here as they are fine
            # RoyalLib provides ZIPs for formats. We prefer FB2 or EPUB.
            # Buttons look like: "Скачать в формате FB2"
            for fmt in ['fb2', 'epub', 'txt']:
                download_link = soup.find('a', string=re.compile(rf'Скачать в формате {fmt.upper()}', re.I))
                if download_link:
                    download_url = urljoin("https://royallib.com", download_link['href'])
                    break
            
            if not download_url:
                 # Check for general download links
                 download_link = soup.find('a', href=re.compile(r'/get/(fb2|epub|txt)/'))
                 if download_link:
                     download_url = urljoin("https://royallib.com", download_link['href'])
        elif "coollib" in base_url:
            # Coollib uses /b/[id]-[slug]/download or /b/[id]-[slug]/download_new
            # Prioritize explicit formats that user requested (fb2, epub)
            # Look for links with text containing (fb2), (epub)
            found_url = None
            potential_links = []
            
            # 1. Gather potential links
            # Explicit text links
            for fmt in ['fb2', 'epub']:
                link = soup.find('a', string=re.compile(rf'\({fmt}\)', re.I))
                if link: potential_links.append((fmt, link))
            
            # Path based links
            for fmt in ['fb2', 'epub']:
                link = soup.find('a', href=re.compile(rf'/b/.+/{fmt}$'))
                if link: potential_links.append((fmt, link))
                
            # Generic download
            link = soup.find('a', href=re.compile(r'/b/.+/download'))
            if link: potential_links.append(('generic', link))

            # 2. Select best valid link
            for fmt, link in potential_links:
                href = link.get('href')
                if not href: continue
                
                # Check for external/store links (Litres, etc)
                if 'litres.ru' in href or 'my-shop.ru' in href:
                    print(f"DEBUG: Ignoring external store link: {href}")
                    continue
                
                full_url = f"{base_url.rstrip('/')}{href}" if not href.startswith('http') else href
                
                # If we found a preferred format (fb2/epub) that is internal, take it
                if fmt in ['fb2', 'epub']:
                    found_url = full_url
                    break
                
                # If generic, keep it as fallback (unless we already have a better one)
                if fmt == 'generic' and not found_url:
                    found_url = full_url

            download_url = found_url
        else: # Flibusta
            # Flibusta - check formats or download links
            # PDA version uses download_fbd or download paths
            # Prioritize explicit formats (epub, fb2) over 'read' links
            found_url = None
            potential_links = []
            
            # 1. Gather potential links
            # User prefers EPUB simple download
            for fmt in ['epub', 'fb2', 'mobi']:
                link = soup.find('a', href=re.compile(rf'/b/{book_id}/{fmt}$'))
                if link: potential_links.append((fmt, link))
                
            # If no specific format found, try generic download
            if not potential_links:
                link = soup.find('a', href=re.compile(r'/b/.+/download'))
                if link: potential_links.append(('generic', link))
            
            # If still nothing, fallback to read link (but this might be HTML)
            # Only use read link if we absolutely have to, and warn user
            if not potential_links:
                 read_btn = soup.find('a', href=re.compile(r'/read/|/view/'))
                 if read_btn: potential_links.append(('read', read_btn))

            # 2. Select best valid link
            for fmt, link in potential_links:
                href = link.get('href')
                if not href: continue
                
                # Check for known restricted/external patterns if any appear in hrefs
                if 'litres' in href: continue

                full_url = f"{base_url.rstrip('/')}{href}" if not href.startswith('http') else href
                
                # Prefer EPUB/FB2
                if fmt in ['epub', 'fb2']:
                    found_url = full_url
                    break
                
                # Fallbacks
                if not found_url:
                    found_url = full_url
            
            download_url = found_url

        return Suggestion(
            title=title,
            author_director=author,
            description=description.strip(),
            year=year,
            image=image,
            download_url=download_url,
            source_url=url,
            type="book"
        )
    except Exception as e:
        print(f"Error scraping book {book_id}: {e}")
        import traceback
        traceback.print_exc()
        return None

def browse_library_genre(genre_name: str, base_url: str, page: int = 1):
    """Browse library genre page using HTML scraping"""
    # Direct lookup in flat GENRE_MAPPING
    genre_slug = GENRE_MAPPING.get(genre_name, "sf")  # Default to sci-fi if not found
    
    print(f"DEBUG: Genre '{genre_name}' → slug '{genre_slug}'")
    
    # Use HTML scraping
    try:
        if "royallib.com" in base_url:
            # RoyalLib uses different genre codes and seems to not support simple pagination in genre root easily
            # It lists "All authors" or similar. But URL structure: /genre/slug/
            # RoyalLib pagination is tricky, often just one big page or specific letter pages.
            # We'll ignore page for RoyalLib for now or check if it supports /genre/slug/page.
            actual_genre = ROYALLIB_GENRE_MAPPING.get(genre_name, genre_slug)
            browse_url = f"{base_url.rstrip('/')}/genre/{actual_genre}/"
        else:
            # Flibusta/CoolLib use standard FB2 slugs
            browse_url = f"{base_url.rstrip('/')}/g/{genre_slug}"
            if page > 1:
                # Flibusta uses /g/slug?op=1 (or similar) or /g/slug/2 ? 
                # Checking structure: usually /g/slug?page=N or /g/slug/N
                # Best guess for Flibusta/Coollib ODS: /g/slug?page=N doesn't work well on HTML view.
                # Actually Flibusta HTML genre sort: /g/sf?page=2 ? No.
                # It links to /g/sf?op=2 where op is page-like maybe?
                # Actually commonly /g/{slug}/{page} or /g/{slug}?cn={page}
                # Let's try appending /{page} as it's common in many CMS/frameworks
                browse_url = f"{base_url.rstrip('/')}/g/{genre_slug}/{page}"
            
        print(f"Browsing genre HTML: {browse_url} (slug: {genre_slug})")
        
        # Coollib is slower, needs longer timeout
        timeout = 30 if "coollib" in base_url else 10
        
        # Use session to manage headers and disable system proxies
        session = create_session()
        session.headers.update(get_headers(referer=base_url))
        
        response = session.get(browse_url, timeout=timeout)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        # Try different container IDs used by various providers
        # Coollib uses div#postconn or article or div.oneotzb, Flibusta uses div#main
        main = soup.find('div', id='postconn') or \
               soup.find('div', class_='oneotzb') or \
               soup.find('article') or \
               soup.find('div', id='main') or \
               soup.find('div', class_='main') or \
               soup.find('div', id='content') or \
               soup.find('div', class_='content') or \
               soup.find('div', id='container') or \
               soup.find('div', class_='page') or \
               soup.find('div', id='dle-content') or \
               soup.find('div', class_='DLE-content') or \
               soup.find('main')
               
        if not main: 
            print(f"No main container found on {base_url}, falling back to full page")
            main = soup
        else:
            # Debug: log which container was found
            container_id = main.get('id', '')
            container_class = main.get('class', [])
            print(f"DEBUG: Found container - id='{container_id}', class='{container_class}'")

        books = []
        seen_ids = set()
        
        # Pattern for book links: /b/123 or /books/123 or /123-title.html
        # We look for links containing a numeric ID
        # For iKnigi, we can also scrape description snippets from .shortnews-body
        # Pattern for book links: /book/author/title.html
        if "royallib.com" in base_url:
            # RoyalLib genre pages have tables or simple lists
            items = main.select('a[href*="/book/"]')
            
            for a in items:
                href = a['href']
                if not href.endswith('.html'): continue
                
                # Extract ID (the full path starting from /book/)
                book_id = href.split('royallib.com')[-1] if 'royallib.com' in href else href
                if not book_id.startswith('/'): book_id = '/' + book_id
                
                if book_id in seen_ids: continue
                
                title = a.get_text(strip=True)
                if not title or len(title) < 2: continue

                # Author is usually the next link or in the same row
                author = "Неизвестен"
                # Heuristic: RoyalLib usually lists author before or after title
                # Let's try to find author link nearby
                row = a.find_parent('tr')
                if row:
                    author_a = row.select_one('a[href*="/author/"]')
                    if author_a: author = author_a.get_text(strip=True)
                
                books.append({
                    "id": book_id,
                    "title": title,
                    "author": author,
                    "description": "Описание подгрузится при выборе",
                    "image": None,
                    "source_url": f"https://royallib.com{book_id}"
                })
                seen_ids.add(book_id)
        else:
            # Flibusta/CoolLib standard scraping
            print(f"DEBUG: Parsing {base_url}, looking for book links...")
            
            # Count all links for debugging
            all_links = main.find_all('a', href=True)
            print(f"DEBUG: Found {len(all_links)} total links in main container")
            
            # Try to find book links
            book_links_found = 0
            for a in all_links:
                href = a['href']
                book_id = None
                
                # More flexible book ID extraction
                # Handles both /b/123 (Flibusta) and /b/123-author-title (Coollib)
                if '/b/' in href:
                    match = re.search(r'/b/(\d+)', href)
                    if match: 
                        book_id = match.group(1)
                        book_links_found += 1
                
                if not book_id or book_id in seen_ids: 
                    continue
                
                title = a.get_text(strip=True)
                if not title or len(title) < 2 or title.startswith('(') or title.isdigit():
                    continue
                
                author = "Неизвестен"
                # Try to find author in various ways
                # For Coollib: author link comes AFTER the book title in the same div.boline
                # For Flibusta: author link comes BEFORE the book title
                
                # Check parent element for author (works for both)
                parent = a.find_parent(['div', 'li', 'tr'])
                if parent:
                    # Find all author links in the parent
                    author_links = parent.find_all('a', href=re.compile(r'/a/|/author/'))
                    for author_link in author_links:
                        if author_link != a:  # Not the book link itself
                            author_text = author_link.get_text(strip=True)
                            if author_text and len(author_text) > 2:
                                author = author_text
                                break
                
                # Fallback: check next sibling link
                if author == "Неизвестен":
                    next_a = a.find_next('a', href=True)
                    if next_a and ('/a/' in next_a['href'] or 'avtor-' in next_a['href'] or '/author/' in next_a['href']):
                        author = next_a.get_text(strip=True)

                books.append({
                    "id": book_id,
                    "title": title,
                    "author": author,
                    "image": None,
                    "source_url": f"{base_url.rstrip('/')}/b/{book_id}"
                })
                seen_ids.add(book_id)
                
                if len(books) >= 60:
                    break
            
            print(f"DEBUG: Found {book_links_found} book links, extracted {len(books)} valid books")
        
        # Randomize and limit to 10 as requested
        if len(books) > 10:
            books = random.sample(books, 10)
        
        if len(books) == 0:
            print(f"WARNING: No books found for genre '{genre_name}' on {base_url}")
            if "coollib" in base_url:
                print("INFO: Coollib may be unavailable or changed structure. Try Flibusta or RoyalLib instead.")
            
        print(f"Found {len(books)} books via HTML scraping from {base_url}")
        return books

    except Exception as e:
        print(f"Library browse failed for {base_url}: {e}")
        return []

def try_flibusta_genre(genre_name: str):
    """Legacy helper for suggestions"""
    base_url = PROVIDERS["flibusta"]
    books = browse_library_genre(genre_name, base_url)
    if books:
        random_book = random.choice(books)
        return scrape_book_details(random_book['id'], base_url)
    return None

def search_flibusta(query: str, base_url: str, limit: int = 25):
    """Search Flibusta for books"""
    try:
        # Flibusta search URL pattern
        search_url = f"{base_url.rstrip('/')}/booksearch?ask={quote(query)}"
        print(f"Searching Flibusta: {search_url}")
        
        response = request_flibusta(f"booksearch?ask={quote(query)}")
        soup = BeautifulSoup(response.content, 'html.parser')
        
        books = []
        seen_ids = set()
        
        # Find all book links
        main = soup.find('div', id='main') or soup
        for a in main.find_all('a', href=True):
            href = a['href']
            book_id = None
            
            if '/b/' in href:
                match = re.search(r'/b/(\d+)', href)
                if match:
                    book_id = match.group(1)
            
            if not book_id or book_id in seen_ids:
                continue
            
            title = a.get_text(strip=True)
            if not title or len(title) < 2 or title.startswith('(') or title.isdigit():
                continue
            
            # Try to find author
            author = "Неизвестен"
            next_a = a.find_next('a', href=True)
            if next_a and '/a/' in next_a['href']:
                author = next_a.get_text(strip=True)
            
            books.append({
                "id": book_id,
                "title": title,
                "author": author,
                "description": "Описание подгрузится при выборе",
                "image": None,
                "source_url": f"{base_url.rstrip('/')}/b/{book_id}"
            })
            seen_ids.add(book_id)
            
            if len(books) >= limit:
                break
        
        print(f"Found {len(books)} books on Flibusta")
        return books
        
    except Exception as e:
        print(f"Flibusta search failed: {e}")
        import traceback
        traceback.print_exc()
        return []

def search_coollib(query: str, base_url: str, limit: int = 25):
    """Search Coollib for books"""
    try:
        # Coollib PDA search URL
        search_url = f"{base_url.rstrip('/')}/search?q={quote(query)}"
        print(f"Searching Coollib: {search_url}")
        
        response = requests.get(search_url, headers=get_headers(referer=base_url), timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        books = []
        seen_ids = set()
        
        # Coollib uses /b/ links for books
        main = soup.find('div', id='main') or soup.find('div', class_='content') or soup
        
        for a in main.find_all('a', href=True):
            href = a['href']
            book_id = None
            
            if '/b/' in href:
                match = re.search(r'/b/(\d+)', href)
                if match:
                    book_id = match.group(1)
            
            if not book_id or book_id in seen_ids:
                continue
            
            title = a.get_text(strip=True)
            if not title or len(title) < 2 or title.startswith('(') or title.isdigit():
                continue
            
            # Try to find author
            author = "Неизвестен"
            next_a = a.find_next('a', href=True)
            if next_a and ('/a/' in next_a['href'] or 'author' in next_a['href']):
                author = next_a.get_text(strip=True)
            
            books.append({
                "id": book_id,
                "title": title,
                "author": author,
                "description": "Описание подгрузится при выборе",
                "image": None,
                "source_url": f"{base_url.rstrip('/')}/b/{book_id}"
            })
            seen_ids.add(book_id)
            
            if len(books) >= limit:
                break
        
        print(f"Found {len(books)} books on Coollib")
        return books
        
    except Exception as e:
        print(f"Coollib search failed: {e}")
        import traceback
        traceback.print_exc()
        return []

def search_royallib(query: str, base_url: str, limit: int = 25):
    """Search RoyalLib for books"""
    try:
        # RoyalLib search URL
        search_url = f"{base_url.rstrip('/')}/search/?q={quote(query)}"
        print(f"Searching RoyalLib: {search_url}")
        
        session = requests.Session()
        session.headers.update(get_headers(referer=base_url))
        session.headers.update({'Host': 'royallib.com'})
        
        response = session.get(search_url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        books = []
        seen_ids = set()
        
        # RoyalLib uses /book/ links
        main = soup.find('div', id='content') or soup.find('main') or soup
        
        for a in main.find_all('a', href=True):
            href = a['href']
            
            if '/book/' not in href or not href.endswith('.html'):
                continue
            
            # Extract book ID (full path)
            book_id = href.split('royallib.com')[-1] if 'royallib.com' in href else href
            if not book_id.startswith('/'):
                book_id = '/' + book_id
            
            if book_id in seen_ids:
                continue
            
            title = a.get_text(strip=True)
            if not title or len(title) < 2:
                continue
            
            # Try to find author
            author = "Неизвестен"
            row = a.find_parent('tr') or a.find_parent('div', class_='book-item')
            if row:
                author_a = row.find('a', href=re.compile(r'/author/'))
                if author_a:
                    author = author_a.get_text(strip=True)
            
            books.append({
                "id": book_id,
                "title": title,
                "author": author,
                "description": "Описание подгрузится при выборе",
                "image": None,
                "source_url": f"https://royallib.com{book_id}"
            })
            seen_ids.add(book_id)
            
            if len(books) >= limit:
                break
        
        print(f"Found {len(books)} books on RoyalLib")
        return books
        
    except Exception as e:
        print(f"RoyalLib search failed: {e}")
        import traceback
        traceback.print_exc()
        return []







def get_russian_classic_by_genre(genre_name: str):
    """Fallback: curated Russian classics by genre"""
    classics = {
        "Фантастика": [
            ("Пикник на обочине", "Стругацкие", "Классика советской фантастики"),
            ("Мы", "Замятин", "Антиутопия"),
            ("Солярис", "Лем", "Философская фантастика"),
        ],
        "Боевик": [
            ("День опричника", "Сорокин", "Альтернативная история"),
            ("Черный обелиск", "Ремарк", "Военная драма"),
        ],
        "Ужасы": [
            ("Вий", "Гоголь", "Классическая мистика"),
            ("Мастер и Маргарита", "Булгаков", "Мистический реализм"),
        ],
        "Драма": [
            ("Анна Каренина", "Толстой", "Русская классика"),
            ("Преступление и наказание", "Достоевский", "Психологическая драма"),
            ("Доктор Живаго", "Пастернак", "Историческая драма"),
        ],
        "Приключения": [
            ("Остров сокровищ", "Стивенсон", "Классика приключений"),
            ("Дети капитана Гранта", "Верн", "Приключения"),
        ],
        "Комедия": [
            ("Двенадцать стульев", "Ильф и Петров", "Сатира"),
            ("Мертвые души", "Гоголь", "Комедия"),
        ],
        "Мистика": [
            ("Пиковая дама", "Пушкин", "Мистическая повесть"),
            ("Портрет Дориана Грея", "Уайльд", "Мистика"),
        ],
    }
    
    genre_books = classics.get(genre_name, classics.get("Фантастика", []))
    if not genre_books:
        genre_books = classics["Фантастика"]
    
    book = random.choice(genre_books)
    
    return Suggestion(
        title=book[0],
        author_director=book[1],
        description=book[2],
        year=None,
        rating=None,
        image=None,
        source_url="#",
        type="book"
    )

def suggest_movie(genre_name: str):
    """Suggest a movie - placeholder for now"""
    # TODO: Add TMDB integration or torrent search
    return Suggestion(
        title=f"Рекомендуемый фильм: {genre_name}",
        author_director="Известный режиссер",
        year=2023,
        description=f"Отличный {genre_name.lower()} фильм для вашей коллекции.",
        source_url="#",
        type="movie"
    )

@router.get("/proxy")
def proxy_content(url: str):
    """Proxy content from external URL to avoid CORS/IP blocking. Auto-unzips archives if needed."""
    try:
        # Extract domain for Referer
        from urllib.parse import urlparse
        domain = urlparse(url).netloc
        scheme = urlparse(url).scheme
        referer = f"{scheme}://{domain}/"

        # Use simpler headers for proxy to avoid WAF blocking
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Referer': referer
        }
        
        # Verify if we should trust env (usually proxy bypass needed for Flibusta/Coollib)
        session = create_session()
        
        response = session.get(url, headers=headers, stream=True, timeout=60)
        response.raise_for_status()
        
        content_type = response.headers.get('Content-Type', '').lower()
        content_disp = response.headers.get('Content-Disposition', '')
        
        # Check if it's a zip file that needs extraction (Flibusta often gives fb2.zip)
        # We process it if it's explicitly zip content, or if url ends in .zip, or if content-disp says zip
        # AND it is NOT an image (to prevent breaking cover loading)
        is_image = 'image' in content_type or url.lower().endswith(('.jpg', '.jpeg', '.png', '.gif'))
        is_zip = not is_image and ('zip' in content_type or '.zip' in url.lower() or '.zip' in content_disp.lower())
        
        if is_zip:
            # We need to read the whole content to unzip
            content = response.content
            try:
                import zipfile
                import io
                with zipfile.ZipFile(io.BytesIO(content)) as z:
                    # Filter for book files
                    files = z.namelist()
                    # Priority: fb2, epub, mobi, txt
                    target_file = None
                    for ext in ['.fb2', '.epub', '.mobi', '.txt']:
                        candidates = [f for f in files if f.lower().endswith(ext)]
                        if candidates:
                            target_file = candidates[0]
                            break
                    
                    if target_file:
                        print(f"DEBUG: Auto-unzipped {target_file} from {url}")
                        extracted_content = z.read(target_file)
                        
                        # Guess semantic content type
                        new_ctype = "application/octet-stream"
                        if target_file.endswith('.fb2'): new_ctype = "application/x-fictionbook+xml"
                        elif target_file.endswith('.epub'): new_ctype = "application/epub+zip"
                        
                        # Encode filename for header
                        encoded_name = quote(target_file)
                        
                        from fastapi.responses import Response
                        return Response(
                            content=extracted_content,
                            media_type=new_ctype,
                            headers={
                                'Content-Disposition': f'attachment; filename="{encoded_name}"; filename*=UTF-8\'\'{encoded_name}',
                                'Content-Length': str(len(extracted_content))
                            }
                        )
            except Exception as zip_err:
                print(f"DEBUG: Failed to unzip content from {url}: {zip_err}")
                # Fallback to original content (which is already in 'content' var)
                pass
            
            # Fallback for failed unzip OR if we read content but didn't act on it
            from fastapi.responses import Response
            return Response(
                content=content,
                media_type=response.headers.get('Content-Type'),
                headers={
                    'Content-Disposition': response.headers.get('Content-Disposition', ''),
                    'Content-Length': str(len(content))
                }
            )

        # If not zip (and stream not consumed), stream it
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            response.iter_content(chunk_size=8192),
            media_type=response.headers.get('Content-Type'),
            headers={
                'Content-Disposition': response.headers.get('Content-Disposition', ''),
            }
        )
    except Exception as e:
        print(f"Proxy failed for {url}: {e}")
        status_code = 500
        if isinstance(e, requests.exceptions.HTTPError) and e.response:
             status_code = e.response.status_code
        elif isinstance(e, requests.exceptions.Timeout):
             status_code = 504
        
        # Propagate error properly
        raise HTTPException(status_code=status_code, detail=f"Failed to fetch content: {str(e)}")
