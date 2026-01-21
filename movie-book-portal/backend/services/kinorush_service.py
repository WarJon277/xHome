"""
Kinorush.name scraper service for movie discovery and metadata extraction
"""
import requests
from bs4 import BeautifulSoup
from typing import List, Optional, Dict
from dataclasses import dataclass
import re
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

@dataclass
class TorrentInfo:
    """Information about a torrent download option"""
    quality: str
    translation: str
    size_gb: float
    download_url: str

@dataclass
class MovieInfo:
    """Basic movie information from search/browse results"""
    title: str
    url: str
    year: Optional[int] = None
    rating: Optional[float] = None

@dataclass
class MovieDetails:
    """Complete movie information from detail page"""
    title: str
    year: Optional[int]
    director: Optional[str]
    genre: Optional[str]
    rating_kp: Optional[float]
    rating_imdb: Optional[float]
    description: Optional[str]
    poster_url: Optional[str]
    torrents: List[TorrentInfo]
    source_url: str

BASE_URL = "https://kinorush.name"

def get_session():
    """Create a session with proper headers"""
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
    })
    return session

def is_series(url: str, title: str) -> bool:
    """
    Detect if content is a TV series
    
    Args:
        url: URL of the content
        title: Title of the content
        
    Returns:
        True if it's a series, False if it's a movie
    """
    # Check URL pattern
    if "/serials/" in url:
        return True
    
    # Check title for series indicators
    series_keywords = ["(сериал", "сериал)", "сезон"]
    title_lower = title.lower()
    for keyword in series_keywords:
        if keyword in title_lower:
            return True
    
    return False

def parse_size_to_gb(size_str: str) -> float:
    """
    Parse size string like "5.92 GB" or "1.46 GB" to float
    
    Args:
        size_str: Size string from torrent table
        
    Returns:
        Size in GB as float, or 0 if parsing fails
    """
    try:
        size_str = size_str.strip().upper()
        
        # Extract number
        match = re.search(r'(\d+\.?\d*)', size_str)
        if not match:
            return 0.0
        
        number = float(match.group(1))
        
        # Convert to GB
        if 'TB' in size_str or 'ТБ' in size_str:
            return number * 1024
        elif 'GB' in size_str or 'ГБ' in size_str:
            return number
        elif 'MB' in size_str or 'МБ' in size_str:
            return number / 1024
        else:
            return number  # Assume GB if no unit
            
    except Exception:
        return 0.0

def filter_by_size(torrents: List[TorrentInfo], min_gb: float = 3.0) -> List[TorrentInfo]:
    """
    Filter torrents by minimum size
    
    Args:
        torrents: List of torrent info objects
        min_gb: Minimum size in GB
        
    Returns:
        Filtered list of torrents
    """
    return [t for t in torrents if t.size_gb >= min_gb]

def search_movies_by_genre(genre: str, min_year: int = None, min_rating: float = None, page: int = 1) -> List[MovieInfo]:
    """
    Search for movies by genre
    
    Args:
        genre: Genre name in Russian (e.g., "Фантастика", "Боевик")
        min_year: Minimum year filter (optional)
        min_rating: Minimum rating filter (optional)
        page: Page number for pagination
        
    Returns:
        List of MovieInfo objects
    """
    session = get_session()
    movies = []
    
    try:
        # Construct search URL
        # For genre search: /xfsearch/zhanr/{genre}/
        genre_url = f"{BASE_URL}/xfsearch/zhanr/{genre.lower()}/"
        if page > 1:
            genre_url += f"page/{page}/"
        
        response = session.get(genre_url, timeout=15, verify=False)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find movie items (adjust selectors based on actual HTML structure)
        # Looking for movie cards/items
        movie_items = soup.find_all('div', class_='movie-item') or soup.find_all('article', class_='short')
        
        if not movie_items:
            # Try alternative selectors
            movie_items = soup.find_all('div', class_='short')
        
        for item in movie_items:
            try:
                # Extract title and URL
                title_link = item.find('a', class_='short-title') or item.find('h2').find('a') or item.find('a')
                if not title_link:
                    continue
                
                title = title_link.get_text(strip=True)
                url = title_link.get('href', '')
                
                # Make URL absolute
                if url and not url.startswith('http'):
                    url = BASE_URL + url
                
                # Skip series
                if is_series(url, title):
                    continue
                
                # Extract year if available
                year = None
                year_match = re.search(r'(\d{4})', title)
                if year_match:
                    year = int(year_match.group(1))
                
                # Apply year filter
                if min_year and year and year < min_year:
                    continue
                
                # Extract rating if available (will be more accurate from detail page)
                rating = None
                rating_elem = item.find('div', class_='rate-kp') or item.find('span', class_='rating')
                if rating_elem:
                    rating_text = rating_elem.get_text(strip=True)
                    rating_match = re.search(r'(\d+\.?\d*)', rating_text)
                    if rating_match:
                        rating = float(rating_match.group(1))
                
                # Apply rating filter
                if min_rating and rating and rating < min_rating:
                    continue
                
                movies.append(MovieInfo(
                    title=title,
                    url=url,
                    year=year,
                    rating=rating
                ))
                
            except Exception as e:
                print(f"Error parsing movie item: {e}")
                continue
        
    except Exception as e:
        print(f"Error searching movies: {e}")
    
    return movies

def get_movie_details(movie_url: str) -> Optional[MovieDetails]:
    """
    Extract full movie details from movie page
    
    Args:
        movie_url: URL of the movie detail page
        
    Returns:
        MovieDetails object or None if extraction fails
    """
    session = get_session()
    
    try:
        response = session.get(movie_url, timeout=15, verify=False)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Extract title
        title = ""
        title_elem = soup.find('h1')
        if title_elem:
            title = title_elem.get_text(strip=True)
        
        # Extract year
        year = None
        year_link = soup.find('a', href=re.compile(r'/xfsearch/year/'))
        if year_link:
            year_text = year_link.get_text(strip=True)
            year_match = re.search(r'(\d{4})', year_text)
            if year_match:
                year = int(year_match.group(1))
        
        # Extract director
        director = None
        director_elem = soup.find('div', attrs={'itemprop': 'director'})
        if director_elem:
            # Get all text from links or just text
            director_links = director_elem.find_all('a')
            if director_links:
                director = ', '.join([link.get_text(strip=True) for link in director_links])
            else:
                director = director_elem.get_text(strip=True)
        if not director:
            # Fallback to old method
            director_elem = soup.find(string=re.compile(r'Режиссер:'))
            if director_elem:
                director = director_elem.parent.get_text().replace('Режиссер:', '').strip()
        
        # Extract genre
        genre = None
        # Look for genre links (e.g., /xfsearch/zhanr/...)
        genre_links = soup.find_all('a', href=re.compile(r'/xfsearch/zhanr/'))
        if genre_links:
            genres = [link.get_text(strip=True) for link in genre_links[:3]]  # Get first 3 genres
            genre = ', '.join(genres)
        
        if not genre:
            # Fallback to old method
            genre_elem = soup.find(string=re.compile(r'Жанр:'))
            if genre_elem:
                genre = genre_elem.parent.get_text().replace('Жанр:', '').strip()
        
        # Extract ratings
        rating_kp = None
        rating_kp_elem = soup.find('div', class_='r-kp')  # Fixed: was 'rate-kp'
        if rating_kp_elem:
            kp_text = rating_kp_elem.get_text(strip=True)
            kp_match = re.search(r'(\d+\.?\d*)', kp_text)
            if kp_match:
                rating_kp = float(kp_match.group(1))
        
        rating_imdb = None
        rating_imdb_elem = soup.find('div', class_='r-imdb')  # Fixed: was 'rate-imdb'
        if rating_imdb_elem:
            imdb_text = rating_imdb_elem.get_text(strip=True)
            imdb_match = re.search(r'(\d+\.?\d*)', imdb_text)
            if imdb_match:
                rating_imdb = float(imdb_match.group(1))
        
        # Extract description
        description = None
        desc_elem = soup.find('div', class_='page__text full-text clearfix', attrs={'itemprop': 'description'})
        if not desc_elem:
            # Fallback to old selector
            desc_elem = soup.find('div', class_='ftext')
        if desc_elem:
            description = desc_elem.get_text(strip=True)
        
        # Extract poster
        poster_url = None
        poster_elem = soup.find('div', class_='pmovie__poster')
        if not poster_elem:
            # Fallback to old selector
            poster_elem = soup.find('div', class_='fposter')
        if poster_elem:
            img = poster_elem.find('img')
            if img:
                poster_url = img.get('src', '')
                if poster_url and not poster_url.startswith('http'):
                    poster_url = BASE_URL + poster_url
        
        # Extract torrents (they are in div containers, not a table)
        torrents = []
        torrent_items = soup.find_all('div', class_='full_links-torrent')
        for item in torrent_items:
            try:
                # Get quality
                quality_elem = item.find('span', class_='quality')
                quality = quality_elem.get_text(strip=True) if quality_elem else "Unknown"
                
                # Get translation
                translate_elem = item.find('div', class_='full_links-translate')
                translation = ""
                if translate_elem:
                    p_elem = translate_elem.find('p')
                    translation = p_elem.get_text(strip=True) if p_elem else ""
                
                # Get size (in flex-basis: 15% div)
                size_divs = item.find_all('div', style=re.compile(r'flex-basis.*15%'))
                size_str = ""
                if size_divs:
                    p_elem = size_divs[0].find('p')
                    size_str = p_elem.get_text(strip=True) if p_elem else "0 GB"
                size_gb = parse_size_to_gb(size_str)
                
                # Get download link
                download_link = item.find('a', href=re.compile(r'do=download'))
                if download_link:
                    download_url = download_link.get('href', '')
                    if download_url and not download_url.startswith('http'):
                        download_url = BASE_URL + download_url
                    
                    torrents.append(TorrentInfo(
                        quality=quality,
                        translation=translation,
                        size_gb=size_gb,
                        download_url=download_url
                    ))
            except Exception as e:
                print(f"Error parsing torrent item: {e}")
                continue
        
        return MovieDetails(
            title=title,
            year=year,
            director=director,
            genre=genre,
            rating_kp=rating_kp,
            rating_imdb=rating_imdb,
            description=description,
            poster_url=poster_url,
            torrents=torrents,
            source_url=movie_url
        )
        
    except Exception as e:
        print(f"Error getting movie details from {movie_url}: {e}")
        return None

def search_films_page(page: int = 1) -> List[MovieInfo]:
    """
    Browse films page directly
    
    Args:
        page: Page number
        
    Returns:
        List of MovieInfo objects
    """
    session = get_session()
    movies = []
    
    try:
        url = f"{BASE_URL}/films/"
        if page > 1:
            url += f"page/{page}/"
        
        response = session.get(url, timeout=15, verify=False)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find all links in films section
        links = soup.find_all('a', href=re.compile(r'/films/\d+'))
        
        for link in links:
            try:
                title = link.get_text(strip=True)
                url = link.get('href', '')
                
                if not title or not url:
                    continue
                
                # Make URL absolute
                if not url.startswith('http'):
                    url = BASE_URL + url
                
                # Skip if already added
                if any(m.url == url for m in movies):
                    continue
                
                # Extract year from title
                year = None
                year_match = re.search(r'(\d{4})', title)
                if year_match:
                    year = int(year_match.group(1))
                
                movies.append(MovieInfo(
                    title=title,
                    url=url,
                    year=year
                ))
                
            except Exception:
                continue
        
    except Exception as e:
        print(f"Error browsing films page: {e}")
    
    return movies
