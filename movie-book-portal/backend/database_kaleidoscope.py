# database_kaleidoscope.py
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

DATABASE_URL_KALEIDOSCOPE = "sqlite:///./kaleidoscopes.db"

engine_kaleidoscope = create_engine(DATABASE_URL_KALEIDOSCOPE, connect_args={"check_same_thread": False})
SessionLocalKaleidoscope = sessionmaker(autocommit=False, autoflush=False, bind=engine_kaleidoscope)

BaseKaleidoscope = declarative_base()

class Kaleidoscope(BaseKaleidoscope):
    __tablename__ = "kaleidoscopes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    music_path = Column(String, nullable=True) # Путь к файлу музыки
    cover_path = Column(String, nullable=True) # Обложка
    created_at = Column(DateTime, default=datetime.utcnow)
    
    items = relationship("KaleidoscopeItem", back_populates="kaleidoscope", cascade="all, delete-orphan")

class KaleidoscopeItem(BaseKaleidoscope):
    __tablename__ = "kaleidoscope_items"

    id = Column(Integer, primary_key=True, index=True)
    kaleidoscope_id = Column(Integer, ForeignKey("kaleidoscopes.id"))
    photo_path = Column(String) # Путь к фото
    duration = Column(Float, default=5.0) # Длительность показа в секундах
    order = Column(Integer, default=0) # Порядок показа
    transition_effect = Column(String, default="fade") # Эффект перехода (пока задел на будущее)

    kaleidoscope = relationship("Kaleidoscope", back_populates="items")


def get_db_kaleidoscope():
    db = SessionLocalKaleidoscope()
    try:
        yield db
    finally:
        db.close()

def create_kaleidoscope_tables():
    BaseKaleidoscope.metadata.create_all(bind=engine_kaleidoscope)
