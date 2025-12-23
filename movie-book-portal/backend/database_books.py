# database_books.py
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL_BOOKS = "sqlite:///./books.db"  # Отдельный файл!

engine_books = create_engine(DATABASE_URL_BOOKS, connect_args={"check_same_thread": False})
SessionLocalBooks = sessionmaker(autocommit=False, autoflush=False, bind=engine_books)

BaseBooks = declarative_base()

class Book(BaseBooks):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    author = Column(String)
    year = Column(Integer)
    genre = Column(String)
    rating = Column(Float)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    thumbnail_path = Column(String, nullable=True)
    total_pages = Column(Integer, default=1)

def get_db_books():
    db = SessionLocalBooks()
    try:
        yield db
    finally:
        db.close()


def create_books_tables():
    BaseBooks.metadata.create_all(bind=engine_books)


def add_sample_books_data():
    db = next(get_db_books())
    try:
        if not db.query(Book).first():
            db.add(Book(title="1984", year=1949, author="George Orwell", genre="Dystopian", rating=9.0))
            db.add(Book(title="To Kill a Mockingbird", year=1960, author="Harper Lee", genre="Fiction", rating=8.5))
        db.commit()
    finally:
        db.close()


