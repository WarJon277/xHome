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