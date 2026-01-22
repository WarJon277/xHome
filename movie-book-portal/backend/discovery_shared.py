import os
import json
import time
import random
import requests
from datetime import datetime
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SETTINGS_FILE = os.path.join(BASE_DIR, "auto_discovery_settings.json")

def log(message, log_file):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    msg = f"[{timestamp}] {message}"
    print(msg)
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception as e:
        print(f"Error writing to log {log_file}: {e}")

def load_settings():
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading settings: {e}")
    
    # Defaults
    return {
        "interval_minutes": 60,
        "enabled": True,
        "genre_priorities": {"Фантастика": 1}
    }

def get_weighted_genre(genre_priorities, genre_mapping):
    genres = list(genre_priorities.keys())
    weights = list(genre_priorities.values())
    if not genres:
        return random.choice(list(genre_mapping.keys()))
    return random.choices(genres, weights=weights, k=1)[0]

def download_file(url, target_path, log_func, referer=None, retries=3):
    """Download a file with retries and robustness"""
    for attempt in range(retries):
        try:
            if attempt > 0:
                time.sleep(random.uniform(2, 5))
            
            log_func(f"Downloading (Attempt {attempt+1}/{retries}) from {url}")
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Connection': 'keep-alive',
            }
            if referer:
                headers['Referer'] = referer
            else:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                headers['Referer'] = f"{parsed.scheme}://{parsed.netloc}/"
            
            session = requests.Session()
            session.trust_env = False
            
            verify_ssl = False
            
            response = session.get(url, stream=True, timeout=30, headers=headers, verify=verify_ssl, allow_redirects=True)
            
            if response.status_code == 403:
                log_func(f"403 Forbidden on {url}. Site might be blocking automated downloads.")
                if referer and attempt == 0:
                    log_func("Retrying without referer...")
                    continue
                if attempt == retries - 1: return False
                continue

            response.raise_for_status()
            
            with open(target_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=16384):
                    if chunk:
                        f.write(chunk)
            log_func(f"Successfully downloaded to {target_path}")
            return True
        except Exception as e:
            log_func(f"Attempt {attempt+1} failed for {url}: {e}")
            if "SSL" in str(e) or "EOF" in str(e):
                 log_func("SSL error detected, will retry with different settings.")
            if attempt == retries - 1:
                return False
    return False
