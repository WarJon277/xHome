
import sys
import os
import requests

# Add the backend directory to sys.path
backend_dir = r"c:\Users\xxar\xHomePortal\movie-book-portal\backend"
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from routers.audiobooks_source import fetch_audioboo_details, session
import json

def test_download():
    url = "https://audioboo.org/biogr/101007-rej-polina-byvshie-na-otkaz-u-tebja-net-prava.html"
    print(f"Fetching details for: {url}")
    
    details = fetch_audioboo_details(url)
    print("\nParsed Details:")
    print(json.dumps(details, indent=2, ensure_ascii=False))
    
    dl_url = details.get('download_link')
    if not dl_url:
        print("\nFAILED: Still no download link.")
        return

    print(f"\nSUCCESS: Download Link Found: {dl_url}")
    
    # Try to verify if link is accessible
    try:
        print(f"Checking link accessibility...")
        headers = {'Referer': 'https://audioboo.org/'}
        resp = session.get(dl_url, stream=True, timeout=15, headers=headers)
        print(f"Status: {resp.status_code}")
        if resp.status_code in [200, 302]:
            print("Link is alive!")
        else:
            print(f"Link returned status {resp.status_code}")
    except Exception as e:
        print(f"Error checking link: {e}")

if __name__ == "__main__":
    test_download()
