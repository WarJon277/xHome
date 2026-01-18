// audiobooks.js - Frontend logic for audiobooks management
let currentSource = null;
let currentSourceType = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadAudiobooks();
    setupEventListeners();
    loadGenres();
});

// Setup Event Listeners
function setupEventListeners() {
    // Navigation
    document.getElementById('show-add')?.addEventListener('click', () => showForm());
    document.getElementById('show-view')?.addEventListener('click', () => showList());
    document.getElementById('back-to-list')?.addEventListener('click', () => showList());
    
    // Form submission
    document.getElementById('audiobook-form')?.addEventListener('submit', (e) => handleFormSubmit(e));
    
    // Source buttons
    document.querySelectorAll('.source-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            selectSource(e.target.dataset.source);
        });
    });
    
    // Search button
    document.getElementById('search-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        performSearch();
    });
    
    // Genre filter
    document.getElementById('genre-filter')?.addEventListener('change', (e) => {
        filterByGenre(e.target.value);
    });
    
    // Menu toggle
    setupMenuToggle();
    
    // Search in header
    document.getElementById('audiobook-search')?.addEventListener('input', (e) => {
        searchAudiobooks(e.target.value);
    });
}

function setupMenuToggle() {
    const toggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('dropdown-menu');
    if (toggle && menu) {
        toggle.addEventListener('click', () => {
            menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
        });
    }
}

// Select source type
function selectSource(source) {
    currentSourceType = source;
    const uploadContainer = document.getElementById('file-upload-container');
    const searchForm = document.getElementById('search-form');
    
    if (source === 'manual') {
        uploadContainer.style.display = 'block';
        searchForm.style.display = 'none';
    } else {
        uploadContainer.style.display = 'none';
        searchForm.style.display = 'flex';
        currentSource = source;
    }
}

// Perform search on Flibusta or Audioboo
async function performSearch() {
    const query = document.getElementById('search-query')?.value;
    if (!query) {
        alert('Введите поисковый запрос');
        return;
    }
    
    try {
        const resultsDiv = document.getElementById('search-results');
        resultsDiv.innerHTML = '<p>Поиск...</p>';
        
        let results = [];
        if (currentSource === 'flibusta') {
            const response = await fetch(`/api/audiobooks-source/flibusta-search?q=${encodeURIComponent(query)}`);
            results = await response.json();
        } else if (currentSource === 'audioboo') {
            const response = await fetch(`/api/audiobooks-source/audioboo-search?q=${encodeURIComponent(query)}`);
            results = await response.json();
        }
        
        displaySearchResults(results);
    } catch (error) {
        console.error('Ошибка поиска:', error);
        document.getElementById('search-results').innerHTML = `<p style="color: red;">Ошибка: ${error.message}</p>`;
    }
}

// Display search results
function displaySearchResults(results) {
    const resultsDiv = document.getElementById('search-results');
    
    if (!results || results.length === 0) {
        resultsDiv.innerHTML = '<p>Ничего не найдено</p>';
        return;
    }
    
    resultsDiv.innerHTML = results.map((item, idx) => `
        <div style="background: var(--bg-tertiary, #333); padding: 10px; margin: 5px 0; border-radius: 4px; cursor: pointer;" 
             onclick="selectResult(${idx})">
            <strong>${item.title}</strong>
            <p style="margin: 5px 0; color: #999;">Автор: ${item.author}</p>
            ${item.description ? `<p style="margin: 5px 0; color: #999; font-size: 12px;">${item.description.substring(0, 100)}...</p>` : ''}
            <span class="source-badge ${item.source}">${item.source}</span>
        </div>
    `).join('');
    
    window.searchResults = results;
}

// Select result from search
async function selectResult(index) {
    const result = window.searchResults[index];
    
    // Fill in basic info
    document.getElementById('title').value = result.title;
    document.getElementById('author').value = result.author;
    document.getElementById('genre').value = result.genres || '';
    document.getElementById('description').value = result.description || '';
    
    // Get more details if from Audioboo
    if (currentSource === 'audioboo' && result.link) {
        try {
            const response = await fetch(`/api/audiobooks-source/audioboo-fetch?url=${encodeURIComponent(result.link)}`);
            const details = await response.json();
            document.getElementById('narrator').value = details.narrator || '';
            window.selectedResult = { ...result, ...details };
        } catch (error) {
            console.error('Ошибка получения деталей:', error);
            window.selectedResult = result;
        }
    } else {
        window.selectedResult = result;
    }
    
    // Hide search form
    document.getElementById('search-form').style.display = 'none';
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('title').value;
    const author = document.getElementById('author').value;
    const narrator = document.getElementById('narrator').value;
    const year = parseInt(document.getElementById('year').value) || new Date().getFullYear();
    const genre = document.getElementById('genre').value;
    const rating = parseFloat(document.getElementById('rating').value) || 0;
    const description = document.getElementById('description').value;
    const file = document.getElementById('file').files[0];
    const thumbnail = document.getElementById('thumbnail').files[0];
    
    try {
        let audiobook = {
            title,
            author,
            narrator,
            year,
            genre,
            rating,
            description
        };
        
        // If manual upload
        if (currentSourceType === 'manual' || !currentSourceType) {
            const response = await fetch('/api/audiobooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(audiobook)
            });
            
            const created = await response.json();
            
            // Upload audio file if provided
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                await fetch(`/api/audiobooks/${created.id}/upload`, {
                    method: 'POST',
                    body: formData
                });
            }
            
            // Upload thumbnail if provided
            if (thumbnail) {
                const formData = new FormData();
                formData.append('file', thumbnail);
                await fetch(`/api/audiobooks/${created.id}/thumbnail`, {
                    method: 'POST',
                    body: formData
                });
            }
        } else if (currentSource === 'flibusta' && window.selectedResult) {
            const result = window.selectedResult;
            const response = await fetch('/api/audiobooks-source/download-flibusta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    author,
                    download_url: result.links?.epub || result.links?.fb2 || result.links?.mobi,
                    image_url: result.image,
                    genre,
                    description
                })
            });
            
            if (!response.ok) throw new Error('Ошибка загрузки с Флибусты');
        } else if (currentSource === 'audioboo' && window.selectedResult) {
            const result = window.selectedResult;
            const response = await fetch('/api/audiobooks-source/download-audioboo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    author,
                    download_url: result.download_link || result.link,
                    image_url: result.image,
                    genre,
                    description
                })
            });
            
            if (!response.ok) throw new Error('Ошибка загрузки с Audioboo');
        }
        
        alert('Аудиокнига успешно добавлена!');
        document.getElementById('audiobook-form').reset();
        currentSourceType = null;
        currentSource = null;
        window.selectedResult = null;
        showList();
        loadAudiobooks();
    } catch (error) {
        console.error('Ошибка:', error);
        alert(`Ошибка: ${error.message}`);
    }
}

// Load audiobooks
async function loadAudiobooks() {
    try {
        const response = await fetch('/api/audiobooks');
        const audiobooks = await response.json();
        displayAudiobooks(audiobooks);
    } catch (error) {
        console.error('Ошибка загрузки аудиокниг:', error);
        document.getElementById('audiobooks-container').innerHTML = 
            `<p style="color: red;">Ошибка загрузки: ${error.message}</p>`;
    }
}

// Display audiobooks
function displayAudiobooks(audiobooks) {
    const container = document.getElementById('audiobooks-container');
    
    if (!audiobooks || audiobooks.length === 0) {
        container.innerHTML = '<p>Нет добавленных аудиокниг</p>';
        return;
    }
    
    container.innerHTML = audiobooks.map(book => `
        <div class="audiobook-card" onclick="showDetails(${book.id})">
            <div class="audiobook-thumbnail">
                ${book.thumbnail_path ? 
                    `<img src="/uploads/${book.thumbnail_path}" alt="${book.title}">` : 
                    `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: var(--bg-tertiary, #333); color: var(--text-secondary, #999); font-size: 14px; padding: 10px; text-align: center;">Нет обложки</div>`
                }
            </div>
            <div class="audiobook-info">
                <h3>${book.title}</h3>
                <p><strong>${book.author}</strong></p>
                ${book.narrator ? `<p>Диктор: ${book.narrator}</p>` : ''}
                <p>${book.genre}</p>
                ${book.rating > 0 ? `<p>⭐ ${book.rating}</p>` : ''}
                <span class="source-badge ${book.source || 'manual'}">${book.source || 'Загружено вручную'}</span>
            </div>
        </div>
    `).join('');
}

// Show audiobook details
async function showDetails(id) {
    try {
        const response = await fetch(`/api/audiobooks/${id}`);
        const book = await response.json();
        
        const content = document.getElementById('details-content');
        content.innerHTML = `
            <div style="display: grid; grid-template-columns: 300px 1fr; gap: 30px;">
                <div>
                    <div class="audiobook-thumbnail">
                        ${book.thumbnail_path ? 
                            `<img src="/uploads/${book.thumbnail_path}" alt="${book.title}">` : 
                            `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: var(--bg-tertiary, #333); color: var(--text-secondary, #999);">Нет обложки</div>`
                        }
                    </div>
                    ${book.file_path ? `
                        <div class="audiobook-player">
                            <audio controls style="width: 100%;">
                                <source src="/uploads/${book.file_path}" type="audio/mpeg">
                                Ваш браузер не поддерживает воспроизведение аудио.
                            </audio>
                        </div>
                    ` : ''}
                    <button class="btn" style="width: 100%; margin-top: 10px;" onclick="deleteAudiobook(${book.id})">Удалить</button>
                </div>
                <div>
                    <h2>${book.title}</h2>
                    <p><strong>Автор:</strong> ${book.author}</p>
                    ${book.narrator ? `<p><strong>Диктор:</strong> ${book.narrator}</p>` : ''}
                    <p><strong>Год:</strong> ${book.year}</p>
                    <p><strong>Жанр:</strong> ${book.genre}</p>
                    ${book.rating > 0 ? `<p><strong>Рейтинг:</strong> ⭐ ${book.rating}</p>` : ''}
                    <p><strong>Источник:</strong> <span class="source-badge ${book.source || 'manual'}">${book.source || 'Загружено вручную'}</span></p>
                    ${book.description ? `
                        <h3>Описание</h3>
                        <p>${book.description}</p>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.getElementById('item-details').style.display = 'block';
        document.getElementById('view-list').style.display = 'none';
        document.getElementById('add-form').style.display = 'none';
    } catch (error) {
        console.error('Ошибка:', error);
        alert(`Ошибка загрузки: ${error.message}`);
    }
}

// Delete audiobook
async function deleteAudiobook(id) {
    if (!confirm('Вы уверены, что хотите удалить эту аудиокнигу?')) return;
    
    try {
        await fetch(`/api/audiobooks/${id}`, { method: 'DELETE' });
        alert('Аудиокнига удалена');
        showList();
        loadAudiobooks();
    } catch (error) {
        console.error('Ошибка:', error);
        alert(`Ошибка: ${error.message}`);
    }
}

// Search audiobooks
function searchAudiobooks(query) {
    const cards = document.querySelectorAll('.audiobook-card');
    cards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        const author = card.querySelector('p strong')?.textContent.toLowerCase() || '';
        const visible = title.includes(query.toLowerCase()) || author.includes(query.toLowerCase());
        card.parentElement.style.display = visible ? 'block' : 'none';
    });
}

// Filter by genre
async function filterByGenre(genre) {
    try {
        const response = await fetch(`/api/audiobooks${genre ? `?genre=${encodeURIComponent(genre)}` : ''}`);
        const audiobooks = await response.json();
        displayAudiobooks(audiobooks);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// Load genres for dropdown
async function loadGenres() {
    try {
        const response = await fetch('/api/audiobooks');
        const audiobooks = await response.json();
        const genres = [...new Set(audiobooks.map(b => b.genre).filter(g => g))];
        
        const select = document.getElementById('genre-filter');
        if (select) {
            genres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre;
                option.textContent = genre;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки жанров:', error);
    }
}

// UI Control Functions
function showForm() {
    document.getElementById('add-form').style.display = 'block';
    document.getElementById('view-list').style.display = 'none';
    document.getElementById('item-details').style.display = 'none';
    document.getElementById('file-upload-container').style.display = 'block';
    document.getElementById('search-form').style.display = 'none';
    currentSourceType = null;
    currentSource = null;
}

function showList() {
    document.getElementById('add-form').style.display = 'none';
    document.getElementById('view-list').style.display = 'block';
    document.getElementById('item-details').style.display = 'none';
}
