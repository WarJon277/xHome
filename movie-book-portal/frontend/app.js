let currentCategory = 'movie';
let editingItem = null;

document.addEventListener('DOMContentLoaded', () => {
    loadItems();

    document.getElementById('show-movies').addEventListener('click', () => {
        currentCategory = 'movie';
        document.getElementById('category').value = 'movie';
        loadItems();
        updateFormLabels();
    });

    document.getElementById('show-books').addEventListener('click', () => {
        currentCategory = 'book';
        document.getElementById('category').value = 'book';
        loadItems();
        updateFormLabels();
    });

    document.getElementById('search').addEventListener('input', handleSearch);

    document.getElementById('category').addEventListener('change', () => {
        currentCategory = document.getElementById('category').value;
        updateFormLabels();
    });

    document.getElementById('item-form').addEventListener('submit', handleSubmit);

    document.getElementById('show-view').addEventListener('click', showViewMode);
    document.getElementById('show-add').addEventListener('click', showAddMode);

    document.getElementById('file').addEventListener('change', updateFileInfo);
    document.getElementById('thumbnail').addEventListener('change', updateThumbnailInfo);

    updateFormLabels();
});

function updateFormLabels() {
    const isMovie = currentCategory === 'movie';

    // Меняем текст лейблов
    document.getElementById('file-label-text').textContent =
        isMovie ? 'Файл видео' : 'Файл книги (PDF, DjVu, CBZ, EPUB)';

    document.getElementById('director-author').placeholder =
        isMovie ? 'Режиссёр' : 'Автор';

    // ВАЖНО: теперь поле миниатюры ВСЕГДА видно
    document.getElementById('thumbnail-upload-container').style.display = 'block';

    // Меняем текст лейбла миниатюры
    const thumbLabel = document.querySelector('#thumbnail-upload-container label');
    if (thumbLabel) {
        thumbLabel.textContent = isMovie
            ? 'Миниатюра (обложка фильма):'
            : 'Миниатюра (обложка книги, опционально):';
    }

    // Поле файла всегда видно
    document.getElementById('file-upload-container').style.display = 'block';
    
    // Динамически обновляем атрибут accept для файла в зависимости от категории
    const fileInput = document.getElementById('file');
    if (isMovie) {
        fileInput.accept = 'video/*,.mp4,.avi,.mov,.mkv,.wmv,.flv,.webm,.m4v,.3gp,.3g2,.ogv,.qt';
    } else {
        fileInput.accept = '.pdf,.djvu,.djv,.cbz,.zip,.epub';
    }
}

async function loadItems() {
    const items = currentCategory === 'movie' ? await fetchMovies() : await fetchBooks();
    displayItems(items);
}

async function handleSearch() {
    const query = document.getElementById('search').value.trim();
    if (query) {
        const items = currentCategory === 'movie'
            ? await searchMovies(query)
            : await searchBooks(query);
        displayItems(items);
    } else {
        loadItems();
    }
}

function displayItems(items) {
    const grid = document.getElementById('items-grid');
    grid.innerHTML = '';

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';

        // Определяем путь к миниатюре
        let thumbnailUrl = '/static/book-placeholder.jpg'; // дефолт для книг
        if (currentCategory === 'movie') {
            thumbnailUrl = item.thumbnail_path || '/static/movie-placeholder.jpg';
        } else if (item.thumbnail_path) {
            thumbnailUrl = '/' + item.thumbnail_path; // добавляем слеш, если путь относительный
        }

        // Экранируем HTML для безопасности
        const safeTitle = escapeHtml(item.title);

        // Разное поведение при клике: фильмы — плеер, книги — новая читалка в отдельном окне
        let onclickAction;
        if (currentCategory === 'movie') {
            onclickAction = `openVideoPlayer('${item.file_path}', '${safeTitle}')`;
        } else {
            // Открываем читалку в новом окне — красиво, без панелей браузера
            onclickAction = `openBookReader(${item.id})`;
        }

        // HTML миниатюры с кликом
        const mediaHtml = `
            <img src="${thumbnailUrl}" 
                 class="thumbnail" 
                 alt="${safeTitle}"
                 onclick="${onclickAction}" 
                 style="cursor: pointer;">
        `;

        // Формируем карточку
        card.innerHTML = `
            ${mediaHtml}
            <h3>${safeTitle}</h3>
            <p><strong>${currentCategory === 'movie' ? 'Режиссёр' : 'Автор'}:</strong> 
               ${escapeHtml(currentCategory === 'movie' ? item.director || 'Не указан' : item.author || 'Не указан')}
            </p>
            <p>Год: ${item.year || '—'} | Жанр: ${escapeHtml(item.genre || '—')} | Рейтинг: ${item.rating || '—'}</p>
            <p>${truncateDescription(escapeHtml(item.description || 'Нет описания'), 100)}</p>
            <div style="margin-top: auto; display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="edit-btn" onclick="editItem(${item.id})">Редактировать</button>
                <button class="delete-btn" onclick="deleteItem(${item.id})">Удалить</button>
            </div>
        `;

        grid.appendChild(card);
    });
}

// Новая функция для открытия читалки книг в отдельном окне
function openBookReader(bookId) {
    const width = window.screen.width > 1200 ? 1200 : window.screen.width - 100;
    const height = window.screen.height > 800 ? 800 : window.screen.height - 100;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const readerWindow = window.open(
        `/reader.html?bookId=${bookId}`,
        `bookReader_${bookId}`,
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,location=no,directories=no,status=no,menubar=no,copyhistory=no`
    );

    if (readerWindow) {
        readerWindow.focus();
    } else {
        alert('Не удалось открыть читалку. Разрешите всплывающие окна для этого сайта.');
    }
}

function truncateDescription(description, maxLength) {
    const words = description.split(/\s+/);
    if (words.length <= maxLength) {
        return description;
    }
    return words.slice(0, maxLength).join(' ') + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// === ПОЛНОЦЕННЫЙ ВИДЕОПЛЕЕР PLYR ===
function openVideoPlayer(filePath, title) {
    if (!filePath) {
        alert('Видео файл не загружен');
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'video-modal';

    const videoContainer = document.createElement('div');
    videoContainer.className = 'plyr-container';

    const videoElement = document.createElement('video');
    videoElement.className = 'plyr';
    videoElement.controls = true;
    videoElement.preload = 'metadata';
    videoElement.playsInline = true;

    const source = document.createElement('source');
    source.src = '/' + filePath;
    source.type = getVideoType(filePath);
    videoElement.appendChild(source);

    videoContainer.appendChild(videoElement);

    const titleElement = document.createElement('h3');
    titleElement.textContent = title;

    modal.appendChild(videoContainer);
    modal.appendChild(titleElement);
    document.body.appendChild(modal);

    const player = new Plyr(videoElement, {
        controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
        volume: 0.7,
        clickToPlay: true,
        keyboard: { focused: true, global: true },
        hideControls: true,
        controlsTimeout: 3000
    });

    player.on('ready', () => {
        const closeControl = document.createElement('button');
        closeControl.type = 'button';
        closeControl.className = 'plyr__control plyr__control--close';
        closeControl.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/></svg>
            <span class="plyr__tooltip">Закрыть</span>
        `;
        closeControl.onclick = closeModal;
        player.elements.controls.appendChild(closeControl);
    });

    player.on('error', () => {
        modal.innerHTML = `
            <div style="padding: 30px; text-align: center; color: white;">
                <h3>Ошибка воспроизведения</h3>
                <p>Формат видео не поддерживается браузером.</p>
                <a href="/${filePath}" download="${title}" style="display: inline-block; margin: 20px; padding: 12px 24px; background: #4caf50; color: white; text-decoration: none; border-radius: 6px;">Скачать видео</a>
                <p>Рекомендуем плеер VLC или MPC-HC</p>
                <button onclick="this.closest('#video-modal').remove()" style="margin-top: 20px; padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 6px;">Закрыть</button>
            </div>
        `;
    });

    function closeModal() {
        player.destroy();
        modal.remove();
        document.removeEventListener('keydown', handleEsc);
    }

    const handleEsc = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', handleEsc);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function getVideoType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const map = {
        mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', ogv: 'video/ogg',
        mov: 'video/quicktime', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv',
        flv: 'video/x-flv', mkv: 'video/x-matroska', m4v: 'video/mp4'
    };
    return map[ext] || 'video/mp4';
}

// === РАБОТА С ФОРМОЙ ===
function updateFileInfo() {
    const file = document.getElementById('file').files[0];
    const info = document.getElementById('file-info');
    if (file) {
        const size = (file.size / (1024 * 1024)).toFixed(2);
        info.textContent = `Выбран: ${file.name} (${size} МБ)`;
        info.style.color = '#aaa';
    } else {
        info.textContent = '';
    }
}

function updateThumbnailInfo() {
    const file = document.getElementById('thumbnail').files[0];
    const info = document.getElementById('thumbnail-info');
    if (file) {
        const size = (file.size / (1024 * 1024)).toFixed(2);
        info.textContent = `Миниатюра: ${file.name} (${size} МБ)`;
    } else {
        info.textContent = '';
    }
}

function showViewMode() {
    document.getElementById('add-form').style.display = 'none';
    document.getElementById('items-grid').style.display = 'grid';
    document.getElementById('item-form').reset();
    document.getElementById('file-info').textContent = '';
    document.getElementById('thumbnail-info').textContent = '';
    document.getElementById('submit-btn').textContent = 'Добавить';
    document.getElementById('form-title').textContent = 'Добавить новый элемент';
    // Убираем required при возврате к просмотру
    document.getElementById('file').removeAttribute('required');
    editingItem = null;
}

function showAddMode() {
    document.getElementById('add-form').style.display = 'block';
    document.getElementById('items-grid').style.display = 'none';
    updateFormLabels();
    // Устанавливаем required атрибут только если мы создаем новый элемент, а не редактируем
    const fileInput = document.getElementById('file');
    if (!editingItem) {
        fileInput.setAttribute('required', '');
    } else {
        fileInput.removeAttribute('required');
    }
}

async function handleSubmit(e) {
    e.preventDefault();

    const loading = document.getElementById('loading-message');
    const error = document.getElementById('error-message');
    const progressContainer = document.getElementById('progress-container');

    loading.style.display = 'block';
    error.style.display = 'none';
    progressContainer.style.display = 'none';

    try {
        const title = document.getElementById('title').value.trim();
        const year = parseInt(document.getElementById('year').value);
        const directorAuthor = document.getElementById('director-author').value.trim();
        const genre = document.getElementById('genre').value.trim();
        let ratingValue = document.getElementById('rating').value;
        ratingValue = ratingValue.replace(',', '.');
        const rating = parseFloat(ratingValue);
        const description = document.getElementById('description').value.trim();

        const file = document.getElementById('file').files[0];
        const thumbnail = document.getElementById('thumbnail').files[0];

        const data = currentCategory === 'movie'
            ? { title, year, director: directorAuthor, genre, rating, description }
            : { title, year, author: directorAuthor, genre, rating, description };

        let item;
        if (editingItem) {
            item = currentCategory === 'movie'
                ? await updateMovie(editingItem.id, data)
                : await updateBook(editingItem.id, data);
        } else {
            item = currentCategory === 'movie'
                ? await createMovie(data)
                : await createBook(data);
        }

        // Для новых элементов файл обязателен, для редактирования - опционально
        if (file) {
            progressContainer.style.display = 'block';
            document.getElementById('progress').style.width = '0%';
            document.getElementById('progress-text').textContent = '0%';

            const endpoint = currentCategory === 'movie'
                ? `/movies/${item.id}/upload`
                : `/books/${item.id}/upload`;

            await uploadFile(endpoint, file, (percent) => {
                document.getElementById('progress').style.width = `${percent}%`;
                document.getElementById('progress-text').textContent = `${percent}%`;
            });
        } else if (!editingItem) {
            // Если это создание нового элемента и файл не выбран - показываем ошибку
            throw new Error('Файл обязателен при создании нового элемента');
        }

        // Загрузка миниатюры — теперь и для книг тоже
        if (thumbnail) {
            const thumbEndpoint = currentCategory === 'movie'
                ? `/movies/${item.id}/upload_thumbnail`
                : `/books/${item.id}/upload_thumbnail`;

            await uploadFile(thumbEndpoint, thumbnail);
        }

        loadItems();
        showViewMode();
    } catch (err) {
        console.error(err);
        error.textContent = err.message || 'Произошла ошибка';
        error.style.display = 'block';
    } finally {
        loading.style.display = 'none';
    }
}

async function uploadFile(endpoint, file, onProgress) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                const percent = Math.round((e.loaded / e.total) * 100);
                onProgress(percent);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error('Ошибка загрузки'));
            }
        };

        xhr.onerror = () => reject(new Error('Сетевая ошибка'));

        xhr.open('POST', endpoint);
        xhr.send(formData);
    });
}

async function editItem(id) {
    showAddMode();

    const item = currentCategory === 'movie' ? await fetchMovie(id) : await fetchBook(id);
    editingItem = item;

    document.getElementById('category').value = currentCategory;
    document.getElementById('title').value = item.title;
    document.getElementById('year').value = item.year;
    document.getElementById('director-author').value = currentCategory === 'movie' ? item.director : item.author;
    document.getElementById('genre').value = item.genre;
    document.getElementById('rating').value = item.rating;
    document.getElementById('description').value = item.description || '';

    document.getElementById('form-title').textContent = 'Редактировать элемент';
    document.getElementById('submit-btn').textContent = 'Сохранить';

    updateFormLabels();

    if (currentCategory === 'movie' && item.thumbnail_path) {
        document.getElementById('thumbnail-info').textContent = `Текущая: ${item.thumbnail_path.split('/').pop()}`;
    }

    document.getElementById('file-info').textContent = item.file_path ? 'Файл уже загружен' : '';
    
    // При редактировании убираем required атрибут с поля файла
    document.getElementById('file').removeAttribute('required');
}

async function deleteItem(id) {
    if (!confirm('Удалить этот элемент навсегда?')) return;

    try {
        currentCategory === 'movie' ? await deleteMovie(id) : await deleteBook(id);
        loadItems();
    } catch (err) {
        alert('Ошибка при удалении');
    }
}