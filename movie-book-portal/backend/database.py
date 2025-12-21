from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./media_portal.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Movie(Base):
    __tablename__ = "movies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    year = Column(Integer)
    director = Column(String)
    genre = Column(String)
    rating = Column(Float)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    thumbnail_path = Column(String, nullable=True)

class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    author = Column(String)
    year = Column(Integer)
    genre = Column(String)
    rating = Column(Float)
    description = Column(String, nullable=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    Base.metadata.create_all(bind=engine)

def add_sample_data():
    db = SessionLocal()
    if not db.query(Movie).first():
        db.add(Movie(title="Inception", year=2010, director="Christopher Nolan", genre="Sci-Fi", rating=8.8))
        db.add(Movie(title="The Shawshank Redemption", year=1994, director="Frank Darabont", genre="Drama", rating=9.3))
    if not db.query(Book).first():
        db.add(Book(title="1984", year=1949, author="George Orwell", genre="Dystopian", rating=9.0))
        db.add(Book(title="To Kill a Mockingbird", year=1960, author="Harper Lee", genre="Fiction", rating=8.5))
    db.commit()
    db.close()