// Жанры
const MOVIE_GENRES = [
    "Все", "Боевик", "Приключения", "Анимация", "Комедия", "Криминал",
    "Документальный", "Драма", "Семейный", "Фэнтези", "Ужасы",
    "Детектив", "Мелодрама", "Научная фантастика", "Триллер", "Военный", "Вестерн"
];
const BOOK_GENRES = [
    "Все", "Фантастика", "Фэнтези", "Детектив", "Роман", "Приключения",
    "Классика", "Научная фантастика", "Ужасы", "Поэзия", "Биография",
    "Исторический", "Драма", "Дистопия", "Триллер", "Нон-фикшн", "Философия"
];
const TVSHOW_GENRES = [
    "Все", "Боевик", "Приключения", "Анимация", "Комедия", "Криминал",
    "Документальный", "Драма", "Семейный", "Фэнтези", "Ужасы",
    "Детектив", "Мелодрама", "Научная фантастика", "Триллер", "Военный", "Вестерн"
];


let currentCategory = 'movie';
let currentGenre = 'Все';
let editingItem = null;

document.addEventListener('DOMContentLoaded', () => {
    loadItems();
    updateGenreSelect();
    updateGenreSelectInForm();
    updateFormLabels();

    // Навигация по категориям
    document.querySelectorAll('.nav-item[data-category]').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item[data-category]').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            currentCategory = item.dataset.category;
            document.getElementById('category').value = currentCategory;
            currentGenre = 'Все';
            updateGenreSelect();
            updateGenreSelectInForm();
            updateFormLabels();
            loadItems();

            // Закрываем мобильное меню
            document.getElementById('menu-toggle')?.classList.remove('active');
            document.getElementById('dropdown-menu')?.classList.remove('active');
        });
    });

    // Фильтр по жанру
    document.getElementById('genre-filter').addEventListener('change', (e) => {
        currentGenre = e.target.value;
        loadItems();
    });

    // Переключение вида (список / форма)
    document.getElementById('show-add').addEventListener('click', showAddMode);
    document.getElementById('show-view').addEventListener('click', showViewMode);

    // Форма
    document.getElementById('item-form').addEventListener('submit', handleSubmit);
    document.getElementById('category').addEventListener('change', () => {
        currentCategory = document.getElementById('category').value;
        updateFormLabels();
        updateGenreSelectInForm();
    });

    document.getElementById('file').addEventListener('change', updateFileInfo);
    document.getElementById('thumbnail').addEventListener('change', updateThumbnailInfo);
    document.getElementById('episodes').addEventListener('change', updateEpisodesInfo);

    // Мобильное меню
    const menuToggle = document.getElementById('menu-toggle');
    const dropdownMenu = document.getElementById('dropdown-menu');
    if (menuToggle && dropdownMenu) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            dropdownMenu.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!menuToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
                menuToggle.classList.remove('active');
                dropdownMenu.classList.remove('active');
            }
        });
    }
});

// ============================================
// Обновление выпадающего списка жанров в шапке
// ============================================
function updateGenreSelect() {
    const select = document.getElementById('genre-filter');
    if (!select) return;

    select.innerHTML = '';
    const genres = currentCategory === 'movie' ? MOVIE_GENRES : (currentCategory === 'tvshow' ? TVSHOW_GENRES : BOOK_GENRES);

    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        if (genre === currentGenre) option.selected = true;
        select.appendChild(option);
    });
}

// ============================================
// Жанры в форме добавления/редактирования
// ============================================
function updateGenreSelectInForm() {
    const select = document.getElementById('genre-select');
    if (!select) return;

    select.innerHTML = '<option value="">Выберите жанр</option>';
    const genres = currentCategory === 'movie' ? MOVIE_GENRES : (currentCategory === 'tvshow' ? TVSHOW_GENRES : BOOK_GENRES);

    genres.forEach(g => {
        if (g === "Все") return;
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        select.appendChild(opt);
    });
}

// ============================================
// Загрузка элементов с учётом жанра
// ============================================
async function loadItems() {
    showLoading(true);
    try {
        let items;
        if (currentGenre === "Все") {
            items = currentCategory === 'movie'
                ? await fetchMovies()
                : currentCategory === 'tvshow'
                    ? await fetchTvshows()
                    : await fetchBooks();
        } else {
            const allItems = currentCategory === 'movie'
                ? await fetchMovies()
                : currentCategory === 'tvshow'
                    ? await fetchTvshows()
                    : await fetchBooks();
            items = allItems.filter(item =>
                item.genre && item.genre.toLowerCase().includes(currentGenre.toLowerCase())
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

function displayItems(items) {
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
            const thumbnailUrl = `/${item.thumbnail_path.replace(/\\/g, '/')}`;
            img.src = thumbnailUrl;
            
            // Добавляем обработчик ошибки для случая, если файл не существует
            img.onerror = () => {
                // Используем запасной вариант
                img.src = currentCategory === 'movie'
                    ? moviePlaceholder
                    : currentCategory === 'tvshow'
                        ? tvshowPlaceholder
                        : bookPlaceholder;
            };
        } else {
            // Если нет пути к миниатюре, используем запасной вариант
            img.src = currentCategory === 'movie'
                ? moviePlaceholder
                : currentCategory === 'tvshow'
                    ? tvshowPlaceholder
                    : bookPlaceholder;
        }

        // Добавляем обработчик клика
        img.addEventListener('click', () => {
            if (currentCategory === 'movie') {
                if (item.file_path) {
                    // Экранирование уже не нужно — передаём напрямую
                    openVideoPlayer(item.file_path, item.title || 'Без названия');
                } else {
                    alert(`Видеофайл для этого фильма ещё не загружен`);
                }
            } else if (currentCategory === 'tvshow') {
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
            <strong>${currentCategory === 'movie' ? 'Режиссёр' : currentCategory === 'tvshow' ? 'Режиссёр' : 'Автор'}:</strong>
            ${escapeHtml(currentCategory === 'movie' || currentCategory === 'tvshow' ? item.director || '—' : item.author || '—')}
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

// ============================================
// Форма — добавление / редактирование
// ============================================
async function handleSubmit(e) {
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

        if (currentCategory === 'movie' || currentCategory === 'tvshow') {
            data.director = document.getElementById('director-author').value.trim() || null;
        } else {
            data.author = document.getElementById('director-author').value.trim() || null;
        }

        let itemId;
        if (editingItem) {
            // Обновление
            await (currentCategory === 'movie'
                ? updateMovie(editingItem.id, data)
                : currentCategory === 'tvshow'
                    ? updateTvshow(editingItem.id, data)
                    : updateBook(editingItem.id, data));
            itemId = editingItem.id;
        } else {
            // Создание
            const newItem = await (currentCategory === 'movie'
                ? createMovie(data)
                : currentCategory === 'tvshow'
                    ? createTvshow(data)
                    : createBook(data));
            itemId = newItem.id;
        }

        // Загрузка файлов
                const thumbInput = document.getElementById('thumbnail');
        
                // Загрузка основного файла (для фильмов и книг)
                if (currentCategory !== 'tvshow') {
                    const fileInput = document.getElementById('file');
                    if (fileInput.files.length > 0) {
                        const file = fileInput.files[0];
                        const endpoint = currentCategory === 'movie'
                            ? `/movies/${itemId}/upload`
                            : `/books/${itemId}/upload`;
                        await uploadFile(endpoint, file, p => updateProgress(20 + p * 50 / 100));
                    }
                }
        
                if (thumbInput.files.length > 0) {
                    const file = thumbInput.files[0];
                    const endpoint = currentCategory === 'movie'
                        ? `/movies/${itemId}/upload_thumbnail`
                        : currentCategory === 'tvshow'
                            ? `/tvshows/${itemId}/upload_thumbnail`
                            : `/books/${itemId}/upload_thumbnail`;
                    await uploadFile(endpoint, file, p => updateProgress(70 + p * 30 / 100));
                }
        
                // Загрузка эпизодов для сериалов
                if (currentCategory === 'tvshow') {
                    const episodesInput = document.getElementById('episodes');
                    if (episodesInput.files.length > 0) {
                        const seasonNumber = parseInt(document.getElementById('season-number').value) || 1;
                        // Если это редактирование, нам нужно определить правильный начальный номер эпизода
                        let startEpisodeNumber = parseInt(document.getElementById('start-episode-number').value) || 1;
                        
                        // Если мы редактируем существующий сериал, получаем количество уже существующих эпизодов в этом сезоне
                        if (editingItem) {
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
                    // For non-tvshow items, ensure progress reaches 10% after thumbnail upload
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
            editingItem = null;
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

async function editItem(id) {
    showAddMode();

    const item = currentCategory === 'movie'
        ? await fetchMovie(id)
        : currentCategory === 'tvshow'
            ? await fetchTvshow(id)
            : await fetchBook(id);
    
    editingItem = item;

    document.getElementById('title').value = item.title;
    document.getElementById('year').value = item.year || '';
    document.getElementById('director-author').value =
        currentCategory === 'movie' || currentCategory === 'tvshow' ? (item.director || '') : (item.author || '');
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

async function deleteItem(id) {
    if (!confirm('Удалить этот элемент навсегда?')) return;

    try {
        currentCategory === 'movie'
            ? await deleteMovie(id)
            : currentCategory === 'tvshow'
                ? await deleteTvshow(id)
                : await deleteBook(id);
        loadItems();
    } catch (err) {
        alert('Ошибка при удалении');
    }
}

// ============================================
// Вспомогательные функции
// ============================================
function showAddMode() {
    document.getElementById('add-form').style.display = 'block';
    document.getElementById('items-grid').style.display = 'none';
}

function showViewMode() {
    document.getElementById('add-form').style.display = 'none';
    document.getElementById('items-grid').style.display = 'grid';
    document.getElementById('item-form').reset();
    updateFileInfo();
    updateThumbnailInfo();
    updateEpisodesInfo();
    editingItem = null;
    document.getElementById('form-title').textContent = 'Добавить новый элемент';
    document.getElementById('submit-btn').textContent = 'Добавить';
}

function updateFormLabels() {
    const isMovie = currentCategory === 'movie';
    const isTvshow = currentCategory === 'tvshow';

    document.getElementById('file-label-text').textContent =
        isMovie || isTvshow ? 'Файл видео' : 'Файл книги (PDF, DjVu, CBZ, EPUB)';

    document.getElementById('director-author').placeholder =
        isMovie || isTvshow ? 'Режиссёр' : 'Автор';

    document.getElementById('thumbnail-upload-container').style.display =
            isMovie ? 'block' : 'block'; // можно скрыть для книг, если хотите
    
        // Для сериалов скрываем основное поле загрузки файла и показываем загрузку эпизодов
        document.getElementById('file-upload-container').style.display =
            isTvshow ? 'none' : 'block';
        document.getElementById('episodes-upload-container').style.display =
            isTvshow ? 'block' : 'none';
    
        document.getElementById('file').accept = isMovie || isTvshow
            ? 'video/*,.mp4,.avi,.mov,.mkv,.wmv,.flv,.webm'
            : '.pdf,.djvu,.djv,.cbz,.zip,.epub';
}

function updateFileInfo() {
    const file = document.getElementById('file').files[0];
    document.getElementById('file-info').textContent = file ? `Выбран: ${file.name}` : '';
}

function updateThumbnailInfo() {
    const file = document.getElementById('thumbnail').files[0];
    document.getElementById('thumbnail-info').textContent = file ? `Выбрана: ${file.name}` : '';
}

function updateEpisodesInfo() {
    const files = document.getElementById('episodes').files;
    if (files.length > 0) {
        const fileNames = Array.from(files).map(f => f.name).join(', ');
        document.getElementById('episodes-info').textContent = `Выбрано эпизодов: ${files.length} (${fileNames})`;
    } else {
        document.getElementById('episodes-info').textContent = '';
    }
}

function updateProgress(percent) {
    const bar = document.getElementById('progress');
    const text = document.getElementById('progress-text');
    document.getElementById('progress-container').style.display = 'block';
    bar.style.width = percent + '%';
    text.textContent = percent + '%';
}

function hideProgress() {
    document.getElementById('progress-container').style.display = 'none';
}

function showLoading(show = true) {
    const el = document.getElementById('loading-message');
    if (el) el.style.display = show ? 'block' : 'none';
}

function showError(message) {
    const el = document.getElementById('error-message');
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
}

function escapeHtml(text) {
    const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function truncateDescription(text, maxLength = 100) {
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

async function uploadFile(endpoint, file, onProgress) {
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
async function uploadEpisodes(tvshowId, files, seasonNumber, startEpisodeNumber, onProgress) {
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

// =============================================
// Функции открытия плеера и читалки
// =============================================

// Для фильмов — открытие видео-плеера
// Открытие видеоплеера в модальном окне
// Для фильмов — открытие видео-плеера
// Открытие видеоплеера в модальном окне
function openVideoPlayer(filePath, title) {

    if (!filePath) {
        alert("Путь к файлу не указан");
        return;
    }

    // Проверяем, является ли это эпизодом сериала по заголовку
    const isEpisode = title.includes(' - S') && title.includes('E'); // Проверяем формат "Название - SxEy - ..."

    const modal = document.createElement('div');
    modal.id = 'video-modal';
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.95);
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; z-index: 9999; padding: 20px;
        width: 100vw; height: 100vh; box-sizing: border-box;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
        position: absolute; top: 20px; right: 20px; width: 40px; height: 40px;
        background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%;
        font-size: 24px; cursor: pointer; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.5);
    `;
    closeBtn.title = 'Закрыть (Esc)';

    // Создаем контейнер для элементов управления эпизодами, если это эпизод
    let episodeControls = null;
    if (isEpisode) {
        episodeControls = document.createElement('div');
        episodeControls.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            z-index: 10000;
            display: flex;
            gap: 10px;
        `;

        // Извлекаем ID сериала и номера сезона/эпизода из заголовка
        const match = title.match(/(.*) - S(\d+)E(\d+) - (.*)/);
        let tvshowTitle = '';
        let seasonNumber = 0;
        let episodeNumber = 0;
        let episodeTitle = '';
        let tvshowId = null;

        if (match) {
            tvshowTitle = match[1];
            seasonNumber = parseInt(match[2]);
            episodeNumber = parseInt(match[3]);
            episodeTitle = match[4] || `Эпизод ${episodeNumber}`;
        }

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '◀ Предыдущий';
        prevBtn.style.cssText = `
            background: rgba(0,0,0,0.6);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 14px;
        `;

        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Следующий ▶';
        nextBtn.style.cssText = `
            background: rgba(0,0,0,0.6);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 14px;
        `;

        // Кнопка для открытия списка всех эпизодов
        const allEpisodesBtn = document.createElement('button');
        allEpisodesBtn.textContent = 'Все эпизоды';
        allEpisodesBtn.style.cssText = `
            background: rgba(0,0,0,0.6);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 14px;
        `;

        // Функция для получения ID сериала по названию (упрощенная)
        const getTvshowIdByName = async (name) => {
            try {
                const tvshows = await fetchTvshows();
                const tvshow = tvshows.find(show => show.title === name);
                return tvshow ? tvshow.id : null;
            } catch (error) {
                console.error('Ошибка при получении ID сериала:', error);
                return null;
            }
        };

        // Функция для получения всех эпизодов сериала
        const loadEpisodes = async (tvshowId) => {
            try {
                return await fetchEpisodes(tvshowId);
            } catch (error) {
                console.error('Ошибка при загрузке эпизодов:', error);
                return [];
            }
        };

        // Обработчик для кнопки "Предыдущий"
        prevBtn.onclick = async () => {
            if (!tvshowTitle) return;
            
            const id = await getTvshowIdByName(tvshowTitle);
            if (!id) {
                alert('Не удалось найти сериал');
                return;
            }

            const episodes = await loadEpisodes(id);
            if (episodes.length === 0) {
                alert('Нет доступных эпизодов');
                return;
            }

            // Находим текущий эпизод и предыдущий
            const currentEpisode = episodes.find(ep =>
                ep.season_number === seasonNumber && ep.episode_number === episodeNumber
            );

            if (!currentEpisode) {
                alert('Текущий эпизод не найден');
                return;
            }

            // Находим предыдущий эпизод
            const prevEpisode = episodes.find(ep => {
                if (ep.season_number === seasonNumber) {
                    return ep.episode_number === episodeNumber - 1;
                } else if (ep.season_number === seasonNumber - 1) {
                    // Находим максимальный номер эпизода в предыдущем сезоне
                    const maxEpisodeInPrevSeason = Math.max(...episodes
                        .filter(e => e.season_number === seasonNumber - 1)
                        .map(e => e.episode_number));
                    return ep.episode_number === maxEpisodeInPrevSeason;
                }
                return false;
            }) || episodes
                .filter(ep => ep.season_number < seasonNumber || (ep.season_number === seasonNumber && ep.episode_number < episodeNumber))
                .sort((a, b) => {
                    if (a.season_number !== b.season_number) return b.season_number - a.season_number;
                    return b.episode_number - a.episode_number;
                })[0];

            if (prevEpisode && prevEpisode.file_path) {
                // Закрываем текущий плеер и открываем предыдущий эпизод
                modal.remove();
                openVideoPlayer(prevEpisode.file_path, `${tvshowTitle} - S${prevEpisode.season_number}E${prevEpisode.episode_number} - ${prevEpisode.title || `Эпизод ${prevEpisode.episode_number}`}`);
            } else {
                alert('Предыдущий эпизод не найден или недоступен');
            }
        };

        // Обработчик для кнопки "Следующий"
        nextBtn.onclick = async () => {
            if (!tvshowTitle) return;
            
            const id = await getTvshowIdByName(tvshowTitle);
            if (!id) {
                alert('Не удалось найти сериал');
                return;
            }

            const episodes = await loadEpisodes(id);
            if (episodes.length === 0) {
                alert('Нет доступных эпизодов');
                return;
            }

            // Находим текущий эпизод и следующий
            const currentEpisode = episodes.find(ep =>
                ep.season_number === seasonNumber && ep.episode_number === episodeNumber
            );

            if (!currentEpisode) {
                alert('Текущий эпизод не найден');
                return;
            }

            // Находим следующий эпизод
            const nextEpisode = episodes.find(ep => {
                if (ep.season_number === seasonNumber) {
                    return ep.episode_number === episodeNumber + 1;
                } else if (ep.season_number === seasonNumber + 1) {
                    // Находим минимальный номер эпизода в следующем сезоне
                    const minEpisodeInNextSeason = Math.min(...episodes
                        .filter(e => e.season_number === seasonNumber + 1)
                        .map(e => e.episode_number));
                    return ep.episode_number === minEpisodeInNextSeason;
                }
                return false;
            }) || episodes
                .filter(ep => ep.season_number > seasonNumber || (ep.season_number === seasonNumber && ep.episode_number > episodeNumber))
                .sort((a, b) => {
                    if (a.season_number !== b.season_number) return a.season_number - b.season_number;
                    return a.episode_number - b.episode_number;
                })[0];

            if (nextEpisode && nextEpisode.file_path) {
                // Закрываем текущий плеер и открываем следующий эпизод
                modal.remove();
                openVideoPlayer(nextEpisode.file_path, `${tvshowTitle} - S${nextEpisode.season_number}E${nextEpisode.episode_number} - ${nextEpisode.title || `Эпизод ${nextEpisode.episode_number}`}`);
            } else {
                alert('Следующий эпизод не найден или недоступен');
            }
        };

        // Обработчик для кнопки "Все эпизоды"
        allEpisodesBtn.onclick = async () => {
            if (!tvshowTitle) return;
            
            const id = await getTvshowIdByName(tvshowTitle);
            if (!id) {
                alert('Не удалось найти сериал');
                return;
            }

            // Закрываем текущий плеер и открываем список эпизодов
            modal.remove();
            showEpisodesList(id, tvshowTitle);
        };

        episodeControls.appendChild(prevBtn);
        episodeControls.appendChild(nextBtn);
        episodeControls.appendChild(allEpisodesBtn);
        modal.appendChild(episodeControls);
    }

    const videoContainer = document.createElement('div');
    videoContainer.style.cssText = `
        max-width: 95vw; max-height: 85vh; position: relative;
        width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    `;

    const video = document.createElement('video');
    video.src = filePath;
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    video.style.cssText = `
        width: 100%; height: auto; max-height: 85vh; object-fit: contain;
        display: block;
    `;

    videoContainer.appendChild(video);

    const titleEl = document.createElement('h3');
    titleEl.textContent = title || '';
    titleEl.style.cssText = `
        color: white; margin: 15px 0 5px 0; text-align: center; max-width: 90%;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    `;

    modal.append(closeBtn, videoContainer, titleEl);
    document.body.appendChild(modal);

    // Фикс зависания после паузы (без изменений)
    let needReloadOnResume = false;
    video.addEventListener('pause', () => { console.log('Pause'); needReloadOnResume = true; });
    video.addEventListener('play', async () => {
        if (!needReloadOnResume) return;
        needReloadOnResume = false;
        const t = video.currentTime || 0;
        try {
            video.pause(); video.load();
            await new Promise(r => video.addEventListener('canplay', r, {once: true}));
            video.currentTime = t; video.play();
        } catch (e) { console.warn('Resume failed:', e); }
    });
    video.addEventListener('stalled', () => { needReloadOnResume = true; });

    closeBtn.onclick = () => closeModal();
    modal.onclick = e => { if (e.target === modal) closeModal(); };
    
    const escHandler = e => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', escHandler);

    function closeModal() {
        document.removeEventListener('keydown', escHandler);
        if (modal.parentNode) modal.remove();
    }
}



function getVideoType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const types = {
        mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', ogv: 'video/ogg',
        mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska'
    };
    return types[ext] || 'video/mp4';
}
// Для книг — открытие читалки в новом окне
function openBookReader(bookId) {
    if (!bookId) {
        alert("ID книги не определён");
        return;
    }

    const width = Math.min(1200, window.screen.width * 0.9);
    const height = Math.min(900, window.screen.height * 0.9);
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const readerWindow = window.open(
        `/reader.html?bookId=${bookId}`,
        `bookReader_${bookId}`,
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=no,location=no,menubar=no`
    );

    if (!readerWindow) {
        alert("Не удалось открыть окно читалки.\nПроверьте блокировку всплывающих окон в браузере.");
    }
}

// Делаем select более "дружелюбным" к touch
document.getElementById('genre-filter').addEventListener('touchend', function(e) {
    // даём браузеру шанс обработать выбор
    setTimeout(() => {
        this.focus();
        this.click();      // принудительно открываем список
    }, 50);
}, { passive: false });

// Функция для отображения списка эпизодов сериала
async function showEpisodesList(tvshowId, tvshowTitle) {
    try {
        // Загружаем эпизоды для сериала
        const episodes = await fetchEpisodes(tvshowId);
        
        // Создаем модальное окно для списка эпизодов
        const modal = document.createElement('div');
        modal.id = 'episodes-modal';
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0.9);
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; z-index: 10000; padding: 20px;
            width: 100vw; height: 100vh; box-sizing: border-box;
        `;
        
        const container = document.createElement('div');
        container.style.cssText = `
            background: #2c3e50;
            border-radius: 8px;
            padding: 20px;
            max-width: 800px;
            max-height: 80vh;
            width: 90%;
            overflow-y: auto;
            position: relative;
        `;
        
        const title = document.createElement('h2');
        title.textContent = `Эпизоды: ${tvshowTitle}`;
        title.style.cssText = `
            color: white;
            margin-top: 0;
            text-align: center;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute; top: 10px; right: 15px; width: 30px; height: 30px;
            background: #e74c3c; color: white; border: none; border-radius: 50%;
            font-size: 16px; cursor: pointer; z-index: 10001;
        `;
        closeBtn.onclick = () => modal.remove();
        
        const episodesList = document.createElement('div');
        episodesList.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        `;
        
        if (episodes.length === 0) {
            const noEpisodes = document.createElement('p');
            noEpisodes.textContent = 'Нет загруженных эпизодов';
            noEpisodes.style.cssText = `
                color: #ecf0f1;
                text-align: center;
                grid-column: 1 / -1;
                font-style: italic;
            `;
            episodesList.appendChild(noEpisodes);
        } else {
            // Удаляем дубликаты эпизодов, если они есть (по комбинации сезона и номера эпизода)
            const uniqueEpisodes = [];
            const seenKeys = new Set();
            episodes.forEach(episode => {
                const key = `${episode.season_number}-${episode.episode_number}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    uniqueEpisodes.push(episode);
                }
            });

            // Группируем уникальные эпизоды по сезонам
            const episodesBySeason = {};
            uniqueEpisodes.forEach(episode => {
                if (!episodesBySeason[episode.season_number]) {
                    episodesBySeason[episode.season_number] = [];
                }
                episodesBySeason[episode.season_number].push(episode);
            });
            
            // Создаем карточки для каждого сезона
            Object.keys(episodesBySeason).sort((a, b) => parseInt(a) - parseInt(b)).forEach(seasonNum => {
                const seasonDiv = document.createElement('div');
                seasonDiv.style.cssText = `
                    grid-column: 1 / -1;
                    margin-bottom: 20px;
                `;
                
                const seasonTitle = document.createElement('h3');
                seasonTitle.textContent = `Сезон ${seasonNum}`;
                seasonTitle.style.cssText = `
                    color: #3498db;
                    margin: 0 10px 0;
                    border-bottom: 1px solid #3498db;
                    padding-bottom: 5px;
                `;
                seasonDiv.appendChild(seasonTitle);
                
                const seasonEpisodes = document.createElement('div');
                seasonEpisodes.style.cssText = `
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                `;
                
                episodesBySeason[seasonNum].sort((a, b) => a.episode_number - b.episode_number).forEach(episode => {
                    const episodeCard = document.createElement('div');
                    episodeCard.className = 'episode-card';
                    episodeCard.style.cssText = `
                        background: #34495e;
                        border-radius: 5px;
                        padding: 10px;
                        min-width: 150px;
                        cursor: pointer;
                        transition: background 0.3s;
                        border: 1px solid #4a5f7a;
                    `;
                    episodeCard.onmouseover = () => episodeCard.style.background = '#3d566e';
                    episodeCard.onmouseout = () => episodeCard.style.background = '#34495e';
                    
                    const episodeTitle = document.createElement('div');
                    episodeTitle.textContent = `Эпизод ${episode.episode_number}`;
                    episodeTitle.style.cssText = `
                        color: #ecf0f1;
                        font-weight: bold;
                        margin-bottom: 5px;
                    `;
                    
                    const episodeSubtitle = document.createElement('div');
                    episodeSubtitle.textContent = episode.title || `Эпизод ${episode.episode_number}`;
                    episodeSubtitle.style.cssText = `
                        color: #bdc3c7;
                        font-size: 0.9em;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    `;
                    
                    episodeCard.appendChild(episodeTitle);
                    episodeCard.appendChild(episodeSubtitle);
                    
                    // Обработчик клика для воспроизведения эпизода
                    episodeCard.addEventListener('click', (e) => {
                        // Проверяем, был ли клик по кнопке редактирования, чтобы не открывать плеер
                        if (e.target.tagName === 'BUTTON') {
                            return;
                        }
                        
                        if (episode.file_path) {
                            // Закрываем модальное окно эпизодов перед открытием плеера
                            const episodesModal = document.getElementById('episodes-modal');
                            if (episodesModal) {
                                episodesModal.remove();
                            }
                            openVideoPlayer(episode.file_path, `${tvshowTitle} - S${episode.season_number}E${episode.episode_number} - ${episode.title || `Эпизод ${episode.episode_number}`}`);
                        } else {
                            alert(`Файл для этого эпизода ещё не загружен`);
                        }
                        
                        // Функция для редактирования эпизода
                        async function editEpisode(episode, tvshowId) {
                            // Создаем модальное окно для редактирования эпизода
                            const modal = document.createElement('div');
                            modal.style.cssText = `
                                position: fixed; inset: 0; background: rgba(0,0,0,0.8);
                                display: flex; align-items: center; justify-content: center;
                                z-index: 10001; padding: 20px; box-sizing: border-box;
                            `;
                            
                            const container = document.createElement('div');
                            container.style.cssText = `
                                background: #2c3e50;
                                border-radius: 8px;
                                padding: 20px;
                                width: 90%;
                                max-width: 500px;
                                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                            `;
                            
                            const title = document.createElement('h3');
                            title.textContent = `Редактировать эпизод: ${episode.title || `Эпизод ${episode.episode_number}`}`;
                            title.style.cssText = `
                                color: white;
                                margin-top: 0;
                                text-align: center;
                            `;
                            
                            const form = document.createElement('form');
                            form.style.cssText = `
                                display: flex;
                                flex-direction: column;
                                gap: 15px;
                            `;
                            
                            const titleInput = document.createElement('input');
                            titleInput.type = 'text';
                            titleInput.value = episode.title || `Эпизод ${episode.episode_number}`;
                            titleInput.placeholder = 'Название эпизода';
                            titleInput.style.cssText = `
                                padding: 10px;
                                border-radius: 4px;
                                border: 1px solid #555;
                                background: #34495e;
                                color: white;
                            `;
                            
                            const fileInput = document.createElement('input');
                            fileInput.type = 'file';
                            fileInput.accept = 'video/*,.mp4,.avi,.mov,.mkv,.wmv,.flv,.webm';
                            fileInput.style.cssText = `
                                padding: 10px;
                                border-radius: 4px;
                                border: 1px solid #555;
                                background: #34495e;
                                color: white;
                            `;
                            
                            const fileLabel = document.createElement('label');
                            fileLabel.textContent = 'Заменить файл эпизода (необязательно):';
                            fileLabel.style.color = 'white';
                            
                            const buttonContainer = document.createElement('div');
                            buttonContainer.style.cssText = `
                                display: flex;
                                gap: 10px;
                                margin-top: 15px;
                            `;
                            
                            const saveBtn = document.createElement('button');
                            saveBtn.type = 'submit';
                            saveBtn.textContent = 'Сохранить';
                            saveBtn.style.cssText = `
                                flex: 1;
                                padding: 10px;
                                background: #3498db;
                                color: white;
                                border: none;
                                border-radius: 4px;
                                cursor: pointer;
                            `;
                            
                            const cancelBtn = document.createElement('button');
                            cancelBtn.type = 'button';
                            cancelBtn.textContent = 'Отмена';
                            cancelBtn.style.cssText = `
                                flex: 1;
                                padding: 10px;
                                background: #7f8c8d;
                                color: white;
                                border: none;
                                border-radius: 4px;
                                cursor: pointer;
                            `;
                            cancelBtn.onclick = () => modal.remove();
                            
                            form.appendChild(titleInput);
                            form.appendChild(fileLabel);
                            form.appendChild(fileInput);
                            buttonContainer.appendChild(saveBtn);
                            buttonContainer.appendChild(cancelBtn);
                            form.appendChild(buttonContainer);
                            
                            container.appendChild(title);
                            container.appendChild(form);
                            modal.appendChild(container);
                            document.body.appendChild(modal);
                            
                            form.onsubmit = async (e) => {
                                e.preventDefault();
                                try {
                                    // Обновляем данные эпизода
                                    const updatedData = {
                                        tvshow_id: episode.tvshow_id,
                                        season_number: episode.season_number,
                                        episode_number: episode.episode_number,
                                        title: titleInput.value,
                                        description: episode.description || ""
                                    };
                        
                                    await updateEpisode(episode.id, updatedData);
                                    
                                    // Если выбран файл, загружаем его
                                    if (fileInput.files.length > 0) {
                                        const file = fileInput.files[0];
                                        await uploadEpisodeFile(episode.id, file);
                                        alert('Эпизод и файл успешно обновлены!');
                                    } else {
                                        alert('Эпизод успешно обновлён!');
                                    }
                        
                                    // Закрываем модальное окно
                                    modal.remove();
                                    
                                    // Перезагружаем модальное окно с обновленными данными
                                    const episodesModal = document.getElementById('episodes-modal');
                                    // Получаем заголовок сериала из заголовка модального окна перед его удалением
                                    const modalTitle = episodesModal ? episodesModal.querySelector('h2')?.textContent || '' : '';
                                    const tvshowName = modalTitle ? modalTitle.replace('Эпизоды: ', '') : '';
                                    if (episodesModal) {
                                        episodesModal.remove();
                                    }
                                    showEpisodesList(tvshowId, tvshowName || `TV Show ${tvshowId}`);
                                } catch (error) {
                                    console.error('Ошибка при обновлении эпизода:', error);
                                    alert('Ошибка при обновлении эпизода');
                                }
                            };
                        }
                        
                        // Функция для удаления эпизода по ID
                        async function deleteEpisodeById(episodeId, episodeCard, tvshowId) {
                            try {
                                await deleteEpisode(episodeId);
                                // Удаляем элемент из DOM
                                episodeCard.remove();
                                alert('Эпизод успешно удалён!');
                            } catch (error) {
                                console.error('Ошибка при удалении эпизода:', error);
                                alert('Ошибка при удалении эпизода');
                            }
                        }
                    });
                    
                    // Создаем контейнер для кнопок действия
                    const actionButtons = document.createElement('div');
                    actionButtons.style.cssText = `
                        display: flex;
                        gap: 5px;
                        margin-top: 8px;
                    `;
                    
                    // Кнопка редактирования эпизода
                    const editBtn = document.createElement('button');
                    editBtn.textContent = '✏';
                    editBtn.title = 'Редактировать эпизод';
                    editBtn.style.cssText = `
                        background: #3498db;
                        color: white;
                        border: none;
                        border-radius: 3px;
                        padding: 3px 6px;
                        font-size: 12px;
                        cursor: pointer;
                        flex: 1;
                    `;
                    editBtn.onclick = (e) => {
                        e.stopPropagation(); // Останавливаем всплытие, чтобы не вызвать проигрывание
                        editEpisode(episode, tvshowId);
                    };
                    
                    // Кнопка удаления эпизода
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = '🗑';
                    deleteBtn.title = 'Удалить эпизод';
                    deleteBtn.style.cssText = `
                        background: #e74c3c;
                        color: white;
                        border: none;
                        border-radius: 3px;
                        padding: 3px 6px;
                        font-size: 12px;
                        cursor: pointer;
                        flex: 1;
                    `;
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation(); // Останавливаем всплытие, чтобы не вызвать проигрывание
                        if (confirm(`Удалить эпизод "${episode.title || `Эпизод ${episode.episode_number}`}"?`)) {
                            deleteEpisodeById(episode.id, episodeCard, tvshowId);
                        }
                    };
                    
                    actionButtons.appendChild(editBtn);
                    actionButtons.appendChild(deleteBtn);
                    episodeCard.appendChild(actionButtons);
                    
                    seasonEpisodes.appendChild(episodeCard);
                });
                
                seasonDiv.appendChild(seasonEpisodes);
                episodesList.appendChild(seasonDiv);
            });
        }
        
        container.appendChild(closeBtn);
        container.appendChild(title);
        container.appendChild(episodesList);
        modal.appendChild(container);
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Ошибка при загрузке эпизодов:', error);
        alert('Ошибка при загрузке списка эпизодов');
    }
}

// Функция для редактирования эпизода
async function editEpisode(episode, tvshowId) {
    // Открываем модальное окно для редактирования эпизода
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.8);
        display: flex; align-items: center; justify-content: center;
        z-index: 10001; padding: 20px; box-sizing: border-box;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
        background: #2c3e50;
        border-radius: 8px;
        padding: 20px;
        width: 90%;
        max-width: 500px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    const title = document.createElement('h3');
    title.textContent = `Редактировать эпизод: ${episode.title || `Эпизод ${episode.episode_number}`}`;
    title.style.cssText = `
        color: white;
        margin-top: 0;
        text-align: center;
    `;
    
    const form = document.createElement('form');
    form.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 15px;
    `;
    
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = episode.title || `Эпизод ${episode.episode_number}`;
    titleInput.placeholder = 'Название эпизода';
    titleInput.style.cssText = `
        padding: 10px;
        border-radius: 4px;
        border: 1px solid #555;
        background: #34495e;
        color: white;
    `;
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'video/*,.mp4,.avi,.mov,.mkv,.wmv,.flv,.webm';
    fileInput.style.cssText = `
        padding: 10px;
        border-radius: 4px;
        border: 1px solid #555;
        background: #34495e;
        color: white;
    `;
    
    const fileLabel = document.createElement('label');
    fileLabel.textContent = 'Заменить файл эпизода (необязательно):';
    fileLabel.style.color = 'white';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-top: 15px;
    `;
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.textContent = 'Сохранить';
    saveBtn.style.cssText = `
        flex: 1;
        padding: 10px;
        background: #3498db;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.style.cssText = `
        flex: 1;
        padding: 10px;
        background: #7f8c8d;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    cancelBtn.onclick = () => modal.remove();
    
    form.appendChild(titleInput);
    form.appendChild(fileLabel);
    form.appendChild(fileInput);
    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);
    form.appendChild(buttonContainer);
    
    container.appendChild(title);
    container.appendChild(form);
    modal.appendChild(container);
    document.body.appendChild(modal);
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        try {
            // Обновляем данные эпизода
            const updatedData = {
                tvshow_id: episode.tvshow_id,
                season_number: episode.season_number,
                episode_number: episode.episode_number,
                title: titleInput.value,
                description: episode.description || ""
            };

            await updateEpisode(episode.id, updatedData);
            
            // Если выбран файл, загружаем его
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                await uploadEpisodeFile(episode.id, file);
                alert('Эпизод и файл успешно обновлены!');
            } else {
                alert('Эпизод успешно обновлён!');
            }

            // Закрываем модальное окно
            modal.remove();
            
            // Перезагружаем модальное окно с обновленными данными
            const episodesModal = document.getElementById('episodes-modal');
            // Получаем заголовок сериала из заголовка модального окна перед его удалением
            const modalTitle = episodesModal ? episodesModal.querySelector('h2')?.textContent || '' : '';
            const tvshowName = modalTitle ? modalTitle.replace('Эпизоды: ', '') : '';
            if (episodesModal) {
                episodesModal.remove();
            }
            showEpisodesList(tvshowId, tvshowName || `TV Show ${tvshowId}`);
        } catch (error) {
            console.error('Ошибка при обновлении эпизода:', error);
            alert('Ошибка при обновлении эпизода');
        }
    };
}

// Функция для удаления эпизода по ID
async function deleteEpisodeById(episodeId, episodeCard, tvshowId) {
    try {
        await deleteEpisode(episodeId);
        // Удаляем элемент из DOM
        episodeCard.remove();
        alert('Эпизод успешно удалён!');
    } catch (error) {
        console.error('Ошибка при удалении эпизода:', error);
        alert('Ошибка при удалении эпизода');
    }
}