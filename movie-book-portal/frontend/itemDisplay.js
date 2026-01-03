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
        if (state.currentCategory === 'photo') {
            // Для фото используем путь к папке вместо категории
            items = await fetchPhotos(state.currentFolder || "");
        } else {
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
        }
        displayItems(items);
    } catch (err) {
        console.error(err);
        showError('Ошибка загрузки списка');
    } finally {
        showLoading(false);
    }

    // Обновляем навигационную цепочку и видимость кнопки "назад" на странице галереи
    if (state.currentCategory === 'photo' && window.location.pathname.includes('gallery.html')) {
        if (typeof window.updateBreadcrumb === 'function') {
            window.updateBreadcrumb();
        }
        if (typeof window.updateBackButtonVisibility === 'function') {
            window.updateBackButtonVisibility();
        }
    }
}

export function displayItems(items) {
    // Проверяем, на какой странице мы находимся - на главной или на галерее
    const isGalleryPage = window.location.pathname.includes('gallery.html');
    const gridElementId = isGalleryPage ? 'photos-grid' : 'items-grid';
    const grid = document.getElementById(gridElementId);
    if (!grid) return; // если элемент не найден, выходим

    grid.innerHTML = ''; // очищаем

    // Сортировка: сначала папки, потом файлы
    if (state.currentCategory === 'photo') {
        items.sort((a, b) => {
            // Папки имеют приоритет
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;

            // Если типы одинаковые, сортируем по имени
            const nameA = a.name || a.title || '';
            const nameB = b.name || b.title || '';
            return nameA.localeCompare(nameB);
        });
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';

        // Создаём изображение отдельно
        const img = document.createElement('img');
        img.alt = item.title || 'Без названия';
        img.className = 'thumbnail';
        img.style.cursor = 'pointer';

        // Data URLs для placeholder изображений
        const moviePlaceholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23333"/></svg>';
        const tvshowPlaceholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23444"/></svg>';
        const bookPlaceholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23555"/></svg>';
        const photoPlaceholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="%23666"/></svg>';

        // Устанавливаем путь к изображению с проверкой существования
        if (item.thumbnail_path && state.currentCategory === 'photo') {
            // Для фото в галерее используем миниатюру, если она есть
            // Trust the backend provided path!
            let thumbnailUrl = item.thumbnail_path;

            // Проверяем, что путь к миниатюре принадлежит галерее
            if (thumbnailUrl && thumbnailUrl.includes('/uploads/movies/') || thumbnailUrl.includes('/uploads/tvshows/') || thumbnailUrl.includes('/uploads/books/')) {
                // Если миниатюра принадлежит другой категории, не пытаемся её загружать
                img.src = photoPlaceholder;
            } else {
                // Если путь относительный и не начинается с /, добавляем /uploads/
                if (thumbnailUrl && !thumbnailUrl.startsWith('/') && !thumbnailUrl.startsWith('http')) {
                    if (thumbnailUrl.startsWith('uploads/')) {
                        thumbnailUrl = `/${thumbnailUrl.replace(/\\/g, '/')}`;
                    } else {
                        thumbnailUrl = `/uploads/${thumbnailUrl.replace(/\\/g, '/')}`;
                    }
                }

                // Для путей, начинающихся с /uploads/gallery, не добавляем префикс дважды
                if (thumbnailUrl && thumbnailUrl.startsWith('/uploads/gallery')) {
                    // Оставляем путь как есть, он уже правильный
                } else if (thumbnailUrl && !thumbnailUrl.startsWith('http') && !thumbnailUrl.startsWith('/')) {
                    thumbnailUrl = `/${thumbnailUrl}`;
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
            }
        } else if (item.thumbnail_path && state.currentCategory !== 'photo') {
            // Для других категорий (фильмы, сериалы, книги) используем обычную логику
            let thumbnailUrl = item.thumbnail_path.replace(/\\/g, '/');
            if (thumbnailUrl.startsWith('/')) {
                // Путь уже абсолютный от корня
            } else if (thumbnailUrl.startsWith('uploads/')) {
                thumbnailUrl = `/${thumbnailUrl}`;
            } else {
                thumbnailUrl = `/uploads/${thumbnailUrl}`;
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
                if (item.type === 'folder') return;

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

        // ============================================
        // СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ ПАПОК И ФОТО
        // ============================================
        if (state.currentCategory === 'photo') {
            // Если это папка
            if (item.type === 'folder') {
                card.classList.add('folder-item');
                card.setAttribute('data-type', 'folder');
                card.setAttribute('data-name', item.name);

                // 1. Добавляем иконку первой
                card.appendChild(img);

                // 2. Накладываем название папки на иконку
                const folderOverlay = document.createElement('div');
                folderOverlay.className = 'folder-overlay';
                folderOverlay.textContent = item.name;
                card.appendChild(folderOverlay);

                // 3. Добавляем кнопку удаления папки
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'folder-delete-btn';
                deleteBtn.innerHTML = '×';
                deleteBtn.title = 'Удалить папку с содержимым';
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    const apiModule = await import('./api.js');
                    const stateModule = await import('./state.js');
                    const currentFolder = stateModule.getCurrentFolder();
                    const fullPath = currentFolder ? `${currentFolder}/${item.name}` : item.name;
                    
                    if (typeof window.showConfirm === 'function') {
                        window.showConfirm('Удаление папки', `Вы уверены, что хотите удалить папку "${item.name}" и всё её содержимое?`, async () => {
                            try {
                                await apiModule.deleteFolder(fullPath);
                                await loadItems();
                            } catch (error) {
                                console.error('Ошибка при удалении папки:', error);
                                if (typeof window.showAlert === 'function') {
                                    window.showAlert('Ошибка', 'Ошибка при удалении папки: ' + error.message);
                                } else {
                                    alert('Ошибка при удалении папки: ' + error.message);
                                }
                            }
                        });
                    } else if (confirm(`Вы уверены, что хотите удалить папку "${item.name}" и всё её содержимое?`)) {
                        try {
                            await apiModule.deleteFolder(fullPath);
                            await loadItems();
                        } catch (error) {
                            console.error('Ошибка при удалении папки:', error);
                            alert('Ошибка при удалении папки: ' + error.message);
                        }
                    }
                };
                card.appendChild(deleteBtn);

                // 4. Обработка клика по папке - вход внутрь
                img.onclick = async (e) => {
                    e.stopPropagation(); // Останавливаем всплытие
                    const stateModule = await import('./state.js');
                    const currentFolder = stateModule.getCurrentFolder();
                    // Формируем новый путь
                    const newPath = currentFolder ? `${currentFolder}/${item.name}` : item.name;
                    stateModule.setCurrentFolder(newPath);
                    await loadItems();
                };
            } else {
                // Если это обычное фото
                card.setAttribute('data-id', item.id);
                card.setAttribute('data-path', item.file_path);
                card.setAttribute('data-title', item.title || 'photo');
                card.classList.add('photo-item');
                card.appendChild(img);
            }
        } else {
            // Для других категорий (фильмы, сериалы, книги)
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

            const actions = document.createElement('div');
            actions.className = 'card-actions';

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
                await loadItems();
            };

            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            card.appendChild(actions);
        }

        grid.appendChild(card);
    });

    // Применяем сохраненные фильтры к миниатюрам, если они есть
    if (typeof window.applyAllSavedFilters === 'function') {
        window.applyAllSavedFilters();
    }
}