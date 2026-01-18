# audiobooks_api_examples.ps1
# Audiobooks API Examples for Windows PowerShell

$BASE_URL = "http://localhost:8000"
$API_URL = "$BASE_URL/api"

# ============================================
# 1. LIST ALL AUDIOBOOKS
# ============================================
Write-Host "=== List all audiobooks ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$API_URL/audiobooks" -Method Get | ConvertTo-Json

# List by genre
Write-Host "`n=== List audiobooks by genre (Фантастика) ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$API_URL/audiobooks?genre=Фантастика" -Method Get | ConvertTo-Json

# ============================================
# 2. CREATE AUDIOBOOK ENTRY
# ============================================
Write-Host "`n=== Create new audiobook ===" -ForegroundColor Cyan
$body = @{
    title = "Война и мир"
    author = "Лев Толстой"
    narrator = "Иван Иванов"
    year = 1869
    genre = "Литература"
    rating = 9.5
    description = "Легендарный роман о войне 1812 года"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$API_URL/audiobooks" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body

$response | ConvertTo-Json
$AUDIOBOOK_ID = $response.id
Write-Host "Created audiobook with ID: $AUDIOBOOK_ID" -ForegroundColor Green

# ============================================
# 3. GET AUDIOBOOK DETAILS
# ============================================
Write-Host "`n=== Get audiobook details ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$API_URL/audiobooks/1" -Method Get | ConvertTo-Json

# ============================================
# 4. UPDATE AUDIOBOOK
# ============================================
Write-Host "`n=== Update audiobook ===" -ForegroundColor Cyan
$updateBody = @{
    title = "Война и мир"
    author = "Лев Толстой"
    narrator = "Константин Петров"
    year = 1869
    genre = "Литература"
    rating = 9.8
    description = "Легендарный роман о войне 1812 года (обновлено)"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$API_URL/audiobooks/1" `
    -Method Put `
    -ContentType "application/json" `
    -Body $updateBody | ConvertTo-Json

# ============================================
# 5. UPLOAD AUDIO FILE
# ============================================
Write-Host "`n=== Upload audio file ===" -ForegroundColor Cyan
$audioFile = "C:\path\to\audiobook.mp3"

if (Test-Path $audioFile) {
    $form = @{
        file = Get-Item $audioFile
    }
    
    Invoke-RestMethod -Uri "$API_URL/audiobooks/1/upload" `
        -Method Post `
        -Form $form
    Write-Host "File uploaded successfully" -ForegroundColor Green
} else {
    Write-Host "Audio file not found: $audioFile" -ForegroundColor Red
}

# ============================================
# 6. UPLOAD THUMBNAIL
# ============================================
Write-Host "`n=== Upload thumbnail ===" -ForegroundColor Cyan
$thumbnailFile = "C:\path\to\cover.jpg"

if (Test-Path $thumbnailFile) {
    $form = @{
        file = Get-Item $thumbnailFile
    }
    
    Invoke-RestMethod -Uri "$API_URL/audiobooks/1/thumbnail" `
        -Method Post `
        -Form $form
    Write-Host "Thumbnail uploaded successfully" -ForegroundColor Green
} else {
    Write-Host "Thumbnail file not found: $thumbnailFile" -ForegroundColor Red
}

# ============================================
# 7. SEARCH AUDIOBOO
# ============================================
Write-Host "`n=== Search Audioboo ===" -ForegroundColor Cyan
$searchQuery = [System.Web.HttpUtility]::UrlEncode("Война и мир")
Invoke-RestMethod -Uri "$API_URL/audiobooks-source/audioboo-search?q=$searchQuery" `
    -Method Get | ConvertTo-Json

# ============================================
# 8. SEARCH FLIBUSTA
# ============================================
Write-Host "`n=== Search Flibusta ===" -ForegroundColor Cyan
$searchQuery = [System.Web.HttpUtility]::UrlEncode("Война и мир")
Invoke-RestMethod -Uri "$API_URL/audiobooks-source/flibusta-search?q=$searchQuery" `
    -Method Get | ConvertTo-Json

# ============================================
# 9. FETCH AUDIOBOO DETAILS
# ============================================
Write-Host "`n=== Fetch Audioboo details ===" -ForegroundColor Cyan
$url = "https://audioboo.org/lffr/110587-verhovceva-polina-salon-pobrej-drakona.html"
$encodedUrl = [System.Web.HttpUtility]::UrlEncode($url)
Invoke-RestMethod -Uri "$API_URL/audiobooks-source/audioboo-fetch?url=$encodedUrl" `
    -Method Get | ConvertTo-Json

# ============================================
# 10. DOWNLOAD FROM AUDIOBOO
# ============================================
Write-Host "`n=== Download from Audioboo ===" -ForegroundColor Cyan
$downloadBody = @{
    title = "Салон По-среди Дракона"
    author = "Полина Верховцева"
    download_url = "https://example.com/audiobook.mp3"
    image_url = "https://example.com/cover.jpg"
    genre = "Фантастика"
    description = "Интересная аудиокнига"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$API_URL/audiobooks-source/download-audioboo" `
    -Method Post `
    -ContentType "application/json" `
    -Body $downloadBody | ConvertTo-Json

# ============================================
# 11. DOWNLOAD FROM FLIBUSTA
# ============================================
Write-Host "`n=== Download from Flibusta ===" -ForegroundColor Cyan
$downloadBody = @{
    title = "Война и мир"
    author = "Лев Толстой"
    download_url = "https://flibusta.is/download/epub"
    image_url = "https://flibusta.is/cover.jpg"
    genre = "Литература"
    description = "Классический роман"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$API_URL/audiobooks-source/download-flibusta" `
    -Method Post `
    -ContentType "application/json" `
    -Body $downloadBody | ConvertTo-Json

# ============================================
# 12. DELETE AUDIOBOOK
# ============================================
Write-Host "`n=== Delete audiobook ===" -ForegroundColor Cyan
$confirm = Read-Host "Delete audiobook ID 1? (yes/no)"
if ($confirm -eq "yes") {
    Invoke-RestMethod -Uri "$API_URL/audiobooks/1" -Method Delete | ConvertTo-Json
    Write-Host "Audiobook deleted" -ForegroundColor Green
}

# ============================================
# COMPLETE WORKFLOW EXAMPLE
# ============================================
Write-Host "`n=== Complete Workflow Example ===" -ForegroundColor Yellow

# Step 1: Create audiobook entry
$body = @{
    title = "Преступление и наказание"
    author = "Федор Достоевский"
    year = 1866
    genre = "Литература"
    rating = 9.3
} | ConvertTo-Json

$newAudiobook = Invoke-RestMethod -Uri "$API_URL/audiobooks" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body

$bookId = $newAudiobook.id
Write-Host "Created audiobook with ID: $bookId" -ForegroundColor Green

# Step 2: Upload audio file
$audioFile = "C:\music\crime_and_punishment.mp3"
if (Test-Path $audioFile) {
    $form = @{ file = Get-Item $audioFile }
    Invoke-RestMethod -Uri "$API_URL/audiobooks/$bookId/upload" `
        -Method Post `
        -Form $form
    Write-Host "Audio file uploaded" -ForegroundColor Green
}

# Step 3: Upload cover
$coverFile = "C:\covers\dostoyevsky.jpg"
if (Test-Path $coverFile) {
    $form = @{ file = Get-Item $coverFile }
    Invoke-RestMethod -Uri "$API_URL/audiobooks/$bookId/thumbnail" `
        -Method Post `
        -Form $form
    Write-Host "Cover uploaded" -ForegroundColor Green
}

# Step 4: Verify
Write-Host "Verifying audiobook..."
Invoke-RestMethod -Uri "$API_URL/audiobooks/$bookId" -Method Get | ConvertTo-Json

# ============================================
# USEFUL FUNCTIONS
# ============================================

function Search-Audioboo {
    param([string]$Query)
    $encoded = [System.Web.HttpUtility]::UrlEncode($Query)
    Invoke-RestMethod -Uri "$API_URL/audiobooks-source/audioboo-search?q=$encoded" -Method Get
}

function Search-Flibusta {
    param([string]$Query)
    $encoded = [System.Web.HttpUtility]::UrlEncode($Query)
    Invoke-RestMethod -Uri "$API_URL/audiobooks-source/flibusta-search?q=$encoded" -Method Get
}

function Get-Audiobook {
    param([int]$Id)
    Invoke-RestMethod -Uri "$API_URL/audiobooks/$Id" -Method Get
}

function Remove-Audiobook {
    param([int]$Id)
    Invoke-RestMethod -Uri "$API_URL/audiobooks/$Id" -Method Delete
}

# Example usage:
# $results = Search-Audioboo "Толстой"
# $results | ConvertTo-Json
# Get-Audiobook 1
# Remove-Audiobook 5

Write-Host "`nAPI examples complete!" -ForegroundColor Green
Write-Host "Note: Replace paths and URLs as needed for your environment" -ForegroundColor Yellow
