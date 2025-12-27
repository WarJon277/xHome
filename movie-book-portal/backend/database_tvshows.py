# database_tvshows.py
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL_TVSHOWS = "sqlite:///./tvshows.db"  # Отдельный файл!

engine_tvshows = create_engine(DATABASE_URL_TVSHOWS, connect_args={"check_same_thread": False})
SessionLocalTvshows = sessionmaker(autocommit=False, autoflush=False, bind=engine_tvshows)

BaseTvshows = declarative_base()

class Tvshow(BaseTvshows):
    __tablename__ = "tvshows"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    year = Column(Integer)
    director = Column(String)  # Режиссер
    genre = Column(String)
    rating = Column(Float)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=True)  # Путь к файлу сериала (устаревшее поле)
    thumbnail_path = Column(String, nullable=True)  # Путь к миниатюре
    episodes_count = Column(Integer, default=1)  # Количество эпизодов
    season_count = Column(Integer, default=1)  # Количество сезонов
    
    episodes = relationship("Episode", back_populates="tvshow", cascade="all, delete-orphan")


class Episode(BaseTvshows):
    __tablename__ = "episodes"

    id = Column(Integer, primary_key=True, index=True)
    tvshow_id = Column(Integer, ForeignKey("tvshows.id"), nullable=False)  # Ссылка на сериал
    season_number = Column(Integer, nullable=False)  # Номер сезона
    episode_number = Column(Integer, nullable=False)  # Номер эпизода в сезоне
    title = Column(String, nullable=True)  # Название эпизода (опционально)
    file_path = Column(String, nullable=True)  # Путь к файлу эпизода
    description = Column(String, nullable=True)  # Описание эпизода

    tvshow = relationship("Tvshow", back_populates="episodes")


def get_db_tvshows():
    db = SessionLocalTvshows()
    try:
        yield db
    finally:
        db.close()


def create_tvshows_tables():
    BaseTvshows.metadata.create_all(bind=engine_tvshows)


def add_sample_tvshows_data():
    db = next(get_db_tvshows())
    try:
        if not db.query(Tvshow).first():
            db.add(Tvshow(title="Breaking Bad", year=2008, director="Vince Gilligan", genre="Drama", rating=9.5, episodes_count=62, season_count=5))
            db.add(Tvshow(title="Game of Thrones", year=2011, director="David Benioff", genre="Fantasy", rating=9.3, episodes_count=73, season_count=8))
        db.commit()
    finally:
        db.close()