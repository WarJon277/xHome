import urllib.request
import json
import sys

def test_url(url, name):
    print(f"--- Testing {name} ({url}) ---")
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            status = r.getcode()
            print(f"Status Code: {status}")
            raw = r.read()
            try:
                data = json.loads(raw)
                print(f"JSON Body (Preview): {str(data)[:200]}")
                if isinstance(data, list):
                    print(f"Item Count: {len(data)}")
                return True
            except json.JSONDecodeError:
                print(f"INVALID JSON: {raw[:200]}")
                return False
    except Exception as e:
        print(f"CONNECTION FAILED: {e}")
        return False

# Backend runs on 5055
success_backend = test_url("http://127.0.0.1:5055/api/movies", "Direct Backend")
# Frontend proxy runs on 5050
success_proxy = test_url("http://127.0.0.1:5050/api/movies", "Vite Proxy")

if not success_backend:
    print("\nCRITICAL: Backend is NOT working correctly.")
    sys.exit(1)

if not success_proxy:
    print("\nCRITICAL: Proxy is NOT working, but Backend is.")
    sys.exit(1)

print("\nSUCCESS: Both Backend and Proxy are working.")
