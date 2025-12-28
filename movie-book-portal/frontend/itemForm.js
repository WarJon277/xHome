import { state, setCurrentCategory, setCurrentGenre, setEditingItem } from './state.js';
import { updateProgress, hideProgress } from './utils.js';
import { updateFormLabels } from './utils.js';
import { loadItems } from './itemDisplay.js';
import { updateFileInfo, updateThumbnailInfo, updateEpisodesInfo } from './utils.js';
import { showLoading, showError, escapeHtml } from './utils.js';
import { uploadFile, uploadEpisodes } from './utils.js';
import { fetchMovie, fetchTvshow, fetchBook, createMovie, createTvshow, createBook, updateMovie, updateTvshow, updateBook } from './api.js';

// ============================================
// Форма — добавление / редактирование
// ============================================
export async function handleSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('title').value.trim();
    if (!title) {
        showError('Название — обязательное поле');
        return;
    }

    showLoading(true);
    showError('');

    try {
        let genreValue = document.getElementById('genre-select').value;
        if (!genreValue) {
            genreValue = document.getElementById('genre').value.trim();
        }

        const data = {
            title,
            year: parseInt(document.getElementById('year').value) || null,
            genre: genreValue || null,
            rating: parseFloat(document.getElementById('rating').value) || null,
            description: document.getElementById('description').value.trim() || null
        };

        if (state.currentCategory === 'movie' || state.currentCategory === 'tvshow') {
            data.director = document.getElementById('director-author').value.trim() || null;
        } else {
            data.author = document.getElementById('director-author').value.trim() || null;
        }

        let itemId;
        if (state.editingItem) {
            // Обновление
            await (state.currentCategory === 'movie'
                ? updateMovie(state.editingItem.id, data)
                : state.currentCategory === 'tvshow'
                    ? updateTvshow(state.editingItem.id, data)
                    : updateBook(state.editingItem.id, data));
            itemId = state.editingItem.id;
        } else {
            // Создание
            const newItem = await (state.currentCategory === 'movie'
                ? createMovie(data)
                : state.currentCategory === 'tvshow'
                    ? createTvshow(data)
                    : createBook(data));
            itemId = newItem.id;
        }

        // Загрузка файлов
        const thumbInput = document.getElementById('thumbnail');
        
        // Загрузка основного файла (для фильмов и книг)
        if (state.currentCategory !== 'tvshow') {
            const fileInput = document.getElementById('file');
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const endpoint = state.currentCategory === 'movie'
                    ? `/movies/${itemId}/upload`
                    : `/books/${itemId}/upload`;
                await uploadFile(endpoint, file, p => updateProgress(20 + p * 50 / 100));
            }
        }

        if (thumbInput.files.length > 0) {
            const file = thumbInput.files[0];
            const endpoint = state.currentCategory === 'movie'
                ? `/movies/${itemId}/upload_thumbnail`
                : state.currentCategory === 'tvshow'
                    ? `/tvshows/${itemId}/upload_thumbnail`
                    : `/books/${itemId}/upload_thumbnail`;
            await uploadFile(endpoint, file, p => updateProgress(70 + p * 30 / 100));
        }

        // Загрузка эпизодов для сериалов
        if (state.currentCategory === 'tvshow') {
            const episodesInput = document.getElementById('episodes');
            if (episodesInput.files.length > 0) {
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
            document.getElementById('item-form').reset();
            updateFileInfo();
            updateThumbnailInfo();
            updateEpisodesInfo();
            setEditingItem(null);
            window.editingItem = null; // для совместимости
            document.getElementById('form-title').textContent = 'Добавить новый элемент';
            document.getElementById('submit-btn').textContent = 'Добавить';
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
            : await fetchBook(id);
    
    setEditingItem(item);

    document.getElementById('title').value = item.title;
    document.getElementById('year').value = item.year || '';
    document.getElementById('director-author').value =
        state.currentCategory === 'movie' || state.currentCategory === 'tvshow' ? (item.director || '') : (item.author || '');
    document.getElementById('rating').value = item.rating || '';
    document.getElementById('description').value = item.description || '';

    // Жанр
    const genreSelect = document.getElementById('genre-select');
    const genreInput = document.getElementById('genre');
    if (item.genre) {
        const option = [...genreSelect.options].find(o => o.value === item.genre);
        if (option) {
            option.selected = true;
            genreInput.value = '';
        } else {
            genreSelect.value = '';
            genreInput.value = item.genre;
        }
    }

    document.getElementById('form-title').textContent = 'Редактировать элемент';
    document.getElementById('submit-btn').textContent = 'Сохранить';

    updateFormLabels();
    updateFileInfo();
    updateThumbnailInfo();
    updateEpisodesInfo();
}

// ============================================
// Вспомогательные функции для формы
// ============================================
export function showAddMode() {
    document.getElementById('add-form').style.display = 'block';
    document.getElementById('items-grid').style.display = 'none';
}

export function showViewMode() {
    document.getElementById('add-form').style.display = 'none';
    document.getElementById('items-grid').style.display = 'grid';
    document.getElementById('item-form').reset();
    updateFileInfo();
    updateThumbnailInfo();
    updateEpisodesInfo();
    setEditingItem(null);
    window.editingItem = null; // для совместимости
    document.getElementById('form-title').textContent = 'Добавить новый элемент';
    document.getElementById('submit-btn').textContent = 'Добавить';
}