import { state } from './state.js';
import { MOVIE_GENRES, BOOK_GENRES, TVSHOW_GENRES } from './genres.js';

// ============================================
// Обновление выпадающего списка жанров в шапке
// ============================================
export function updateGenreSelect() {
    const select = document.getElementById('genre-filter');
    if (!select) return;

    select.innerHTML = '';
    const genres = state.currentCategory === 'movie' ? MOVIE_GENRES : (state.currentCategory === 'tvshow' ? TVSHOW_GENRES : BOOK_GENRES);

    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        if (genre === state.currentGenre) option.selected = true;
        select.appendChild(option);
    });
}

// ============================================
// Жанры в форме добавления/редактирования
// ============================================
export function updateGenreSelectInForm() {
    const select = document.getElementById('genre-select');
    if (!select) return;

    select.innerHTML = '<option value="">Выберите жанр</option>';
    const genres = state.currentCategory === 'movie' ? MOVIE_GENRES : (state.currentCategory === 'tvshow' ? TVSHOW_GENRES : BOOK_GENRES);

    genres.forEach(g => {
        if (g === "Все") return;
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        select.appendChild(opt);
    });
}