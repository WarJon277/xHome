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
    item_type = Column(String, index=True) # 'movie', 'episode', 'book'
    item_id = Column(Integer, index=True)
    progress_seconds = Column(Float, default=0.0) # For books, this is the page number
    scroll_ratio = Column(Float, default=0.0) # Scroll position on page (0.0 to 1.0)
    track_index = Column(Integer, default=0) # For audiobooks (multi-file)
    user_id = Column(String, index=True, default="global") # Unique Device ID
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def get_db_progress():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_progress_tables():
    Base.metadata.create_all(bind=engine)
    # Ensure columns exist (for existing databases)
    with engine.connect() as conn:
        from sqlalchemy import text
        try:
            conn.execute(text("ALTER TABLE playback_progress ADD COLUMN scroll_ratio FLOAT DEFAULT 0.0"))
            conn.commit()
        except Exception:
            pass
        
        try:
            conn.execute(text("ALTER TABLE playback_progress ADD COLUMN user_id VARCHAR DEFAULT 'global'"))
            conn.execute(text("CREATE INDEX ix_playback_progress_user_id ON playback_progress (user_id)"))
            conn.commit()
        except Exception:
            pass

        try:
            conn.execute(text("ALTER TABLE playback_progress ADD COLUMN track_index INTEGER DEFAULT 0"))
            conn.commit()
        except Exception:
            pass

        try:
            conn.execute(text("ALTER TABLE playback_progress ADD COLUMN last_updated DATETIME"))
            conn.execute(text("UPDATE playback_progress SET last_updated = CURRENT_TIMESTAMP WHERE last_updated IS NULL"))
            conn.commit()
        except Exception:
            pass
