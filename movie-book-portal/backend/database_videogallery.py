# database_videogallery.py
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL_VIDEOGALLERY = f"sqlite:///{os.path.join(BASE_DIR, 'videogallery.db')}"

engine_videogallery = create_engine(DATABASE_URL_VIDEOGALLERY, connect_args={"check_same_thread": False})
SessionLocalVideoGallery = sessionmaker(autocommit=False, autoflush=False, bind=engine_videogallery)

BaseVideoGallery = declarative_base()

class Video(BaseVideoGallery):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=True)  # Путь к файлу видео
    thumbnail_path = Column(String, nullable=True)  # Путь к миниатюре
    upload_date = Column(DateTime, default=datetime.utcnow)
    category = Column(String, default="general")  # Категория видео

def get_db_videogallery():
    db = SessionLocalVideoGallery()
    try:
        yield db
    finally:
        db.close()


def create_videogallery_tables():
    BaseVideoGallery.metadata.create_all(bind=engine_videogallery)
