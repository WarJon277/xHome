import { state } from './state.js';
import { fetchMovies, fetchTvshows, fetchBooks } from './api.js';
import { openVideoPlayer } from './videoPlayer.js';
import { openBookReader } from './bookReader.js';
import { showEpisodesList } from './episodesList.js';
import { showLoading, showError, escapeHtml, truncateDescription } from './utils.js';
import { editItem } from './itemForm.js';
import { deleteItem } from './itemOperations.js';

// ============================================
// Загрузка элементов с учётом жанра
// ============================================
export async function loadItems() {
    showLoading(true);
    try {
        let items;
        if (state.currentGenre === "Все") {
            items = state.currentCategory === 'movie'
                ? await fetchMovies()
                : state.currentCategory === 'tvshow'
                    ? await fetchTvshows()
                    : await fetchBooks();
        } else {
            const allItems = state.currentCategory === 'movie'
                ? await fetchMovies()
                : state.currentCategory === 'tvshow'
                    ? await fetchTvshows()
                    : await fetchBooks();
            items = allItems.filter(item =>
                item.genre && item.genre.toLowerCase().includes(state.currentGenre.toLowerCase())
            );
        }
        displayItems(items);
    } catch (err) {
        console.error(err);
        showError('Ошибка загрузки списка');
    } finally {
        showLoading(false);
    }
}

export function displayItems(items) {
    const grid = document.getElementById('items-grid');
    grid.innerHTML = ''; // очищаем

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';

        // Создаём изображение отдельно
        const img = document.createElement('img');
        img.alt = item.title || 'Без названия';
        img.className = 'thumbnail';
        img.style.cursor = 'pointer';

        // Data URLs для placeholder изображений
        const moviePlaceholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23333"/><text x="150" y="200" font-family="Arial" font-size="20" fill="white" text-anchor="middle">Movie</text></svg>';
        const tvshowPlaceholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23444"/><text x="150" y="200" font-family="Arial" font-size="20" fill="white" text-anchor="middle">TV Show</text></svg>';
        const bookPlaceholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23555"/><text x="150" y="200" font-family="Arial" font-size="20" fill="white" text-anchor="middle">Book</text></svg>';

        // Устанавливаем путь к изображению с проверкой существования
        if (item.thumbnail_path) {
            // Проверяем, существует ли файл миниатюры
            // Если путь уже начинается с /uploads, не добавляем дополнительный слэш
            let thumbnailUrl;
            if (item.thumbnail_path.startsWith('/')) {
                thumbnailUrl = item.thumbnail_path;
            } else if (item.thumbnail_path.startsWith('uploads/')) {
                thumbnailUrl = `/${item.thumbnail_path.replace(/\\/g, '/')}`;
            } else {
                thumbnailUrl = `/uploads/${item.thumbnail_path.replace(/\\/g, '/')}`;
            }
            // Сначала устанавливаем placeholder, чтобы избежать проблем с отсутствующим изображением
            img.src = state.currentCategory === 'movie'
                ? moviePlaceholder
                : state.currentCategory === 'tvshow'
                    ? tvshowPlaceholder
                    : bookPlaceholder;
            
            // Затем пытаемся загрузить реальное изображение
            fetch(thumbnailUrl, {method: 'HEAD'}).then(response => {
                if(response.ok) {
                    img.src = thumbnailUrl;
                } else {
                    // Изображение не существует, оставляем placeholder
                    console.warn(`Миниатюра не найдена: ${thumbnailUrl}`);
                }
            }).catch(error => {
                // Ошибка при проверке изображения, оставляем placeholder
                console.warn(`Ошибка при проверке миниатюры: ${thumbnailUrl}`, error);
            });
        } else {
            // Если нет пути к миниатюре, используем запасной вариант
            img.src = state.currentCategory === 'movie'
                ? moviePlaceholder
                : state.currentCategory === 'tvshow'
                    ? tvshowPlaceholder
                    : bookPlaceholder;
        }

        // Добавляем обработчик клика
        img.addEventListener('click', () => {
            if (state.currentCategory === 'movie') {
                if (item.file_path) {
                    // Экранирование уже не нужно — передаём напрямую
                    openVideoPlayer(item.file_path, item.title || 'Без названия');
                } else {
                    alert(`Видеофайл для этого фильма ещё не загружен`);
                }
            } else if (state.currentCategory === 'tvshow') {
                // Для сериалов показываем список эпизодов
                showEpisodesList(item.id, item.title || 'Без названия');
            } else {
                // Для книг просто ID — он всегда число
                openBookReader(item.id);
            }
        });

        // Создаём остальные элементы карточки
        const titleEl = document.createElement('h3');
        titleEl.textContent = item.title || 'Без названия';

        const infoEl = document.createElement('p');
        infoEl.innerHTML = `
            <strong>${state.currentCategory === 'movie' ? 'Режиссёр' : state.currentCategory === 'tvshow' ? 'Режиссёр' : 'Автор'}:</strong>
            ${escapeHtml(state.currentCategory === 'movie' || state.currentCategory === 'tvshow' ? item.director || '—' : item.author || '—')}
        `;

        const metaEl = document.createElement('p');
        metaEl.textContent = `Год: ${item.year || '—'} | Жанр: ${item.genre || '—'} | Рейтинг: ${item.rating || '—'}`;

        const descEl = document.createElement('p');
        descEl.textContent = truncateDescription(item.description || 'Нет описания', 100);

        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.textContent = 'Редактировать';
        editBtn.onclick = () => editItem(item.id);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Удалить';
        deleteBtn.onclick = () => deleteItem(item.id);

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        // Собираем карточку
        card.appendChild(img);
        card.appendChild(titleEl);
        card.appendChild(infoEl);
        card.appendChild(metaEl);
        card.appendChild(descEl);
        card.appendChild(actions);

        grid.appendChild(card);
    });
}