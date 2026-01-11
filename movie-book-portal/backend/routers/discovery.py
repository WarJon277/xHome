from fastapi import APIRouter, Depends, HTTPException, Query
import requests
import feedparser
from bs4 import BeautifulSoup
import os
import random
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(tags=["discovery"])

# Primary domain as requested
FLIBUSTA_MIRRORS = [
    "http://flibusta.is",
]

def get_headers():
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    ]
    return {
        'User-Agent': random.choice(user_agents),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    }

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
            response = requests.get(url, headers=get_headers(), timeout=timeout)
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

# Mapping frontend genres to Flibusta/TMDB genres
# Full Flibusta Genre Mapping
GENRE_MAPPING = {
    "Деловая литература": {
        "Деловая литература": "economics_ref",
        "Карьера, кадры": "popular_business",
        "Маркетинг, PR": "org_behavior",
        "Финансы": "banking",
        "Экономика": "economics",
    },
    "Детективы и триллеры": {
        "Артефакт-детективы": "det_artifact",
        "Боевик": "det_action",
        "Дамский детективный роман": "det_lady",
        "Детективы": "detective",
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
    },
    "Детская литература": {
        "Детская литература: прочее": "children",
        "Детская образовательная литература": "child_education",
        "Зарубежная литература для детей": "foreign_children",
        "Классическая детская литература": "child_classical",
        "Народные сказки": "folk_tale",
        "Сказки зарубежных писателей": "child_tale_foreign_writers",
        "Сказки отечественных писателей": "child_tale_russian_writers",
        "Детская проза: приключения": "child_adv",
        "Детская фантастика": "child_sf",
        "Стихи для детей и подростков": "child_verse",
    },
    "Документальная литература": {
        "Биографии и мемуары": "nonf_biography",
        "Военная документалистика": "nonf_military",
        "Документальная литература": "nonfiction",
        "Публицистика": "nonf_publicism",
    },
    "Дом и семья": {
        "Боевые искусства, спорт": "home_sport",
        "Домашние животные": "home_pets",
        "Здоровье": "home_health",
        "Кулинария": "home_cooking",
        "Педагогика, воспитание": "sci_pedagogy",
        "Популярная психология": "sci_psychology_popular",
        "Семейные отношения, секс": "home_sex",
        "Хобби и ремесла": "home_crafts",
    },
    "Искусство и Культура": {
        "Искусство и Дизайн": "design",
        "Кино": "cine",
        "Музыка": "music",
        "Культурология": "sci_culture",
    },
    "Компьютеры и Интернет": {
        "Интернет и Сети": "comp_www",
        "Программирование": "comp_db",
        "Компьютерная литература": "computers",
    },
    "Любовные романы": {
        "Исторические любовные романы": "love_history",
        "Короткие любовные романы": "love_short",
        "Любовное фэнтези": "love_sf",
        "Остросюжетные любовные романы": "love_detective",
        "Современные любовные романы": "love_contemporary",
        "Эротика": "love_erotica",
    },
    "Наука и Образование": {
        "История": "sci_history",
        "Психология": "sci_psychology",
        "Философия": "sci_philosophy",
        "Математика": "sci_math",
        "Физика": "sci_phys",
        "Литературоведение": "sci_philology",
        "Языкознание": "sci_linguistic",
        "Политика": "sci_politics",
    },
    "Поэзия": {
        "Поэзия": "poetry",
        "Классическая поэзия": "poetry_classical",
        "Юмористические стихи": "humor_verse",
    },
    "Приключения": {
        "Вестерн": "adv_indian",
        "Исторические приключения": "adv_history",
        "Морские приключения": "adv_maritime",
        "Приключения": "adventure",
        "Природа и животные": "adv_animal",
        "Путешествия и география": "adv_geo",
    },
    "Проза": {
        "Историческая проза": "prose_history",
        "Классическая проза": "prose_classic",
        "Проза о войне": "prose_military",
        "Современная проза": "prose_contemporary",
        "Русская классика": "prose_rus_classic",
        "Советская классика": "prose_su_classics",
    },
    "Религия и Эзотерика": {
        "Религия": "religion",
        "Православие": "religion_orthodoxy",
        "Эзотерика": "religion_esoterics",
        "Самосовершенствование": "religion_self",
    },
    "Фантастика": {
        "Альтернативная история": "sf_history",
        "Боевая фантастика": "sf_action",
        "Бояръ-аниме": "boyar_anime",
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
        "Ужасы": "sf_horror",
        "Фэнтези": "sf_fantasy",
        "Эпическая фантастика": "sf_epic",
        "Юмористическая фантастика": "sf_humor",
    },
    "Юмор": {
        "Анекдоты": "humor_anecdote",
        "Юмор": "humor",
        "Юмористическая проза": "humor_prose",
    }
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

@router.get("/browse")
def browse_content(ctype: str, genre: str):
    """Browse content list based on genre"""
    if ctype == "books":
        return browse_flibusta_genre(genre)
    # Placeholder for movies
    return []

@router.get("/details")
def get_details(book_id: str):
    """Get full details for a specific book"""
    return scrape_book_details(book_id)

@router.get("/suggest")
def suggest_content(ctype: str, genre: str):
    """Suggest a random piece of content based on genre"""
    if ctype == "books":
        return suggest_book(genre)
    elif ctype == "movies":
        return suggest_movie(genre)
    else:
        raise HTTPException(status_code=400, detail="Invalid content type")

def suggest_book(genre_name: str):
    """Try multiple sources for Russian books"""
    
    # Source 1: Flibusta OPDS (Browsing by genre code)
    result = try_flibusta_genre(genre_name)
    if result:
        return result
    
    # Do NOT fallback to search by keyword (try_flibusta_search) because it results in 
    # finding books with the genre name in the title, which is wrong.
    
    return None

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
    return None

def scrape_book_details(book_id: str):
    """Scrape detailed info from a book page"""
    try:
        response = request_flibusta(f"b/{book_id}", timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        base_url = response.base_url
        url = f"{base_url}/b/{book_id}"
        
        # Title
        title_tag = soup.find('h1', class_='title')
        title = title_tag.get_text(strip=True) if title_tag else "Без названия"
        # Cleanup title (remove format suffix like '(fb2)')
        if '(' in title:
            title = title.split('(')[0].strip()

        # Author(s)
        # Usually links /a/XXXXX
        authors = []
        for a in soup.select('a[href^="/a/"]'):
            # Only if it's in the top part (not comments)
            # This is heuristic, usually author comes before the title or right after
            if not a.find_parent(class_='comment'):
                name = a.get_text(strip=True)
                if name and name not in authors and len(name) > 2:
                    authors.append(name)
        # Take first 1-2 authors
        author = ", ".join(authors[:2]) if authors else "Неизвестен"

        # Image (Cover)
        # <img src="/i/1/693501/_cover.jpg" ... title="Cover image" ...>
        image = None
        img_tag = soup.find('img', title='Cover image')
        if not img_tag:
            # Try finding any image with valid src in the main block
            main_block = soup.find('div', id='main')
            if main_block:
                for img in main_block.find_all('img'):
                    src = img.get('src', '')
                    if '/i/' in src and ('cover' in src or 'jpg' in src) and not 'znak.gif' in src:
                        img_tag = img
                        break
        
        if img_tag:
            src = img_tag.get('src')
            image = src if src.startswith('http') else f"{base_url}{src}"

        # Year
        # Search for text "год издания" or similar regex in the content
        year = None
        text_content = soup.get_text()
        import re
        # "издание 2021 г."
        year_match = re.search(r'издание\s+(\d{4})\s*г', text_content)
        if year_match:
            year = int(year_match.group(1))
        else:
            year_match = re.search(r'(\d{4})\s*г\.', text_content)
            if year_match:
                year = int(year_match.group(1))

        # Description
        # <h2>Аннотация</h2><p>...</p>
        description = ""
        anno_header = soup.find('h2', string=re.compile('Аннотация', re.I))
        if anno_header:
            # Get next siblings until next header or hr
            curr = anno_header.find_next_sibling()
            while curr and curr.name != 'h2' and curr.name != 'hr':
                if curr.name == 'p':
                    description += curr.get_text(strip=True) + "\n"
                curr = curr.find_next_sibling()
        
        if not description:
             # Fallback
             description = "Описание отсутствует"

        # Download Links
        # <a href="/b/693501/fb2">(fb2)</a>
        download_url = None
        preferred_formats = ['epub', 'fb2', 'mobi']
        links = {}
        
        for fmt in preferred_formats:
            link = soup.find('a', href=f"/b/{book_id}/{fmt}")
            if link:
                links[fmt] = f"{base_url}/b/{book_id}/{fmt}"
        
        if 'epub' in links: download_url = links['epub']
        elif 'fb2' in links: download_url = links['fb2']
        elif 'mobi' in links: download_url = links['mobi']

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
        return None

def browse_flibusta_genre(genre_name: str):
    """Browse Flibusta genre page to find a list of 20 books"""
    # 1. Flatten the GENRE_MAPPING to find the code
    f_genre = None
    for category, subgenres in GENRE_MAPPING.items():
        if genre_name in subgenres:
            f_genre = subgenres[genre_name]
            break
            
    if not f_genre:
        f_genre = "sf"
    
    # Use HTML scraping directly as it is more reliable than OPDS without auth
    try:
        response = request_flibusta(f"g/{f_genre}", timeout=15)
        soup = BeautifulSoup(response.content, 'html.parser')
        base_url = response.base_url
        main = soup.find('div', id='main')
        if not main: 
            print("No main div found")
            return []

        books = []
        import re
        # Find all book links: /b/XXXXXX
        # Regex explanation: starts with /b/, followed by digits, end of string (or params)
        # We process 'a' tags.
        
        # In the genre list, books are listed usually in a form or just line by line
        # <a href="/b/123">Title</a>
        
        seen_ids = set()
        
        for a in main.find_all('a', href=re.compile(r'^/b/\d+$')):
            href = a['href']
            book_id = href.split('/')[-1]
            
            if book_id in seen_ids:
                continue
            
            title = a.get_text(strip=True)
            if not title: continue
            
            # Author is usually the next link that looks like /a/XXXX
            author = "Неизвестен"
            
            # Look at next siblings to find author link
            # Sometimes it's next element, sometimes inside a small tag
            # Simplest heuristic: check the next <a> tag
            next_a = a.find_next('a')
            if next_a and next_a['href'].startswith('/a/'):
                 # Check if it's reasonably close (not part of next book entry)
                 # This is tricky in flat lists.
                 # But usually: Book Title <br> Author(s) OR Book Title - Author
                 author = next_a.get_text(strip=True)

            bs_obj = {
                "id": book_id,
                "title": title,
                "author": author,
                "image": None, # HTML list has no images usually
                "source_url": f"{base_url}/b/{book_id}"
            }
            
            books.append(bs_obj)
            seen_ids.add(book_id)
            
            if len(books) >= 50: # Fetch a few more to be safe
                break
        
        # Randomize slightly to give variety if we just took top 30
        if len(books) > 20:
            books = random.sample(books, 20)
            
        print(f"Found {len(books)} books via HTML scraping")
        return books

    except Exception as e:
        print(f"Flibusta HTML browse failed: {e}")
        return []

# Removed scrape_genre_html as it is now integrated into the main function


def try_flibusta_genre(genre_name: str):
    """Get a random book details from genre"""
    books = browse_flibusta_genre(genre_name)
    if books:
        random_book = random.choice(books)
        return scrape_book_details(random_book['id'])
    return None






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
    """Proxy content from external URL to avoid CORS/IP blocking"""
    try:
        # Use headers to mimic browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()
        
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
        raise HTTPException(status_code=400, detail="Failed to fetch content")
