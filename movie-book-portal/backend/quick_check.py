from database_books import SessionLocalBooks, Book
from database_audiobooks import SessionLocalAudiobooks, Audiobook

def check():
    db_books = SessionLocalBooks()
    db_audio = SessionLocalAudiobooks()
    try:
        books_count = db_books.query(Book).count()
        audio_count = db_audio.query(Audiobook).count()
        last_book = db_books.query(Book).order_by(Book.id.desc()).first()
        last_audio = db_audio.query(Audiobook).order_by(Audiobook.id.desc()).first()
        
        print(f"Books count: {books_count}")
        if last_book:
            print(f"Last book: {last_book.title} (ID: {last_book.id})")
        
        print(f"Audiobooks count: {audio_count}")
        if last_audio:
            print(f"Last audiobook: {last_audio.title} (ID: {last_audio.id})")
    finally:
        db_books.close()
        db_audio.close()

if __name__ == "__main__":
    check()
