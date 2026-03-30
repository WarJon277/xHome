from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'media_portal.db')}"

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

class Settings(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(String)

from sqlalchemy import DateTime
import datetime
class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    sender_name = Column(String, nullable=True)
    sender_ip = Column(String)
    message = Column(String)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class AccessLog(Base):
    __tablename__ = "access_logs"
    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String, index=True)
    client_name = Column(String, nullable=True)
    connect_time = Column(DateTime, default=datetime.datetime.utcnow)
    disconnect_time = Column(DateTime, nullable=True)
    duration = Column(Integer, nullable=True)

class AppVersion(Base):
    __tablename__ = "app_versions"
    id = Column(Integer, primary_key=True, index=True)
    version_code = Column(Integer, unique=True, index=True)
    version_name = Column(String)
    release_notes = Column(String, nullable=True)
    apk_path = Column(String)
    is_mandatory = Column(Integer, default=0) # 0 for false, 1 for true
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

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