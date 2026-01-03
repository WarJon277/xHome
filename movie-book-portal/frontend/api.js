const API_BASE = window.location.origin;

export async function fetchMovies() {
    const response = await fetch(`${API_BASE}/movies`);
    return response.json();
}

export async function fetchBooks() {
    const response = await fetch(`${API_BASE}/books`);
    return response.json();
}

export async function fetchTvshows() {
    const response = await fetch(`${API_BASE}/tvshows`);
    return response.json();
}

export async function fetchMovie(id) {
    const response = await fetch(`${API_BASE}/movies/${id}`);
    return response.json();
}

export async function fetchTvshow(id) {
    const response = await fetch(`${API_BASE}/tvshows/${id}`);
    return response.json();
}

export async function fetchBook(id) {
    const response = await fetch(`${API_BASE}/books/${id}`);
    return response.json();
}

export async function createMovie(data) {
    const response = await fetch(`${API_BASE}/movies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

export async function createTvshow(data) {
    const response = await fetch(`${API_BASE}/tvshows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

export async function uploadMovieThumbnail(movieId, file) {
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

export async function uploadTvshowThumbnail(tvshowId, file) {
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

        xhr.open('POST', `${API_BASE}/tvshows/${tvshowId}/upload_thumbnail`);
        xhr.send(formData);
    });
}

export async function uploadMovieFile(movieId, file, onProgress) {
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

export async function uploadTvshowFile(tvshowId, file, onProgress) {
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

        xhr.open('POST', `${API_BASE}/tvshows/${tvshowId}/upload`);
        xhr.send(formData);
    });
}

export async function createBook(data) {
    const response = await fetch(`${API_BASE}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

export async function deleteTvshow(id) {
    await fetch(`${API_BASE}/tvshows/${id}`, { method: 'DELETE' });
}

export async function deleteMovie(id) {
    await fetch(`${API_BASE}/movies/${id}`, { method: 'DELETE' });
}

export async function deleteBook(id) {
    await fetch(`${API_BASE}/books/${id}`, { method: 'DELETE' });
}

export async function searchTvshows(query) {
    const response = await fetch(`${API_BASE}/tvshows/search?query=${encodeURIComponent(query)}`);
    return response.json();
}

export async function searchMovies(query) {
    const response = await fetch(`${API_BASE}/movies/search?query=${encodeURIComponent(query)}`);
    return response.json();
}

export async function createEpisode(data) {
    const response = await fetch(`${API_BASE}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

export async function uploadEpisodeFile(episodeId, file) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response);
                } catch (e) {
                    reject(new Error('Ошибка при обработке ответа сервера'));
                }
            } else {
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    reject(new Error(errorData.detail || `Ошибка при загрузке файла эпизода: ${xhr.status}`));
                } catch (e) {
                    reject(new Error(`Ошибка при загрузке файла эпизода: ${xhr.status}`));
                }
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Ошибка сети при загрузке файла эпизода'));
        });

        xhr.addEventListener('timeout', () => {
            reject(new Error('Таймаут при загрузке файла эпизода'));
        });

        xhr.open('POST', `${API_BASE}/episodes/${episodeId}/upload`);
        xhr.send(formData);
    });
}

export async function updateTvshow(id, data) {
    const response = await fetch(`${API_BASE}/tvshows/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

export async function updateMovie(id, data) {
    const response = await fetch(`${API_BASE}/movies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

export async function updateBook(id, data) {
    const response = await fetch(`${API_BASE}/books/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

export async function searchBooks(query) {
    const response = await fetch(`${API_BASE}/books/search?query=${encodeURIComponent(query)}`);
    return response.json();
}

export async function fetchEpisodes(tvshowId, season = null) {
    let url = `${API_BASE}/episodes?tvshow_id=${tvshowId}`;
    if (season) {
        url += `&season=${season}`;
    }
    const response = await fetch(url);
    return response.json();
}

export async function updateEpisode(id, data) {
    const response = await fetch(`${API_BASE}/episodes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

export async function deleteEpisode(id) {
    const response = await fetch(`${API_BASE}/episodes/${id}`, { method: 'DELETE' });
    return response.json();
}

// Функция для получения ID сериала по названию
export async function getTvshowIdByName(name) {
    try {
        const tvshows = await fetchTvshows();
        const tvshow = tvshows.find(show => show.title === name);
        return tvshow ? tvshow.id : null;
    } catch (error) {
        console.error('Ошибка при получении ID сериала по названию:', error);
        throw error;
    }
}

// === ГАЛЕРЕЯ ФОТО ===

export async function fetchPhotos(folder = "") {
    const url = `${API_BASE}/gallery?folder=${encodeURIComponent(folder)}`;
    const response = await fetch(url);
    return response.json();
}

export async function fetchPhoto(id) {
    const response = await fetch(`${API_BASE}/gallery/${id}`);
    return response.json();
}

export async function createPhoto(data) {
    // Create folder in the gallery
    const response = await fetch(`${API_BASE}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

export async function updatePhoto(id, data) {
    throw new Error("Updating photos by ID is no longer supported in directory-based system");
}

export async function deletePhoto(id) {
    const response = await fetch(`${API_BASE}/gallery/${id}`, { method: 'DELETE' });
    return response.json();
}

export async function uploadPhotoFile(photoId, file, onProgress) {
    throw new Error("Uploading photos by ID is no longer supported in directory-based system. Use uploadPhotoToFolder instead.");
}

export async function uploadPhotoToFolder(folder, file, onProgress) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('folder', folder);
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                onProgress(percentComplete);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response);
                } catch (e) {
                    reject(new Error('Ошибка при обработке ответа сервера'));
                }
            } else {
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    reject(new Error(errorData.detail || `Ошибка при загрузке файла фото: ${xhr.status}`));
                } catch (e) {
                    reject(new Error(`Ошибка при загрузке файла фото: ${xhr.status}`));
                }
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Ошибка сети при загрузке файла фото'));
        });

        xhr.addEventListener('timeout', () => {
            reject(new Error('Таймаут при загрузке файла фото'));
        });

        xhr.open('POST', `${API_BASE}/gallery/upload_to_folder`);
        xhr.send(formData);
    });
}

export async function uploadPhotoThumbnail(photoId, file) {
    throw new Error("Uploading thumbnails by ID is no longer supported in directory-based system.");
}

export async function applyPhotoFilter(photoId, filterType) {
    const response = await fetch(`${API_BASE}/gallery/${photoId}/apply_filter?filter_type=${encodeURIComponent(filterType)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
}

export async function movePhoto(photoPath, targetFolder) {
    const formData = new FormData();
    const photoPathValue = photoPath || '';
    const targetFolderValue = typeof targetFolder === 'object' ? (targetFolder.path || '') : (targetFolder || '');
    
    formData.append('photo_path', photoPathValue);
    formData.append('target_folder', targetFolderValue);

    const response = await fetch(`${API_BASE}/gallery/move_photo`, {
        method: 'POST',
        body: formData
    });
    return response.json();
}

export async function moveFolder(folderPath, targetFolder) {
    const formData = new FormData();
    const folderPathValue = typeof folderPath === 'object' ? (folderPath.path || '') : (folderPath || '');
    const targetFolderValue = typeof targetFolder === 'object' ? (targetFolder.path || '') : (targetFolder || '');
    
    formData.append('folder_path', folderPathValue);
    formData.append('target_folder', targetFolderValue);

    const response = await fetch(`${API_BASE}/gallery/move_folder`, {
        method: 'POST',
        body: formData
    });
    return response.json();
}

export async function deleteFolder(folderPath) {
    const response = await fetch(`${API_BASE}/gallery/manage/folder_delete?path=${encodeURIComponent(folderPath)}`, {
        method: 'DELETE'
    });
    return response.json();
}

export async function searchPhotos(query) {
    const response = await fetch(`${API_BASE}/gallery/search?query=${encodeURIComponent(query)}`);
    return response.json();
}