from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./progress.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class PlaybackProgress(Base):
    __tablename__ = "playback_progress"

    id = Column(Integer, primary_key=True, index=True)
    item_type = Column(String, index=True) # 'movie', 'episode'
    item_id = Column(Integer, index=True)
    progress_seconds = Column(Float, default=0.0)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def get_db_progress():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_progress_tables():
    Base.metadata.create_all(bind=engine)
