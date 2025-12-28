import { state } from './state.js';
import { fetchEpisodes, createEpisode, uploadEpisodeFile } from './api.js';

export function updateFormLabels() {
    const isMovie = state.currentCategory === 'movie';
    const isTvshow = state.currentCategory === 'tvshow';

    document.getElementById('file-label-text').textContent =
        isMovie || isTvshow ? 'Файл видео' : 'Файл книги (PDF, DjVu, CBZ, EPUB)';

    document.getElementById('director-author').placeholder =
        isMovie || isTvshow ? 'Режиссёр' : 'Автор';

    document.getElementById('thumbnail-upload-container').style.display =
            isMovie ? 'block' : 'block'; // можно скрыть для книг, если хотите
    
        // Для сериалов скрываем основное поле загрузки файла и показываем загрузку эпизодов
        document.getElementById('file-upload-container').style.display =
            isTvshow ? 'none' : 'block';
        document.getElementById('episodes-upload-container').style.display =
            isTvshow ? 'block' : 'none';

        document.getElementById('file').accept = isMovie || isTvshow
            ? 'video/*,.mp4,.avi,.mov,.mkv,.wmv,.flv,.webm'
            : '.pdf,.djvu,.djv,.cbz,.zip,.epub';
}

export function updateFileInfo() {
    const file = document.getElementById('file').files[0];
    document.getElementById('file-info').textContent = file ? `Выбран: ${file.name}` : '';
}

export function updateThumbnailInfo() {
    const file = document.getElementById('thumbnail').files[0];
    document.getElementById('thumbnail-info').textContent = file ? `Выбрана: ${file.name}` : '';
}

export function updateEpisodesInfo() {
    const files = document.getElementById('episodes').files;
    if (files.length > 0) {
        const fileNames = Array.from(files).map(f => f.name).join(', ');
        document.getElementById('episodes-info').textContent = `Выбрано эпизодов: ${files.length} (${fileNames})`;
    } else {
        document.getElementById('episodes-info').textContent = '';
    }
}

export function updateProgress(percent) {
    const bar = document.getElementById('progress');
    const text = document.getElementById('progress-text');
    document.getElementById('progress-container').style.display = 'block';
    bar.style.width = percent + '%';
    text.textContent = percent + '%';
}

export function hideProgress() {
    document.getElementById('progress-container').style.display = 'none';
}

export function showLoading(show = true) {
    const el = document.getElementById('loading-message');
    if (el) el.style.display = show ? 'block' : 'none';
}

export function showError(message) {
    const el = document.getElementById('error-message');
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
}

export function escapeHtml(text) {
    const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

export function truncateDescription(text, maxLength = 100) {
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

export async function uploadFile(endpoint, file, onProgress) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', endpoint);

        xhr.upload.onprogress = e => {
            if (e.lengthComputable && onProgress) {
                const percent = Math.round((e.loaded / e.total) * 100);
                onProgress(percent);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
            } else {
                reject(new Error('Ошибка загрузки файла'));
            }
        };

        xhr.onerror = () => reject(new Error('Сетевая ошибка'));
        xhr.send(formData);
    });
}

// Загрузка нескольких эпизодов
export async function uploadEpisodes(tvshowId, files, seasonNumber, startEpisodeNumber, onProgress) {
    const totalFiles = files.length;
    let uploadedCount = 0;
    
    for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const episodeNumber = startEpisodeNumber + i;
            
            // Проверяем, существует ли уже эпизод с таким номером в этом сезоне
            try {
                const existingEpisodes = await fetchEpisodes(tvshowId, seasonNumber);
                const existingEpisode = existingEpisodes.find(ep => ep.season_number === seasonNumber && ep.episode_number === episodeNumber);
                
                let episode;
                if (existingEpisode) {
                    // Если эпизод уже существует, обновляем его файл
                    episode = existingEpisode;
                    // Загружаем новый файл для существующего эпизода
                    await uploadEpisodeFile(episode.id, file);
                } else {
                    // Если эпизода не существует, создаем новый
                    const episodeData = {
                        tvshow_id: tvshowId,
                        season_number: seasonNumber,
                        episode_number: episodeNumber,
                        title: `Эпизод ${episodeNumber}`
                    };
                    
                    episode = await createEpisode(episodeData);
                    // Загружаем файл для нового эпизода
                    await uploadEpisodeFile(episode.id, file);
                }
                
                uploadedCount++;
                
                // Обновляем прогресс
                const progress = 50 + (uploadedCount / totalFiles) * 50;
                onProgress(progress);
            } catch (error) {
                console.error(`Ошибка при обработке эпизода ${episodeNumber}:`, error);
                throw new Error(`Ошибка при обработке эпизода ${episodeNumber}: ${error.message}`);
            }
        }
        // Убедимся, что прогресс достигает 100% после завершения
        onProgress(100);
}