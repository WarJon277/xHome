// API Wrapper for React Frontend
// Ported from legacy api.js

const API_BASE = ''; // Proxied by Vite to http://localhost:5055

// Wraps fetch to handle errors consistently
async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, options);
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.detail || `HTTP Error ${response.status}`);
    }
    return response.json();
}

// --- MOVIES ---
export const fetchMovies = () => request('/movies');
export const fetchMovie = (id) => request(`/movies/${id}`);
export const createMovie = (data) => request('/movies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const updateMovie = (id, data) => request(`/movies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const deleteMovie = (id) => fetch(`${API_BASE}/movies/${id}`, { method: 'DELETE' });
export const searchMovies = (query) => request(`/movies/search?query=${encodeURIComponent(query)}`);

// --- TV SHOWS ---
export const fetchTvshows = () => request('/tvshows');
export const fetchTvshow = (id) => request(`/tvshows/${id}`);
export const createTvshow = (data) => request('/tvshows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const updateTvshow = (id, data) => request(`/tvshows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const deleteTvshow = (id) => fetch(`${API_BASE}/tvshows/${id}`, { method: 'DELETE' });
export const searchTvshows = (query) => request(`/tvshows/search?query=${encodeURIComponent(query)}`);

// --- EPISODES ---
export const fetchEpisodes = (tvshowId, season = null) => {
    let url = `/episodes?tvshow_id=${tvshowId}`;
    if (season) url += `&season=${season}`;
    return request(url);
};
export const createEpisode = (data) => request('/episodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const updateEpisode = (id, data) => request(`/episodes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const deleteEpisode = (id) => request(`/episodes/${id}`, { method: 'DELETE' });

// --- BOOKS ---
export const fetchBooks = () => request('/books');
export const fetchBook = (id) => request(`/books/${id}`);
export const createBook = (data) => request('/books', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const updateBook = (id, data) => request(`/books/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const deleteBook = (id) => fetch(`${API_BASE}/books/${id}`, { method: 'DELETE' });
export const searchBooks = (query) => request(`/books/search?query=${encodeURIComponent(query)}`);
export const fetchBookPage = (bookId, page) => request(`/books/${bookId}/page/${page}`);


// --- GALLERY ---
export const fetchPhotos = (folder = "") => request(`/gallery?folder=${encodeURIComponent(folder)}`);
export const fetchPhoto = (id) => request(`/gallery/${id}`);
export const createPhotoFolder = (data) => request('/gallery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const deletePhoto = (id) => request(`/gallery/${id}`, { method: 'DELETE' });
export const deleteFolder = (folderPath) => fetch(`${API_BASE}/gallery/manage/folder_delete?path=${encodeURIComponent(folderPath)}`, { method: 'DELETE' });
export const searchPhotos = (query) => request(`/gallery/search?query=${encodeURIComponent(query)}`);
export const renameFolder = (folderPath, newName) => request('/gallery/rename_folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_path: folderPath, new_name: newName })
});

// --- KALEIDOSCOPES ---
export const fetchKaleidoscopes = () => request('/kaleidoscopes/');
export const fetchKaleidoscope = (id) => request(`/kaleidoscopes/${id}`);
export const createKaleidoscope = (data) => request('/kaleidoscopes/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const deleteKaleidoscope = (id) => fetch(`${API_BASE}/kaleidoscopes/${id}`, { method: 'DELETE' });
export const uploadKaleidoscopeMusic = (file, onProgress) =>
    uploadFile('/kaleidoscopes/upload_music', file, 'file', {}, onProgress);


// --- FILE UPLOADS (Native XHR for Progress) ---
// Kept for compatibility, though React apps often use libraries like logic inside useEffect
export const uploadFile = (url, file, fieldName = 'file', additionalFields = {}, onProgress) => {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append(fieldName, file);
        Object.entries(additionalFields).forEach(([key, val]) => formData.append(key, val));

        const xhr = new XMLHttpRequest();

        if (onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            });
        }

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch {
                    resolve({});
                }
            } else {
                reject(new Error(`Upload failed: ${xhr.status}`));
            }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.open('POST', `${API_BASE}${url}`);
        xhr.send(formData);
    });
};

export const uploadMovieFile = (movieId, file, onProgress) =>
    uploadFile(`/movies/${movieId}/upload`, file, 'file', {}, onProgress);

export const uploadTvshowFile = (tvshowId, file, onProgress) =>
    uploadFile(`/tvshows/${tvshowId}/upload`, file, 'file', {}, onProgress);

export const uploadEpisodeFile = (episodeId, file, onProgress) =>
    uploadFile(`/episodes/${episodeId}/upload`, file, 'file', {}, onProgress);

export const uploadBookFile = (bookId, file, onProgress) =>
    uploadFile(`/books/${bookId}/upload`, file, 'file', {}, onProgress);

export const uploadPhotoToFolder = (folder, file, onProgress) =>
    uploadFile(`/gallery/upload_to_folder`, file, 'file', { folder }, onProgress);

export const movePhoto = (photoPath, targetFolder) => {
    const formData = new FormData();
    const targetFolderValue = typeof targetFolder === 'object' ? (targetFolder.path || '') : (targetFolder || '');
    formData.append('photo_path', photoPath || '');
    formData.append('target_folder', targetFolderValue);
    return fetch(`${API_BASE}/gallery/move_photo`, { method: 'POST', body: formData }).then(r => r.json());
};

export const moveFolder = (folderPath, targetFolder) => {
    const formData = new FormData();
    const folderPathValue = typeof folderPath === 'object' ? (folderPath.path || '') : (folderPath || '');
    const targetFolderValue = typeof targetFolder === 'object' ? (targetFolder.path || '') : (targetFolder || '');
    formData.append('folder_path', folderPathValue);
    formData.append('target_folder', targetFolderValue);
    return fetch(`${API_BASE}/gallery/move_folder`, { method: 'POST', body: formData }).then(r => r.json());
};

// --- SETTINGS / THEME ---
export const fetchTheme = () => request('/admin/theme');
export const updateTheme = (settings) => request('/admin/theme', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings })
});
export const resetTheme = () => request('/admin/theme/reset', { method: 'POST' });
export const fetchStats = () => request('/admin/stats');


// --- PROGRESS ---
export const fetchProgress = (itemType, itemId) => request(`/progress/${itemType}/${itemId}`);
export const saveProgress = (itemType, itemId, seconds) => request('/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        item_type: itemType,
        item_id: itemId,
        progress_seconds: seconds
    })
});
