import { state } from './state.js';
import { fetchEpisodes, createEpisode, uploadEpisodeFile } from './api.js';

export function updateFormLabels() {
    const isMovie = state.currentCategory === 'movie';
    const isTvshow = state.currentCategory === 'tvshow';
    const isPhoto = state.currentCategory === 'photo';

    // Проверяем, на какой странице мы находимся
    const isGalleryPage = window.location.pathname.includes('gallery.html');
    
    // Выбираем правильный элемент в зависимости от страницы
    const fileLabelTextElement = document.getElementById('file-label-text');
    const directorAuthorElement = document.getElementById('director-author');
    const fileUploadContainer = document.getElementById('file-upload-container');
    const episodesUploadContainer = document.getElementById('episodes-upload-container');
    const thumbnailUploadContainer = document.getElementById('thumbnail-upload-container');
    const fileInput = document.getElementById('file');

    if (isPhoto && isGalleryPage) {
        // На странице галереи используем элементы для фото
        const photoLabelElement = document.getElementById('file-label-text'); // на странице галереи используем тот же ID
        const photoDescElement = document.getElementById('director-author'); // на странице галереи используем тот же ID
        const photoUploadContainer = document.getElementById('photo-upload-container');
        const photoInput = document.getElementById('photo');

        if (photoLabelElement) photoLabelElement.textContent = 'Фото';
        if (photoDescElement) photoDescElement.placeholder = 'Описание';
        if (photoUploadContainer) photoUploadContainer.style.display = 'block'; // показываем контейнер фото
        if (episodesUploadContainer) episodesUploadContainer.style.display = 'none';
        if (thumbnailUploadContainer) thumbnailUploadContainer.style.display = 'block';
        if (photoInput) photoInput.accept = 'image/*,.jpg,.jpeg,.png,.gif,.webp';
    } else if (isPhoto && !isGalleryPage) {
        // На главной странице при выборе фото категории
        if (fileLabelTextElement) fileLabelTextElement.textContent = 'Фото';
        if (directorAuthorElement) directorAuthorElement.placeholder = 'Описание';
        if (fileUploadContainer) fileUploadContainer.style.display = 'none'; // скрываем, так как на главной используется другой элемент
        if (episodesUploadContainer) episodesUploadContainer.style.display = 'none';
        if (thumbnailUploadContainer) thumbnailUploadContainer.style.display = 'block';
        if (fileInput) fileInput.accept = 'image/*,.jpg,.jpeg,.png,.gif,.webp';
    } else {
        if (fileLabelTextElement) fileLabelTextElement.textContent =
            isMovie || isTvshow ? 'Файл видео' : 'Файл книги (PDF, DjVu, CBZ, EPUB)';

        if (directorAuthorElement) directorAuthorElement.placeholder =
            isMovie || isTvshow ? 'Режиссёр' : 'Автор';

        if (thumbnailUploadContainer) thumbnailUploadContainer.style.display =
                isMovie ? 'block' : 'block'; // можно скрыть для книг, если хотите
        
        // Для сериалов скрываем основное поле загрузки файла и показываем загрузку эпизодов
        if (fileUploadContainer) fileUploadContainer.style.display =
            isTvshow ? 'none' : 'block';
        if (episodesUploadContainer) episodesUploadContainer.style.display =
            isTvshow ? 'block' : 'none';

        if (fileInput) fileInput.accept = isMovie || isTvshow
            ? 'video/*,.mp4,.avi,.mov,.mkv,.wmv,.flv,.webm'
            : '.pdf,.djvu,.djv,.cbz,.zip,.epub';
    }
}

export function updateFileInfo() {
    // Проверяем, находимся ли мы на странице галереи
    const isPhotoCategory = state.currentCategory === 'photo';
    const isGalleryPage = window.location.pathname.includes('gallery.html');
    
    // Определяем правильный ID для файла и информации о файле в зависимости от страницы и категории
    let fileInputId, fileInfoId;
    if (isGalleryPage) {
        fileInputId = 'photo';
        fileInfoId = 'photo-info';
    } else {
        fileInputId = isPhotoCategory ? 'photo' : 'file'; // на главной странице при фото категории
        fileInfoId = isPhotoCategory ? 'photo-info' : 'file-info';
    }

    const fileInput = document.getElementById(fileInputId);
    if (!fileInput) return; // защита от ошибки если элемент не существует

    const fileInfoElement = document.getElementById(fileInfoId);
    if (fileInfoElement) {
        if (fileInput.files.length > 0) {
            if (fileInput.files.length === 1) {
                // Если выбран только один файл, отображаем его имя
                fileInfoElement.textContent = `Выбран: ${fileInput.files[0].name}`;
            } else {
                // Если выбрано несколько файлов, отображаем количество и список имен
                const fileNames = Array.from(fileInput.files).map(file => file.name).join(', ');
                fileInfoElement.textContent = `Выбрано: ${fileInput.files.length} файлов: ${fileNames}`;
            }
        } else {
            // Если файлы не выбраны
            fileInfoElement.textContent = '';
        }
    }
}

export function updateThumbnailInfo() {
    const thumbInput = document.getElementById('thumbnail');
    if (!thumbInput) return; // защита от ошибки если элемент не существует
    
    const file = thumbInput.files[0];
    const infoElement = document.getElementById('thumbnail-info');
    if (infoElement) {
        infoElement.textContent = file ? `Выбрана: ${file.name}` : '';
    }
}

export function updateEpisodesInfo() {
    const episodesInput = document.getElementById('episodes');
    if (!episodesInput) return; // защита от ошибки если элемент не существует
    
    const files = episodesInput.files;
    if (files.length > 0) {
        const fileNames = Array.from(files).map(f => f.name).join(', ');
        const infoElement = document.getElementById('episodes-info');
        if (infoElement) infoElement.textContent = `Выбрано эпизодов: ${files.length} (${fileNames})`;
    } else {
        const infoElement = document.getElementById('episodes-info');
        if (infoElement) infoElement.textContent = '';
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