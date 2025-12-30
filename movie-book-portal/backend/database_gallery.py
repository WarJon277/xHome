# database_gallery.py
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL_GALLERY = "sqlite:///./gallery.db"  # Отдельный файл!

engine_gallery = create_engine(DATABASE_URL_GALLERY, connect_args={"check_same_thread": False})
SessionLocalGallery = sessionmaker(autocommit=False, autoflush=False, bind=engine_gallery)

BaseGallery = declarative_base()

class Photo(BaseGallery):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=True)  # Путь к файлу изображения
    thumbnail_path = Column(String, nullable=True)  # Путь к миниатюре
    upload_date = Column(DateTime, default=datetime.utcnow)
    category = Column(String, default="general")  # Категория фото

def get_db_gallery():
    db = SessionLocalGallery()
    try:
        yield db
    finally:
        db.close()


def create_gallery_tables():
    BaseGallery.metadata.create_all(bind=engine_gallery)


def add_sample_gallery_data():
    db = next(get_db_gallery())
    try:
        if not db.query(Photo).first():
            db.add(Photo(title="Пример фото 1", description="Описание первого примера фото", category="general"))
            db.add(Photo(title="Пример фото 2", description="Описание второго примера фото", category="vacation"))
        db.commit()
    finally:
        db.close()