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
    const genres = currentCategory === 'movie' ? MOVIE_GENRES : BOOK_GENRES;

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
    const genres = currentCategory === 'movie' ? MOVIE_GENRES : BOOK_GENRES;

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
                : await fetchBooks();
        } else {
            const allItems = currentCategory === 'movie' 
                ? await fetchMovies() 
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

        // Путь к изображению
        const thumbnailUrl = item.thumbnail_path 
            ? `/${item.thumbnail_path.replace(/\\/g, '/')}` 
            : (currentCategory === 'movie' 
                ? '/static/movie-placeholder.jpg' 
                : '/static/book-placeholder.jpg');

        // Создаём изображение отдельно
        const img = document.createElement('img');
        img.src = thumbnailUrl;
        img.alt = item.title || 'Без названия';
        img.className = 'thumbnail';
        img.style.cursor = 'pointer';

        // Добавляем обработчик клика
        img.addEventListener('click', () => {
            if (currentCategory === 'movie') {
                if (item.file_path) {
                    // Экранирование уже не нужно — передаём напрямую
                    openVideoPlayer(item.file_path, item.title || 'Без названия');
                } else {
                    alert('Видеофайл для этого фильма ещё не загружен');
                }
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
            <strong>${currentCategory === 'movie' ? 'Режиссёр' : 'Автор'}:</strong> 
            ${escapeHtml(currentCategory === 'movie' ? item.director || '—' : item.author || '—')}
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

        if (currentCategory === 'movie') {
            data.director = document.getElementById('director-author').value.trim() || null;
        } else {
            data.author = document.getElementById('director-author').value.trim() || null;
        }

        let itemId;
        if (editingItem) {
            // Обновление
            await (currentCategory === 'movie' 
                ? updateMovie(editingItem.id, data) 
                : updateBook(editingItem.id, data));
            itemId = editingItem.id;
        } else {
            // Создание
            const newItem = await (currentCategory === 'movie' 
                ? createMovie(data) 
                : createBook(data));
            itemId = newItem.id;
        }

        // Загрузка файлов
        const fileInput = document.getElementById('file');
        const thumbInput = document.getElementById('thumbnail');

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const endpoint = currentCategory === 'movie'
                ? `/movies/${itemId}/upload`
                : `/books/${itemId}/upload`;
            await uploadFile(endpoint, file, p => updateProgress(20 + p * 50 / 100));
        }

        if (thumbInput.files.length > 0) {
            const file = thumbInput.files[0];
            const endpoint = currentCategory === 'movie'
                ? `/movies/${itemId}/upload_thumbnail`
                : `/books/${itemId}/upload_thumbnail`;
            await uploadFile(endpoint, file, p => updateProgress(70 + p * 30 / 100));
        }

        updateProgress(100);
        setTimeout(() => {
            loadItems();
            showViewMode();
            hideProgress();
            showLoading(false);
            document.getElementById('item-form').reset();
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
        : await fetchBook(id);
    
    editingItem = item;

    document.getElementById('title').value = item.title;
    document.getElementById('year').value = item.year || '';
    document.getElementById('director-author').value = 
        currentCategory === 'movie' ? (item.director || '') : (item.author || '');
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
}

async function deleteItem(id) {
    if (!confirm('Удалить этот элемент навсегда?')) return;

    try {
        currentCategory === 'movie' 
            ? await deleteMovie(id) 
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
    editingItem = null;
    document.getElementById('form-title').textContent = 'Добавить новый элемент';
    document.getElementById('submit-btn').textContent = 'Добавить';
}

function updateFormLabels() {
    const isMovie = currentCategory === 'movie';

    document.getElementById('file-label-text').textContent = 
        isMovie ? 'Файл видео' : 'Файл книги (PDF, DjVu, CBZ, EPUB)';

    document.getElementById('director-author').placeholder = 
        isMovie ? 'Режиссёр' : 'Автор';

    document.getElementById('thumbnail-upload-container').style.display = 
        isMovie ? 'block' : 'block'; // можно скрыть для книг, если хотите

    document.getElementById('file').accept = isMovie 
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
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
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

// =============================================
// Функции открытия плеера и читалки
// =============================================

// Для фильмов — открытие видео-плеера
// Открытие видеоплеера в модальном окне
function openVideoPlayer(filePath, title) {

    if (!filePath) {
        alert("Путь к файлу не указан");
        return;
    }

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