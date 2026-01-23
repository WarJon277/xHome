from fastapi import APIRouter, Depends, HTTPException, Query
import requests
import feedparser
from bs4 import BeautifulSoup
import os
import shutil
from sqlalchemy.orm import Session
from database_books import Book, get_db_books
from dependencies import get_db_books_simple
import uuid

router = APIRouter(prefix="/flibusta", tags=["flibusta"])

# Using a mirror that is often available. Can be changed by user if needed.
# Note: flibusta.is often needs Tor or Proxy. mirrors like flibusta.site or flibusta.app might work.
FLIBUSTA_BASE_URL = os.environ.get("FLIBUSTA_URL", "http://flibusta.is")
OPDS_URL = f"{FLIBUSTA_BASE_URL}/opds"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOKS_UPLOADS = os.path.join(BASE_DIR, "uploads", "books")

@router.get("/search")
def search_flibusta(q: str = Query(..., min_length=2)):
    """Search for books on Flibusta via OPDS"""
    search_url = f"{OPDS_URL}/search?searchType=books&searchTerm={requests.utils.quote(q)}"
    
    try:
        response = requests.get(search_url, timeout=15)
        response.raise_for_status()
        
        feed = feedparser.parse(response.content)
        results = []
        
        for entry in feed.entries:
            # Extract links
            links = {}
            for link in entry.links:
                rel = link.get('rel', '')
                type_ = link.get('type', '')
                href = link.get('href', '')
                
                # Image/Thumbnail
                if 'image' in type_ or 'thumbnail' in rel:
                    links['image'] = href if href.startswith('http') else f"{FLIBUSTA_BASE_URL}{href}"
                
                # Download link (EPUB Only)
                if 'epub' in type_:
                    links['epub'] = href if href.startswith('http') else f"{FLIBUSTA_BASE_URL}{href}"

            # Only add if we have BOTH EPUB download link AND image
            if 'epub' in links and 'image' in links:
                results.append({
                    "id": entry.id.split('/')[-1] if 'id' in entry else str(uuid.uuid4()),
                    "title": entry.title,
                    "author": entry.author if 'author' in entry else "Неизвестен",
                    "description": BeautifulSoup(entry.summary, "html.parser").get_text() if 'summary' in entry else "",
                    "image": links.get('image'),
                    "links": links
                })
        
        return results
    except Exception as e:
        print(f"Flibusta search error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при поиске на Флибусте: {str(e)}")

@router.post("/download")
async def download_from_flibusta(
    title: str,
    author: str,
    download_url: str,
    image_url: str = None,
    db: Session = Depends(get_db_books_simple)
):
    """Download a book from Flibusta and add to library"""
    try:
        # 1. Download the book file
        response = requests.get(download_url, timeout=30, stream=True)
        response.raise_for_status()
        
        # Determine filename and extension
        ext = ".epub" 
        
        # Get filename from headers if possible
        cd = response.headers.get('content-disposition')
        if cd and 'filename=' in cd:
            filename = cd.split('filename=')[-1].strip('"')
        else:
            filename = f"{title}_{author}{ext}".replace(" ", "_")
        
        safe_filename = "".join([c for c in filename if c.isalnum() or c in "._-"]).strip()
        file_save_path = os.path.join(BOOKS_UPLOADS, safe_filename)
        
        os.makedirs(BOOKS_UPLOADS, exist_ok=True)
        
        with open(file_save_path, 'wb') as f:
            shutil.copyfileobj(response.raw, f)
            
        # 2. Download thumbnail
        thumb_rel_path = None
        if image_url:
            try:
                img_res = requests.get(image_url, timeout=10)
                if img_res.status_code == 200:
                    img_ext = os.path.splitext(image_url)[1] or ".jpg"
                    if "?" in img_ext: img_ext = img_ext.split("?")[0]
                    
                    thumb_filename = f"thumb_{os.path.splitext(safe_filename)[0]}{img_ext}"
                    thumb_full_path = os.path.join(BOOKS_UPLOADS, thumb_filename)
                    
                    with open(thumb_full_path, 'wb') as f:
                        f.write(img_res.content)
                    
                    thumb_rel_path = f"uploads/books/{thumb_filename}"
            except Exception as ei:
                print(f"Thumbnail download failed: {ei}")

        # NEW: Mandatory cover check
        if not thumb_rel_path:
            # Clean up book file if cover failed
            if os.path.exists(file_save_path):
                os.remove(file_save_path)
            raise HTTPException(status_code=400, detail="Не удалось загрузить обложку. Загрузка отменена.")

        # 3. Add to Database
        db_book = Book(
            title=title,
            author=author,
            description=f"Загружено с Флибусты. {title}",
            file_path=f"uploads/books/{safe_filename}",
            thumbnail_path=thumb_rel_path,
            year=0, 
            genre="Загруженное",
            total_pages=0, # Default for manual add if unknown
            rating=0.0
        )
        
        db.add(db_book)
        db.commit()
        db.refresh(db_book)
        
        return {"status": "success", "book_id": db_book.id, "title": db_book.title}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Flibusta download error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке: {str(e)}")
