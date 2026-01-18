# database_audiobooks.py
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL_AUDIOBOOKS = "sqlite:///./audiobooks.db"

engine_audiobooks = create_engine(DATABASE_URL_AUDIOBOOKS, connect_args={"check_same_thread": False})
SessionLocalAudiobooks = sessionmaker(autocommit=False, autoflush=False, bind=engine_audiobooks)

BaseAudiobooks = declarative_base()

class Audiobook(BaseAudiobooks):
    __tablename__ = "audiobooks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    author = Column(String)
    narrator = Column(String, nullable=True)
    year = Column(Integer)
    genre = Column(String)
    rating = Column(Float)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    thumbnail_path = Column(String, nullable=True)
    duration = Column(Integer, default=0)  # Duration in seconds
    source = Column(String, nullable=True)  # Source: flibusta, audioboo, manual, etc.

def get_db_audiobooks():
    db = SessionLocalAudiobooks()
    try:
        yield db
    finally:
        db.close()


def create_audiobooks_tables():
    BaseAudiobooks.metadata.create_all(bind=engine_audiobooks)


def add_sample_audiobooks_data():
    db = next(get_db_audiobooks())
    try:
        if not db.query(Audiobook).first():
            db.add(Audiobook(
                title="1984", 
                year=1949, 
                author="George Orwell",
                narrator="Unknown",
                genre="Dystopian", 
                rating=9.0,
                source="manual"
            ))
            db.add(Audiobook(
                title="To Kill a Mockingbird", 
                year=1960, 
                author="Harper Lee",
                narrator="Unknown",
                genre="Fiction", 
                rating=8.5,
                source="manual"
            ))
        db.commit()
    finally:
        db.close()
