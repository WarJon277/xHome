// API Wrapper for React Frontend
// Ported from legacy api.js

const API_BASE = '/api'; // Proxied by Vite to http://localhost:5055/api

// Configuration
export const API_TIMEOUT = 10000; // 10 seconds default timeout to accommodate slower mobile networks

// Helper to get or create a unique Device ID
function getDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}

// Wraps fetch to handle errors consistently with timeout support
async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;

    // Add User-ID header to all requests
    const headers = {
        'X-User-Id': getDeviceId(),
        ...(options.headers || {})
    };

    // Create AbortController for timeout
    const controller = new AbortController();

    // IF EXPLICITLY OFFLINE: Fail fast immediately
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const offlineError = new Error('Browser is offline');
        offlineError.isNetworkError = true;
        offlineError.isTimeout = true;
        return Promise.reject(offlineError);
    }

    const timeoutId = setTimeout(() => controller.abort(), options.timeout || API_TIMEOUT);

    try {
        // Support custom AbortSignal or use timeout controller
        const fetchOptions = {
            ...options,
            headers,
            signal: options.signal || controller.signal
        };

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            let detail = errorBody.detail || `HTTP Error ${response.status}`;
            if (typeof detail === 'object') {
                detail = JSON.stringify(detail);
            }
            const error = new Error(detail);
            error.isServerError = true;
            error.statusCode = response.status;
            throw error;
        }
        return response.json();
    } catch (error) {
        clearTimeout(timeoutId);

        // Classify error type
        if (error.name === 'AbortError') {
            const timeoutError = new Error('Connection timeout - server not responding');
            timeoutError.isTimeout = true;
            timeoutError.isNetworkError = true;
            throw timeoutError;
        }

        if (error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError') ||
            error.message.includes('content-length mismatch') ||
            error.name === 'TypeError') {
            error.isNetworkError = true;
            console.warn('[API] Treated as network/fetch error:', error.message);
        }

        throw error;
    }
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
export const deleteMovie = (id) => request(`/movies/${id}`, { method: 'DELETE' });
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
export const fetchEpisode = (id) => request(`/episodes/${id}`);

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
export const deleteBook = (id) => request(`/books/${id}`, { method: 'DELETE' });
export const searchBooks = (query) => request(`/books/search?query=${encodeURIComponent(query)}`);

// --- AUDIOBOOKS ---
export const fetchAudiobooks = () => request('/audiobooks');
export const fetchAudiobook = (id) => request(`/audiobooks/${id}`);
export const fetchAudiobookTracks = (id) => request(`/audiobooks/${id}/tracks`);
export const createAudiobook = (data) => request('/audiobooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const updateAudiobook = (id, data) => request(`/audiobooks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const deleteAudiobook = (id) => request(`/audiobooks/${id}`, { method: 'DELETE' });
export const uploadAudiobookFile = (audiobookId, file, onProgress) =>
    uploadFile(`/audiobooks/${audiobookId}/upload`, file, 'file', {}, onProgress);
export const uploadAudiobookThumbnail = (audiobookId, file, onProgress) =>
    uploadFile(`/audiobooks/${audiobookId}/thumbnail`, file, 'file', {}, onProgress);

// --- AUDIOBOOKS SOURCES ---
export const searchAudioboo = (q, options = {}) => request(`/audiobooks-source/audioboo-search?q=${encodeURIComponent(q)}`, options);
export const fetchAudiobooDetails = (url, options = {}) => request(`/audiobooks-source/audioboo-fetch?url=${encodeURIComponent(url)}`, options);
export const downloadFromAudioboo = (data) => request('/audiobooks-source/download-audioboo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const searchFlibustaaudiobooks = (q) => request(`/audiobooks-source/flibusta-search?q=${encodeURIComponent(q)}`);
export const downloadFromFlibusta = (data) => request('/audiobooks-source/download-flibusta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});

export const fetchBookPage = async (bookId, page) => {
    const url = `${API_BASE}/books/${bookId}/page/${page}`;
    const headers = { 'X-User-Id': getDeviceId() };

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
        const response = await fetch(url, {
            headers,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(errorBody.detail || `HTTP Error ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('image')) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            return {
                content: `<div style="display:flex;justify-content:center;"><img src="${imageUrl}" style="max-width:100%;height:auto;box-shadow:0 4px 6px rgba(0,0,0,0.1);" /></div>`,
                total: 0
            };
        }
        return response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            const timeoutError = new Error('Page request timeout');
            timeoutError.isTimeout = true;
            timeoutError.isNetworkError = true;
            throw timeoutError;
        }
        if (error.message.includes('Failed to fetch')) {
            error.isNetworkError = true;
        }
        throw error;
    }
};


// --- GALLERY ---
export const fetchPhotos = (folder = "") => request(`/gallery?folder=${encodeURIComponent(folder)}`, { timeout: 15000 });
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

// --- VIDEOGALLERY ---
export const fetchVideos = (folder = "") => request(`/videogallery/?folder=${encodeURIComponent(folder)}`, { timeout: 15000 });
export const createVideoFolder = (data) => request('/videogallery/folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const deleteVideo = (path) => request(`/videogallery/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
export const deleteVideoFolder = (folderPath) => request(`/videogallery/folder?path=${encodeURIComponent(folderPath)}`, { method: 'DELETE' });
export const renameVideoFolder = (folderPath, newName) => request('/videogallery/rename_folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: folderPath, newName: newName })
});

// --- KALEIDOSCOPES ---
export const fetchKaleidoscopes = () => request('/kaleidoscopes/');
export const fetchKaleidoscope = (id) => request(`/kaleidoscopes/${id}`);
export const createKaleidoscope = (data) => request('/kaleidoscopes/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
export const updateKaleidoscope = (id, data) => request(`/kaleidoscopes/${id}`, {
    method: 'PUT',
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

export const uploadVideoToFolder = (folder, file, onProgress) =>
    uploadFile(`/videogallery/upload`, file, 'file', { folder }, onProgress);

export const moveVideo = (videoPath, targetFolder) => {
    const formData = new FormData();
    const targetFolderValue = typeof targetFolder === 'object' ? (targetFolder.path || '') : (targetFolder || '');
    formData.append('video_path', videoPath || '');
    formData.append('target_folder', targetFolderValue);
    return fetch(`${API_BASE}/videogallery/move`, { method: 'POST', body: formData }).then(r => r.json());
};

export const moveVideoFolder = (folderPath, targetFolder) => {
    const formData = new FormData();
    const folderPathValue = typeof folderPath === 'object' ? (folderPath.path || '') : (folderPath || '');
    const targetFolderValue = typeof targetFolder === 'object' ? (targetFolder.path || '') : (targetFolder || '');
    formData.append('folder_path', folderPathValue);
    formData.append('target_folder', targetFolderValue);
    return fetch(`${API_BASE}/videogallery/move_folder`, { method: 'POST', body: formData }).then(r => r.json());
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
export const fetchLatestProgress = (itemType) => request(`/progress/latest/${itemType}`);
export const saveProgress = (itemType, itemId, seconds, scrollRatio = 0, trackIndex = 0) => request('/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        item_type: itemType,
        item_id: itemId,
        progress_seconds: seconds,
        scroll_ratio: scrollRatio,
        track_index: trackIndex
    })
});
export const clearProgress = () => request('/progress/clear', { method: 'DELETE' });
// --- DASHBOARD ---
export const fetchDashboardData = () => request('/dashboard');

// --- FLIBUSTA ---
export const searchFlibusta = (q) => request(`/flibusta/search?q=${encodeURIComponent(q)}`);
export const downloadFlibustaBook = (data) => request('/flibusta/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
});
// --- DISCOVERY ---
// --- DISCOVERY ---
export const fetchSuggestion = (type, genre) => request(`/discovery/suggest?ctype=${type}&genre=${encodeURIComponent(genre)}`);
// DISCOVERY
export async function fetchBrowse(ctype, genre, provider = 'flibusta', options = {}) {
    try {
        let url = `/discovery/browse?ctype=${ctype}&genre=${encodeURIComponent(genre)}&provider=${provider}`;
        if (options.refresh) {
            url += '&refresh=true';
        }
        return await request(url, { timeout: 15000, ...options });
    } catch (e) {
        console.error("Browse error", e);
        throw e;
    }
}

export async function fetchSearch(query, provider = 'flibusta', options = {}) {
    try {
        const url = `/discovery/search?query=${encodeURIComponent(query)}&provider=${provider}`;
        console.log("fetchSearch calling:", { url, query, provider });
        const result = await request(url, { timeout: 15000, ...options });
        console.log("fetchSearch result:", result);
        return result;
    } catch (e) {
        console.error("Search error:", e);
        throw e;
    }
}

export async function fetchDetails(bookId, provider = 'flibusta', options = {}) {
    try {
        return await request(`/discovery/details?book_id=${bookId}&provider=${provider}`, options);
    } catch (e) {
        if (e.name !== 'AbortError') {
            console.error("Details error", e);
        }
        return null;
    }
}

export async function fetchCover(bookId, options = {}) {
    try {
        return await request(`/discovery/cover?book_id=${bookId}`, options);
    } catch (e) {
        return null;
    }
}

// --- REQUESTS (Предложка) ---
export const searchRequests = (query, type = 'all', options = {}) =>
    request(`/requests/search?query=${encodeURIComponent(query)}&type=${type}`, { timeout: 20000, ...options });

export const fetchRequestDetails = (id, type, options = {}) =>
    request(`/requests/details?id=${encodeURIComponent(id)}&type=${type}`, { timeout: 15000, ...options });

export const downloadRequest = (data) => request('/requests/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    timeout: 10000
});

export const fetchDownloadStatus = (options = {}) =>
    request('/requests/status', { timeout: 5000, ...options });

