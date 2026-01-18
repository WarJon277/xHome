from database import get_db as get_db_movies
from database_books import get_db_books
from database_tvshows import get_db_tvshows
from database_gallery import get_db_gallery
from database_audiobooks import get_db_audiobooks

def get_db():
    yield from get_db_movies()

def get_db_books_simple():
    db = next(get_db_books())
    try:
        yield db
    finally:
        db.close()

def get_db_tvshows_simple():
    db = next(get_db_tvshows())
    try:
        yield db
    finally:
        db.close()

def get_db_gallery_simple():
    db = next(get_db_gallery())
    try:
        yield db
    finally:
        db.close()

def get_db_audiobooks_simple():
    db = next(get_db_audiobooks())
    try:
        yield db
    finally:
        db.close()
