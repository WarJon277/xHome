#!/bin/bash
# Audiobooks API Examples

# ============================================
# 1. LIST ALL AUDIOBOOKS
# ============================================
curl -X GET http://localhost:8000/api/audiobooks

# List by genre
curl -X GET "http://localhost:8000/api/audiobooks?genre=Фантастика"

# ============================================
# 2. CREATE AUDIOBOOK ENTRY
# ============================================
curl -X POST http://localhost:8000/api/audiobooks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Война и мир",
    "author": "Лев Толстой",
    "narrator": "Иван Иванов",
    "year": 1869,
    "genre": "Литература",
    "rating": 9.5,
    "description": "Легендарный роман о войне 1812 года"
  }'

# ============================================
# 3. GET AUDIOBOOK DETAILS
# ============================================
curl -X GET http://localhost:8000/api/audiobooks/1

# ============================================
# 4. UPDATE AUDIOBOOK
# ============================================
curl -X PUT http://localhost:8000/api/audiobooks/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Война и мир",
    "author": "Лев Толстой",
    "narrator": "Константин Петров",
    "year": 1869,
    "genre": "Литература",
    "rating": 9.8,
    "description": "Легендарный роман о войне 1812 года (обновлено)"
  }'

# ============================================
# 5. UPLOAD AUDIO FILE
# ============================================
curl -X POST http://localhost:8000/api/audiobooks/1/upload \
  -F "file=@/path/to/audiobook.mp3"

# Example with local file:
curl -X POST http://localhost:8000/api/audiobooks/1/upload \
  -F "file=@./my_audiobook.m4b"

# ============================================
# 6. UPLOAD THUMBNAIL
# ============================================
curl -X POST http://localhost:8000/api/audiobooks/1/thumbnail \
  -F "file=@/path/to/cover.jpg"

# ============================================
# 7. SEARCH AUDIOBOO
# ============================================
curl -X GET "http://localhost:8000/api/audiobooks-source/audioboo-search?q=Война%20и%20мир"

# ============================================
# 8. SEARCH FLIBUSTA
# ============================================
curl -X GET "http://localhost:8000/api/audiobooks-source/flibusta-search?q=Война%20и%20мир"

# ============================================
# 9. FETCH AUDIOBOO DETAILS
# ============================================
curl -X GET "http://localhost:8000/api/audiobooks-source/audioboo-fetch?url=https://audioboo.org/lffr/110587-verhovceva-polina-salon-pobrej-drakona.html"

# ============================================
# 10. DOWNLOAD FROM AUDIOBOO
# ============================================
curl -X POST http://localhost:8000/api/audiobooks-source/download-audioboo \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Салон По-среди Дракона",
    "author": "Полина Верховцева",
    "download_url": "https://example.com/audiobook.mp3",
    "image_url": "https://example.com/cover.jpg",
    "genre": "Фантастика",
    "description": "Интересная аудиокнига"
  }'

# ============================================
# 11. DOWNLOAD FROM FLIBUSTA
# ============================================
curl -X POST http://localhost:8000/api/audiobooks-source/download-flibusta \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Война и мир",
    "author": "Лев Толстой",
    "download_url": "https://flibusta.is/download/epub",
    "image_url": "https://flibusta.is/cover.jpg",
    "genre": "Литература",
    "description": "Классический роман"
  }'

# ============================================
# 12. DELETE AUDIOBOOK
# ============================================
curl -X DELETE http://localhost:8000/api/audiobooks/1

# ============================================
# COMPLETE WORKFLOW EXAMPLE
# ============================================

# Step 1: Create audiobook entry
RESPONSE=$(curl -s -X POST http://localhost:8000/api/audiobooks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Преступление и наказание",
    "author": "Федор Достоевский",
    "year": 1866,
    "genre": "Литература",
    "rating": 9.3
  }')

# Extract ID from response (requires jq)
# AUDIOBOOK_ID=$(echo $RESPONSE | jq '.id')

# Or manually set ID:
AUDIOBOOK_ID=2

# Step 2: Upload audio file
curl -X POST http://localhost:8000/api/audiobooks/$AUDIOBOOK_ID/upload \
  -F "file=@./crime_and_punishment.mp3"

# Step 3: Upload cover
curl -X POST http://localhost:8000/api/audiobooks/$AUDIOBOOK_ID/thumbnail \
  -F "file=@./dostoyevsky_cover.jpg"

# Step 4: Verify
curl -X GET http://localhost:8000/api/audiobooks/$AUDIOBOOK_ID

# ============================================
# TESTING SEARCHES
# ============================================

# Search for various authors on Audioboo
echo "Searching Audioboo for 'Толстой'..."
curl -s "http://localhost:8000/api/audiobooks-source/audioboo-search?q=Толстой" | python -m json.tool

# Search Flibusta
echo "Searching Flibusta for 'Достоевский'..."
curl -s "http://localhost:8000/api/audiobooks-source/flibusta-search?q=Достоевский" | python -m json.tool

# ============================================
# FILTERING AND PAGINATION
# ============================================

# Get all audiobooks by genre
curl -X GET "http://localhost:8000/api/audiobooks?genre=Фантастика"

# Get all audiobooks by genre (multiple queries)
curl -X GET "http://localhost:8000/api/audiobooks?genre=Детектив"

# ============================================
# BATCH OPERATIONS
# ============================================

# Create multiple audiobooks from a file
cat <<EOF > audiobooks_batch.json
[
  {
    "title": "Мастер и Маргарита",
    "author": "Михаил Булгаков",
    "narrator": "Алексей Борисов",
    "year": 1966,
    "genre": "Литература",
    "rating": 9.8,
    "description": "Шедевр советской литературы"
  },
  {
    "title": "Судьба человека",
    "author": "Михаил Шолохов",
    "year": 1956,
    "genre": "Литература",
    "rating": 9.1,
    "description": "Рассказ о судьбе советского человека"
  }
]
EOF

# Process each audiobook
cat audiobooks_batch.json | python -c "
import sys, json, requests
data = json.load(sys.stdin)
for book in data:
    resp = requests.post('http://localhost:8000/api/audiobooks', json=book)
    print(f'Created: {book[\"title\"]} (ID: {resp.json().get(\"id\")})')
"

# ============================================
# ERROR HANDLING
# ============================================

# Test with invalid data
curl -X POST http://localhost:8000/api/audiobooks \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 400 Bad Request - missing required fields

# Test getting non-existent audiobook
curl -X GET http://localhost:8000/api/audiobooks/99999

# Expected: 404 Not Found

# ============================================
# NOTE: Replace localhost:8000 with your server address if different
# ============================================
