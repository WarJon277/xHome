
import sys
import os

# Add the backend directory to sys.path
backend_dir = r"c:\Users\xxar\xHomePortal\movie-book-portal\backend"
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from routers.audiobooks_source import search_audioboo, fetch_audioboo_details
import json

def test_specific_book():
    query = "Бывшие. На отказ у тебя нет права"
    print(f"Searching for: {query}")
    results = search_audioboo(query)
    
    if not results:
        print("No results found in search.")
        return

    print(f"Found {len(results)} results.")
    target = results[0]
    print(f"Targeting: {target['title']} ({target['link']})")
    
    details = fetch_audioboo_details(target['link'])
    print("\nParsed Details:")
    print(json.dumps(details, indent=2, ensure_ascii=False))
    
    if details['download_link']:
        print(f"\nDownload Link Found: {details['download_link']}")
    else:
        print("\nFAILED: No download link found.")

if __name__ == "__main__":
    test_specific_book()
