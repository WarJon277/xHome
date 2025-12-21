const API_BASE = window.location.origin;

async function fetchMovies() {
    const response = await fetch(`${API_BASE}/movies`);
    return response.json();
}

async function fetchBooks() {
    const response = await fetch(`${API_BASE}/books`);
    return response.json();
}

async function fetchMovie(id) {
    const response = await fetch(`${API_BASE}/movies/${id}`);
    return response.json();
}

async function fetchBook(id) {
    const response = await fetch(`${API_BASE}/books/${id}`);
    return response.json();
}

async function createMovie(data) {
    const response = await fetch(`${API_BASE}/movies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

async function uploadMovieThumbnail(movieId, file) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const xhr = new XMLHttpRequest();
        
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                const errorData = JSON.parse(xhr.responseText);
                reject(new Error(errorData.detail || 'Ошибка при загрузке миниатюры'));
            }
        });
        
        xhr.addEventListener('error', () => {
            reject(new Error('Ошибка сети при загрузке миниатюры'));
        });
        
        xhr.open('POST', `${API_BASE}/movies/${movieId}/upload_thumbnail`);
        xhr.send(formData);
    });
}

async function uploadMovieFile(movieId, file, onProgress) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                const percentComplete = Math.round((e.loaded / e.total) * 10);
                onProgress(percentComplete);
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                const errorData = JSON.parse(xhr.responseText);
                reject(new Error(errorData.detail || 'Ошибка при загрузке файла'));
            }
        });
        
        xhr.addEventListener('error', () => {
            reject(new Error('Ошибка сети при загрузке файла'));
        });
        
        xhr.open('POST', `${API_BASE}/movies/${movieId}/upload`);
        xhr.send(formData);
    });
}

async function createBook(data) {
    const response = await fetch(`${API_BASE}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

async function deleteMovie(id) {
    await fetch(`${API_BASE}/movies/${id}`, { method: 'DELETE' });
}

async function deleteBook(id) {
    await fetch(`${API_BASE}/books/${id}`, { method: 'DELETE' });
}

async function searchMovies(query) {
    const response = await fetch(`${API_BASE}/movies/search?query=${encodeURIComponent(query)}`);
    return response.json();
}

async function updateMovie(id, data) {
    const response = await fetch(`${API_BASE}/movies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

async function updateBook(id, data) {
    const response = await fetch(`${API_BASE}/books/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

async function searchBooks(query) {
    const response = await fetch(`${API_BASE}/books/search?query=${encodeURIComponent(query)}`);
    return response.json();
}