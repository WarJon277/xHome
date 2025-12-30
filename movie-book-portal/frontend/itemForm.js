import { state, setCurrentCategory, setCurrentGenre, setEditingItem } from './state.js';
import { updateProgress, hideProgress } from './utils.js';
import { updateFormLabels } from './utils.js';
import { loadItems } from './itemDisplay.js';
import { updateFileInfo, updateThumbnailInfo, updateEpisodesInfo } from './utils.js';
import { showLoading, showError, escapeHtml } from './utils.js';
import { uploadFile, uploadEpisodes } from './utils.js';
import { fetchMovie, fetchTvshow, fetchBook, fetchPhoto, fetchEpisodes, createMovie, createTvshow, createBook, createPhoto, updateMovie, updateTvshow, updateBook, updatePhoto } from './api.js';

// ============================================
// Форма — добавление / редактирование
// ============================================
export async function handleSubmit(e) {
    e.preventDefault();
    
    // Проверяем, на какой странице мы находимся - на главной или на галерее
    const isGalleryPage = window.location.pathname.includes('gallery.html');
    const titleElement = document.getElementById('title');
    const genreSelectElement = document.getElementById('genre-select');
    const genreInputElement = document.getElementById('genre');
    const yearElement = document.getElementById('year');
    const directorAuthorElement = document.getElementById('director-author');
    const ratingElement = document.getElementById('rating');
    const descriptionElement = document.getElementById('description');
    
    if (!titleElement) {
        showError('Не найден элемент заголовка');
        return;
    }
    
    const title = titleElement.value.trim();
    if (state.currentCategory !== 'photo' && !title) {
        showError('Название — обязательное поле');
        return;
    }

    showLoading(true);
    showError('');

    try {
        let genreValue = '';
        if (genreSelectElement) {
            genreValue = genreSelectElement.value;
        }
        if (!genreValue && genreInputElement) {
            genreValue = genreInputElement.value.trim();
        }

        let data = {
            title,
            description: descriptionElement ? descriptionElement.value.trim() || null : null
        };

        if (state.currentCategory === 'photo') {
            // Для фото используем категорию вместо жанра
            data.category = genreValue || 'general';
        } else {
            if (yearElement) data.year = parseInt(yearElement.value) || null;
            data.genre = genreValue || null;
            if (ratingElement) data.rating = parseFloat(ratingElement.value) || null;
            
            if (state.currentCategory === 'movie' || state.currentCategory === 'tvshow') {
                if (directorAuthorElement) data.director = directorAuthorElement.value.trim() || null;
            } else {
                if (directorAuthorElement) data.author = directorAuthorElement.value.trim() || null;
            }
        }

        let itemId;
        if (state.editingItem) {
            // Обновление
            await (state.currentCategory === 'movie'
                ? updateMovie(state.editingItem.id, data)
                : state.currentCategory === 'tvshow'
                    ? updateTvshow(state.editingItem.id, data)
                    : state.currentCategory === 'photo'
                        ? updatePhoto(state.editingItem.id, data)
                        : updateBook(state.editingItem.id, data));
            itemId = state.editingItem.id;
        } else {
            // Создание
            if (state.currentCategory === 'photo' && !state.editingItem) {
                // Для фото при добавлении новых элементов не создаем общую запись,
                // а обрабатываем каждое фото индивидуально в следующем блоке
                itemId = null;
            } else {
                const newItem = await (state.currentCategory === 'movie'
                    ? createMovie(data)
                    : state.currentCategory === 'tvshow'
                        ? createTvshow(data)
                        : state.currentCategory === 'photo'
                            ? createPhoto(data)
                            : createBook(data));
                itemId = newItem.id;
            }
        }

        // Загрузка файлов
        const thumbInput = document.getElementById('thumbnail');
        
        // Загрузка основного файла (для фильмов, книг и фото)
        if (state.currentCategory === 'movie' || state.currentCategory === 'book') {
            const fileInput = document.getElementById('file');
            if (fileInput && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const endpoint = state.currentCategory === 'movie'
                    ? `/movies/${itemId}/upload`
                    : `/books/${itemId}/upload`;
                await uploadFile(endpoint, file, p => updateProgress(20 + p * 50 / 100));
            }
        } else if (state.currentCategory === 'photo') {
            // Для фото загружаем каждое изображение как отдельный элемент
            const fileInput = document.getElementById('photo'); // используем другой ID для фото
            if (fileInput && fileInput.files.length > 0) {
                // Если редактируем существующее фото, загружаем файлы в существующий элемент
                if (state.editingItem) {
                    // Загружаем все выбранные фото в существующий элемент
                    for (let i = 0; i < fileInput.files.length; i++) {
                        const file = fileInput.files[i];
                        const endpoint = `/gallery/${itemId}/upload`;
                        await uploadFile(endpoint, file, p => updateProgress(20 + (i+1) * 50 / fileInput.files.length));
                        
                        // Если миниатюра не была загружена, используем основное фото как миниатюру
                        const thumbInput = document.getElementById('thumbnail');
                        if (!thumbInput || !thumbInput.files.length > 0) {
                            // Копируем основное фото как миниатюру
                            const thumbnailEndpoint = `/gallery/${itemId}/upload_thumbnail`;
                            await uploadFile(thumbnailEndpoint, file, p => updateProgress(70 + (i+1) * 30 / fileInput.files.length));
                        }
                    }
                } else {
                    // При добавлении новых фото создаем отдельную запись для каждого файла
                    for (let i = 0; i < fileInput.files.length; i++) {
                        const file = fileInput.files[i];
                        // Создаем отдельную запись для каждого фото
                        const photoData = {
                            ...data,
                            title: file.name.replace(/\.[^/.]+$/, ""), // Используем имя файла без расширения как заголовок, если не задан
                        };
                        if (!title) {
                            photoData.title = file.name.replace(/\.[^/.]+$/, "");
                        }
                        
                        const newPhotoItem = await createPhoto(photoData);
                        const newPhotoId = newPhotoItem.id;
                        
                        // Загружаем текущий файл в только что созданную запись
                        const endpoint = `/gallery/${newPhotoId}/upload`;
                        await uploadFile(endpoint, file, p => updateProgress(20 + (i+1) * 50 / fileInput.files.length));
                        
                        // Если миниатюра не была загружена, используем основное фото как миниатюру
                        const thumbInput = document.getElementById('thumbnail');
                        if (!thumbInput || !thumbInput.files.length > 0) {
                            // Копируем основное фото как миниатюру
                            const thumbnailEndpoint = `/gallery/${newPhotoId}/upload_thumbnail`;
                            await uploadFile(thumbnailEndpoint, file, p => updateProgress(70 + (i+1) * 30 / fileInput.files.length));
                        }
                    }
                }
            }
        }

        if (thumbInput && thumbInput.files.length > 0 && itemId) {
            const file = thumbInput.files[0];
            const endpoint = state.currentCategory === 'movie'
                ? `/movies/${itemId}/upload_thumbnail`
                : state.currentCategory === 'tvshow'
                    ? `/tvshows/${itemId}/upload_thumbnail`
                    : state.currentCategory === 'photo'
                        ? `/gallery/${itemId}/upload_thumbnail`
                        : `/books/${itemId}/upload_thumbnail`;
            await uploadFile(endpoint, file, p => updateProgress(70 + p * 30 / 100));
        }

        // Загрузка эпизодов для сериалов
        if (state.currentCategory === 'tvshow') {
            const episodesInput = document.getElementById('episodes');
            if (episodesInput && episodesInput.files.length > 0) {
                const seasonNumber = parseInt(document.getElementById('season-number').value) || 1;
                // Если это редактирование, нам нужно определить правильный начальный номер эпизода
                let startEpisodeNumber = parseInt(document.getElementById('start-episode-number').value) || 1;
                
                // Если мы редактируем существующий сериал, получаем количество уже существующих эпизодов в этом сезоне
                if (state.editingItem) {
                    try {
                        // Получаем все существующие эпизоды для этого сериала в указанном сезоне
                        const existingEpisodes = await fetchEpisodes(itemId, seasonNumber);
                        if (existingEpisodes.length > 0) {
                            // Находим максимальный номер эпизода в этом сезоне и начинаем с следующего
                            const maxEpisodeNum = Math.max(...existingEpisodes.map(ep => ep.episode_number));
                            startEpisodeNumber = maxEpisodeNum + 1;
                        }
                        // If no episodes exist in this season, startEpisodeNumber remains as initially set
                    } catch (error) {
                        console.error('Ошибка при получении существующих эпизодов:', error);
                        // Если произошла ошибка, используем значение из формы
                        startEpisodeNumber = parseInt(document.getElementById('start-episode-number').value) || 1;
                    }
                }
                
                await uploadEpisodes(itemId, episodesInput.files, seasonNumber, startEpisodeNumber, p => updateProgress(50 + p * 50 / 100));
            } else {
                // Если эпизоды не загружены, обновляем прогресс до 100%
                updateProgress(100);
            }
        } else {
            // For non-tvshow items, ensure progress reaches 100% after thumbnail upload
            updateProgress(100);
        }

        setTimeout(() => {
            loadItems();
            showViewMode();
            hideProgress();
            showLoading(false);
            // Проверяем, на какой странице мы находимся - на главной или на галерее
            const isGalleryPage = window.location.pathname.includes('gallery.html');
            const formElementId = isGalleryPage ? 'photo-form' : 'item-form';
            const formElement = document.getElementById(formElementId);
            const formTitle = document.getElementById('form-title');
            const submitBtn = document.getElementById('submit-btn');
            
            if (formElement) formElement.reset();
            updateFileInfo();
            updateThumbnailInfo();
            updateEpisodesInfo();
            setEditingItem(null);
            window.editingItem = null; // для совместимости
            if (formTitle) formTitle.textContent = 'Добавить новый элемент';
            if (submitBtn) submitBtn.textContent = 'Добавить';
        }, 800);

    } catch (err) {
        console.error(err);
        showError(err.message || 'Ошибка при сохранении');
        hideProgress();
        showLoading(false);
    }
}

export async function editItem(id) {
    showAddMode();

    const item = state.currentCategory === 'movie'
        ? await fetchMovie(id)
        : state.currentCategory === 'tvshow'
            ? await fetchTvshow(id)
            : state.currentCategory === 'photo'
                ? await fetchPhoto(id)
                : await fetchBook(id);
    
    setEditingItem(item);

    // Убедимся, что элементы существуют перед тем как к ним обращаться
    const titleElement = document.getElementById('title');
    const descriptionElement = document.getElementById('description');
    const yearElement = document.getElementById('year');
    const directorAuthorElement = document.getElementById('director-author');
    const ratingElement = document.getElementById('rating');
    const genreSelectElement = document.getElementById('genre-select');
    const genreInputElement = document.getElementById('genre');
    const formTitleElement = document.getElementById('form-title');
    const submitBtnElement = document.getElementById('submit-btn');

    if (titleElement) titleElement.value = item.title;
    if (descriptionElement) descriptionElement.value = item.description || '';

    if (state.currentCategory === 'photo') {
        // Для фото устанавливаем категорию
        if (genreSelectElement && item.category) {
            const option = [...genreSelectElement.options].find(o => o.value === item.category);
            if (option) {
                option.selected = true;
                if (genreInputElement) genreInputElement.value = '';
            } else {
                genreSelectElement.value = '';
                if (genreInputElement) genreInputElement.value = item.category;
            }
        }
    } else {
        // Для других типов устанавливаем год, автора/режиссера, рейтинг и жанр
        if (yearElement) yearElement.value = item.year || '';
        if (directorAuthorElement) directorAuthorElement.value =
            state.currentCategory === 'movie' || state.currentCategory === 'tvshow' ? (item.director || '') : (item.author || '');
        if (ratingElement) ratingElement.value = item.rating || '';

        // Жанр
        if (genreSelectElement && item.genre) {
            const option = [...genreSelectElement.options].find(o => o.value === item.genre);
            if (option) {
                option.selected = true;
                if (genreInputElement) genreInputElement.value = '';
            } else {
                genreSelectElement.value = '';
                if (genreInputElement) genreInputElement.value = item.genre;
            }
        }
    }

    if (formTitleElement) formTitleElement.textContent = 'Редактировать элемент';
    if (submitBtnElement) submitBtnElement.textContent = 'Сохранить';

    updateFormLabels();
    updateFileInfo();
    updateThumbnailInfo();
    updateEpisodesInfo();
}

// ============================================
// Вспомогательные функции для формы
// ============================================
export function showAddMode() {
    const addForm = document.getElementById('add-form');
    // Проверяем, на какой странице мы находимся - на главной или на галерее
    const isGalleryPage = window.location.pathname.includes('gallery.html');
    const gridElementId = isGalleryPage ? 'photos-grid' : 'items-grid';
    const gridElement = document.getElementById(gridElementId);
    
    if (addForm) addForm.style.display = 'block';
    if (gridElement) gridElement.style.display = 'none';
}

export function showViewMode() {
    const addForm = document.getElementById('add-form');
    // Проверяем, на какой странице мы находимся - на главной или на галерее
    const isGalleryPage = window.location.pathname.includes('gallery.html');
    const gridElementId = isGalleryPage ? 'photos-grid' : 'items-grid';
    const gridElement = document.getElementById(gridElementId);
    const formElementId = isGalleryPage ? 'photo-form' : 'item-form';
    const formElement = document.getElementById(formElementId);
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    
    if (addForm) addForm.style.display = 'none';
    if (gridElement) gridElement.style.display = 'grid';
    if (formElement) formElement.reset();
    updateFileInfo();
    updateThumbnailInfo();
    updateEpisodesInfo();
    setEditingItem(null);
    window.editingItem = null; // для совместимости
    if (formTitle) formTitle.textContent = 'Добавить новый элемент';
    if (submitBtn) submitBtn.textContent = 'Добавить';
}