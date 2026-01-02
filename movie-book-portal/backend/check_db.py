import sqlite3
import os

def check_db(db_path, table_name):
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute(f"SELECT id, title, thumbnail_path FROM {table_name} LIMIT 10")
        rows = cursor.fetchall()
        print(f"\nContents of {table_name} in {db_path}:")
        for row in rows:
            print(row)
    except Exception as e:
        print(f"Error checking {table_name}: {e}")
    finally:
        conn.close()

# Check main DB (movies)
check_db("media_portal.db", "movies")
# Check books DB
check_db("books.db", "books")
# Check gallery DB
check_db("gallery.db", "photos")
