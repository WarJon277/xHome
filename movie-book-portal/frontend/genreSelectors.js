import { state } from './state.js';
import { MOVIE_GENRES, BOOK_GENRES, TVSHOW_GENRES, PHOTO_CATEGORIES } from './genres.js';

// ============================================
// Обновление выпадающего списка жанров в шапке
// ============================================
export function updateGenreSelect() {
    // Проверяем, на какой странице мы находимся - на главной или на галерее
    const isGalleryPage = window.location.pathname.includes('gallery.html');
    const selectElementId = isGalleryPage ? 'category-filter' : 'genre-filter';
    const select = document.getElementById(selectElementId);
    if (!select) return;

    select.innerHTML = '';
    let genres;
    if (state.currentCategory === 'movie') {
        genres = MOVIE_GENRES;
    } else if (state.currentCategory === 'tvshow') {
        genres = TVSHOW_GENRES;
    } else if (state.currentCategory === 'photo') {
        genres = PHOTO_CATEGORIES;
    } else {
        genres = BOOK_GENRES;
    }

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
    // Проверяем, на какой странице мы находимся - на главной или на галерее
    const isGalleryPage = window.location.pathname.includes('gallery.html');
    const selectElementId = isGalleryPage ? 'category-select' : 'genre-select';
    const select = document.getElementById(selectElementId);
    if (!select) return;

    select.innerHTML = isGalleryPage ? '<option value="">Выберите категорию</option>' : '<option value="">Выберите жанр</option>';
    let genres;
    if (state.currentCategory === 'movie') {
        genres = MOVIE_GENRES;
    } else if (state.currentCategory === 'tvshow') {
        genres = TVSHOW_GENRES;
    } else if (state.currentCategory === 'photo') {
        genres = PHOTO_CATEGORIES;
    } else {
        genres = BOOK_GENRES;
    }

    genres.forEach(g => {
        if (g === "Все") return;
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        select.appendChild(opt);
    });
}