// Импорт всех модулей
import { MOVIE_GENRES, BOOK_GENRES, TVSHOW_GENRES, PHOTO_CATEGORIES } from './genres.js';
import { state, setCurrentCategory, setCurrentGenre, setEditingItem } from './state.js';

// Создаем глобальные переменные для совместимости
let currentCategory = state.currentCategory;
let currentGenre = state.currentGenre;
let editingItem = state.editingItem;
import { updateGenreSelect, updateGenreSelectInForm } from './genreSelectors.js';
import { updateFormLabels } from './utils.js';
import { loadItems, displayItems } from './itemDisplay.js';
import { handleSubmit, editItem, showAddMode, showViewMode } from './itemForm.js';
import { deleteItem } from './itemOperations.js';
import { updateFileInfo, updateThumbnailInfo, updateEpisodesInfo, updateProgress, hideProgress, showLoading, showError, escapeHtml, truncateDescription, uploadFile, uploadEpisodes } from './utils.js';
import { openVideoPlayer } from './videoPlayer.js';
import { openBookReader } from './bookReader.js';
import { showEpisodesList } from './episodesList.js';

// Экспортируем глобальные переменные для использования в других модулях
// Обновляем переменные в window для совместимости с другими частями приложения
window.currentCategory = state.currentCategory;
window.currentGenre = state.currentGenre;
window.editingItem = state.editingItem;

// Обновляем переменные при изменении состояния
// Создаем функции для обновления глобальных переменных
window.setCurrentCategory = (category) => {
    import('./state.js').then(({ setCurrentCategory }) => {
        setCurrentCategory(category);
        window.currentCategory = category;

        // Hide/Show Add button
        const addBtn = document.getElementById('show-add');
        if (addBtn) {
            addBtn.style.display = category === 'photo' ? 'block' : 'none';
        }
    });
};

window.setCurrentGenre = (genre) => {
    import('./state.js').then(({ setCurrentGenre }) => {
        setCurrentGenre(genre);
        window.currentGenre = genre;
    });
};

window.setEditingItem = (item) => {
    import('./state.js').then(({ setEditingItem }) => {
        setEditingItem(item);
        window.editingItem = item;
    });
};

// Импортируем обработчики событий
import './eventListeners.js';

document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('show-add');
    // Hide by default if default category is not photo (it's usually movie)
    // We can check state but calling setCurrentCategory logic is safer if we knew specific startup logic.
    // simpler:
    if (addBtn && (!window.currentCategory || window.currentCategory !== 'photo')) {
        addBtn.style.display = 'none';
    }
});