import urllib.request
import urllib.error

try:
    with urllib.request.urlopen("http://localhost:5055/api/progress/latest/book") as response:
        print(f"Status Code: {response.status}")
        print(f"Response Body: {response.read().decode('utf-8')}")
except urllib.error.HTTPError as e:
    print(f"Status Code: {e.code}")
    print(f"Response Body: {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")
