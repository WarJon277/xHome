import { state } from './state.js';
import { fetchMovies, fetchTvshows, fetchBooks, fetchPhotos } from './api.js';
import { openVideoPlayer } from './videoPlayer.js';
import { openBookReader } from './bookReader.js';
import { showEpisodesList } from './episodesList.js';
import { showLoading, showError, escapeHtml, truncateDescription } from './utils.js';
import { editItem } from './itemForm.js';
import { deleteItem } from './itemOperations.js';
import { deletePhoto } from './api.js';

// ============================================
// Загрузка элементов с учётом жанра/категории
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
                    : state.currentCategory === 'photo'
                        ? await fetchPhotos()
                        : await fetchBooks();
        } else {
            if (state.currentCategory === 'photo') {
                // Для фото используем категорию вместо жанра
                items = await fetchPhotos(state.currentGenre);
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
    // Проверяем, на какой странице мы находимся - на главной или на галерее
    const isGalleryPage = window.location.pathname.includes('gallery.html');
    const gridElementId = isGalleryPage ? 'photos-grid' : 'items-grid';
    const grid = document.getElementById(gridElementId);
    if (!grid) return; // если элемент не найден, выходим
    
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
        const photoPlaceholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/200/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23666"/><text x="150" y="200" font-family="Arial" font-size="20" fill="white" text-anchor="middle">Photo</text></svg>';

        // Устанавливаем путь к изображению с проверкой существования
        if (item.thumbnail_path && state.currentCategory === 'photo') {
            // Для фото в галерее используем миниатюру, если она есть
            let thumbnailUrl;
            // Для фото всегда формируем путь к uploads/gallery/, независимо от того, что хранится в базе
            if (item.thumbnail_path.startsWith('/')) {
                // Если путь начинается с /uploads/gallery/, используем как есть
                if (item.thumbnail_path.includes('/uploads/gallery/')) {
                    // Для всех фото в галерее используем единый формат миниатюры: baseName_thumb.webp
                    const fileName = item.thumbnail_path.split('/').pop();
                    const baseName = fileName.replace(/\.[^/.]+$/, ""); // Убираем расширение
                    // Убираем возможное дублирование "_thumb" в имени
                    const cleanBaseName = baseName.endsWith('_thumb') ? baseName.substring(0, baseName.lastIndexOf('_thumb')) : baseName;
                    thumbnailUrl = `/uploads/gallery/${cleanBaseName}_thumb.webp`;
                } else {
                    // Извлекаем имя файла и формируем правильный путь
                    const fileName = item.thumbnail_path.split('/').pop();
                    const baseName = fileName.replace(/\.[^/.]+$/, ""); // Убираем расширение
                    // Убираем возможное дублирование "_thumb" в имени
                    const cleanBaseName = baseName.endsWith('_thumb') ? baseName.substring(0, baseName.lastIndexOf('_thumb')) : baseName;
                    thumbnailUrl = `/uploads/gallery/${cleanBaseName}_thumb.webp`;
                }
            } else if (item.thumbnail_path.startsWith('uploads/')) {
                // Если путь начинается с uploads/gallery/, используем как есть
                if (item.thumbnail_path.includes('gallery')) {
                    const fileName = item.thumbnail_path.split('/').pop();
                    const baseName = fileName.replace(/\.[^/.]+$/, ""); // Убираем расширение
                    // Убираем возможное дублирование "_thumb" в имени
                    const cleanBaseName = baseName.endsWith('_thumb') ? baseName.substring(0, baseName.lastIndexOf('_thumb')) : baseName;
                    thumbnailUrl = `/uploads/gallery/${cleanBaseName}_thumb.webp`;
                } else {
                    // Извлекаем имя файла и формируем правильный путь
                    const fileName = item.thumbnail_path.split('/').pop();
                    const baseName = fileName.replace(/\.[^/.]+$/, ""); // Убираем расширение
                    // Убираем возможное дублирование "_thumb" в имени
                    const cleanBaseName = baseName.endsWith('_thumb') ? baseName.substring(0, baseName.lastIndexOf('_thumb')) : baseName;
                    thumbnailUrl = `/uploads/gallery/${cleanBaseName}_thumb.webp`;
                }
            } else {
                // Если путь не начинается с / или uploads/, добавляем правильный префикс
                const fileName = item.thumbnail_path.replace(/\\/g, '/').split('/').pop();
                const baseName = fileName.replace(/\.[^/.]+$/, ""); // Убираем расширение
                // Убираем возможное дублирование "_thumb" в имени
                const cleanBaseName = baseName.endsWith('_thumb') ? baseName.substring(0, baseName.lastIndexOf('_thumb')) : baseName;
                thumbnailUrl = `/uploads/gallery/${cleanBaseName}_thumb.webp`;
            }
            // Сначала устанавливаем placeholder, чтобы избежать проблем с отсутствующим изображением
            img.src = photoPlaceholder;
            
            // Затем пытаемся загрузить реальное изображение
            // Используем Image для проверки загрузки изображения
            const testImg = new Image();
            testImg.onload = () => {
                img.src = thumbnailUrl;
            };
            testImg.onerror = () => {
                // Изображение не существует, оставляем placeholder
                console.warn(`Миниатюра не найдена: ${thumbnailUrl}`);
            };
            testImg.src = thumbnailUrl;
        } else if (item.thumbnail_path) {
            // Для других категорий (фильмы, сериалы, книги) используем обычную логику
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
            // Используем Image для проверки загрузки изображения
            const testImg = new Image();
            testImg.onload = () => {
                img.src = thumbnailUrl;
            };
            testImg.onerror = () => {
                // Изображение не существует, оставляем placeholder
                console.warn(`Миниатюра не найдена: ${thumbnailUrl}`);
            };
            testImg.src = thumbnailUrl;
        } else {
            // Если нет пути к миниатюре, используем запасной вариант
            img.src = state.currentCategory === 'movie'
                ? moviePlaceholder
                : state.currentCategory === 'tvshow'
                    ? tvshowPlaceholder
                    : state.currentCategory === 'photo'
                        ? photoPlaceholder
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
            } else if (state.currentCategory === 'photo') {
                // Для фото показываем полноразмерное изображение в модальном окне
                let photoPath;
                if (item.file_path) {
                    photoPath = item.file_path;
                } else {
                    alert(`Файл фото ещё не загружен`);
                    return;
                }
                
                // Открываем модальное окно просмотра фото
                if (typeof window.openPhotoModal === 'function') {
                    window.openPhotoModal(photoPath, item.title, item.id);
                } else {
                    // Если модальное окно не загружено, открываем фото в новой вкладке
                    window.open(photoPath, '_blank');
                }
            } else {
                // Для книг просто ID — он всегда число
                openBookReader(item.id);
            }
        });

        // Создаём остальные элементы карточки
        // Для фото не добавляем название и текстовую информацию
        if (state.currentCategory !== 'photo') {
            const titleEl = document.createElement('h3');
            titleEl.textContent = item.title || 'Без названия';
            
            let infoEl;
            infoEl = document.createElement('p');
            infoEl.innerHTML = `
                <strong>${state.currentCategory === 'movie' ? 'Режиссёр' : state.currentCategory === 'tvshow' ? 'Режиссёр' : 'Автор'}:</strong>
                ${escapeHtml(state.currentCategory === 'movie' || state.currentCategory === 'tvshow' ? item.director || '—' : item.author || '—')}
            `;

            let metaEl;
            metaEl = document.createElement('p');
            metaEl.textContent = `Год: ${item.year || '—'} | Жанр: ${item.genre || '—'} | Рейтинг: ${item.rating || '—'}`;

            const descEl = document.createElement('p');
            descEl.textContent = truncateDescription(item.description || 'Нет описания', 100);

            // Добавляем элементы в правильном порядке: сначала изображение, затем текст
            card.appendChild(img);
            card.appendChild(titleEl);
            card.appendChild(infoEl);
            card.appendChild(metaEl);
            card.appendChild(descEl);
            
            // Убираем дублирующее добавление изображения
        }

        const actions = document.createElement('div');
        actions.className = 'card-actions';

        // Показываем кнопки только если не фото или на главной странице
        if (state.currentCategory !== 'photo') {
            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.textContent = 'Редактировать';
            editBtn.onclick = () => editItem(item.id);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = 'Удалить';
            deleteBtn.onclick = async () => {
                // Проверяем, на какой странице мы находимся, чтобы вызвать правильную функцию удаления
                if (state.currentCategory === 'photo') {
                    await deletePhoto(item.id);
                } else {
                    await deleteItem(item.id);
                }
                // Перезагружаем элементы после удаления
                await loadItems(); // вызываем функцию из текущего модуля
            };

            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
        }

        // Собираем карточку
        if (state.currentCategory === 'photo') {
            // Для фото добавляем только изображение
            card.appendChild(img);
        }
        // Для других категорий элементы уже добавлены
        
        card.appendChild(actions);

        grid.appendChild(card);
    });
}