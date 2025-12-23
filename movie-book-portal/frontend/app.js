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

    document.getElementById('file-label-text').textContent =
        isMovie ? 'Файл видео' : 'Файл книги (PDF, DjVu, CBZ, EPUB)';

    document.getElementById('director-author').placeholder =
        isMovie ? 'Режиссёр' : 'Автор';

    document.getElementById('thumbnail-upload-container').style.display = 'block';

    const thumbLabel = document.querySelector('#thumbnail-upload-container label');
    if (thumbLabel) {
        thumbLabel.textContent = isMovie
            ? 'Миниатюра (обложка фильма):'
            : 'Миниатюра (обложка книги, опционально):';
    }

    document.getElementById('file-upload-container').style.display = 'block';

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

        let thumbnailUrl = '/static/book-placeholder.jpg';
        if (currentCategory === 'movie') {
            thumbnailUrl = item.thumbnail_path || '/static/movie-placeholder.jpg';
        } else if (item.thumbnail_path) {
            thumbnailUrl = '/' + item.thumbnail_path;
        }

        const safeTitle = escapeHtml(item.title);

        let onclickAction;
        if (currentCategory === 'movie') {
            onclickAction = `openVideoPlayer('${item.file_path}', '${safeTitle}')`;
        } else {
            onclickAction = `openBookReader(${item.id})`;
        }

        const mediaHtml = `
            <img src="${thumbnailUrl}" 
                 class="thumbnail" 
                 alt="${safeTitle}"
                 onclick="${onclickAction}" 
                 style="cursor: pointer;">
        `;

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

function openBookReader(bookId) {
    const width = Math.min(1200, window.screen.width - 100);
    const height = Math.min(800, window.screen.height - 100);
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

function truncateDescription(description, maxWords = 100) {
    const words = description.split(/\s+/);
    if (words.length <= maxWords) return description;
    return words.slice(0, maxWords).join(' ') + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// === ВИДЕОПЛЕЕР ===
function openVideoPlayer(filePath, title) {
    if (!filePath) {
        alert('Видео файл не загружен');
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'video-modal';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(0,0,0,0.95)';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';
    modal.style.padding = '20px';

    // Кнопка закрытия (крестик в углу)
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '20px';
    closeBtn.style.right = '20px';
    closeBtn.style.width = '40px';
    closeBtn.style.height = '40px';
    closeBtn.style.background = 'rgba(0,0,0,0.6)';
    closeBtn.style.color = 'white';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.zIndex = '10000';
    closeBtn.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
    closeBtn.title = 'Закрыть (Esc)';

    const videoContainer = document.createElement('div');
    videoContainer.className = 'plyr-container';
    videoContainer.style.maxWidth = '95vw';
    videoContainer.style.maxHeight = '85vh';
    videoContainer.style.position = 'relative';

    const videoElement = document.createElement('video');
    videoElement.className = 'plyr';
    videoElement.controls = true;
    videoElement.playsInline = true;

    const source = document.createElement('source');
    source.src = '/' + filePath;
    source.type = getVideoType(filePath);
    videoElement.appendChild(source);

    videoContainer.appendChild(videoElement);

    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    titleEl.style.color = 'white';
    titleEl.style.margin = '15px 0 5px';
    titleEl.style.textAlign = 'center';
    titleEl.style.maxWidth = '90%';
    titleEl.style.overflow = 'hidden';
    titleEl.style.textOverflow = 'ellipsis';
    titleEl.style.whiteSpace = 'nowrap';

    modal.appendChild(closeBtn);
    modal.appendChild(videoContainer);
    modal.appendChild(titleEl);
    document.body.appendChild(modal);

    const player = new Plyr(videoElement, {
        controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
        hideControls: true,
        keyboard: { focused: true, global: true }
    });

    // Функция закрытия
    const closeModal = () => {
        player.destroy();
        modal.remove();
        document.removeEventListener('keydown', escHandler);
    };

    // Обработчики закрытия
    closeBtn.onclick = closeModal;

    const escHandler = (e) => {
        if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);

    // Клик по фону
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Автофокус на плеере
    player.on('ready', () => {
        player.play();
    });
}

function getVideoType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const types = {
        mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', ogv: 'video/ogg',
        mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska'
    };
    return types[ext] || 'video/mp4';
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ФОРМЫ ===
function showLoading(show = true) {
    const el = document.getElementById('loading-message');
    if (el) el.style.display = show ? 'block' : 'none';
}

function hideLoading() {
    showLoading(false);
}

function showError(message) {
    const el = document.getElementById('error-message');
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 6000);
    } else {
        alert(message);
    }
}

function updateProgress(percent) {
    const container = document.getElementById('progress-container');
    const bar = document.getElementById('progress');
    const text = document.getElementById('progress-text');
    if (container && bar && text) {
        container.style.display = 'block';
        bar.style.width = percent + '%';
        text.textContent = Math.round(percent) + '%';
    }
}

function hideProgress() {
    const container = document.getElementById('progress-container');
    if (container) {
        container.style.display = 'none';
        document.getElementById('progress').style.width = '0%';
        document.getElementById('progress-text').textContent = '0%';
    }
}

function resetForm() {
    document.getElementById('item-form').reset();
    document.getElementById('file-info').textContent = '';
    document.getElementById('thumbnail-info').textContent = '';
    document.getElementById('form-title').textContent = 'Добавить новый элемент';
    document.getElementById('submit-btn').textContent = 'Добавить';
}

function showViewMode() {
    document.getElementById('add-form').style.display = 'none';
    document.getElementById('items-grid').style.display = 'grid';
    resetForm();
    document.getElementById('file').removeAttribute('required');
    editingItem = null;
}

function showAddMode() {
    document.getElementById('add-form').style.display = 'block';
    document.getElementById('items-grid').style.display = 'none';
    updateFormLabels();
    if (!editingItem) {
        document.getElementById('file').setAttribute('required', '');
    } else {
        document.getElementById('file').removeAttribute('required');
    }
}

function updateFileInfo() {
    const file = document.getElementById('file').files[0];
    const info = document.getElementById('file-info');
    if (file) {
        const size = (file.size / (1024 * 1024)).toFixed(2);
        info.textContent = `Выбран: ${file.name} (${size} МБ)`;
        info.style.color = '#aaa';
    } else {
        info.textContent = editingItem?.file_path ? 'Файл уже загружен' : '';
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

// === ОСНОВНАЯ ФУНКЦИЯ ОТПРАВКИ ФОРМЫ ===
async function handleSubmit(e) {
    e.preventDefault();

    const category = document.getElementById('category').value;
    let title = document.getElementById('title').value.trim() || 'Без названия';
    let year = document.getElementById('year').value;
    let authorDirector = document.getElementById('director-author').value.trim();
    let genre = document.getElementById('genre').value.trim();
    let rating = document.getElementById('rating').value;
    const description = document.getElementById('description').value.trim();
    const fileInput = document.getElementById('file');
    const thumbnailInput = document.getElementById('thumbnail');

    year = year ? parseInt(year) : null;
    rating = rating ? parseFloat(rating) : null;

    if (year !== null && isNaN(year)) {
        showError('Год должен быть числом');
        return;
    }
    if (rating !== null && (isNaN(rating) || rating < 0 || rating > 10)) {
        showError('Рейтинг должен быть от 0 до 10');
        return;
    }

    const data = {
        title,
        year,
        genre: genre || null,
        rating,
        description: description || null
    };

    if (category === 'movie') {
        data.director = authorDirector || null;
    } else {
        data.author = authorDirector || null;
    }

    try {
        showLoading(true);
        updateProgress(5);

        let itemId;

        if (editingItem) {
            const updateFn = category === 'movie' ? updateMovie : updateBook;
            await updateFn(editingItem.id, data);
            itemId = editingItem.id;
            console.log('Редактирование: ID =', itemId);
        } else {
            const createFn = category === 'movie' ? createMovie : createBook;
            const response = await createFn(data);
            console.log('Ответ от сервера после создания:', response); // ← ВАЖНО: посмотрите в консоль!

            if (!response || !response.id) {
                throw new Error('Сервер не вернул ID нового элемента. Ответ: ' + JSON.stringify(response));
            }

            itemId = response.id;
            console.log('Создан новый элемент, ID =', itemId);
        }

        // Загрузка файла
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const endpoint = category === 'movie' 
                ? `/movies/${itemId}/upload`
                : `/books/${itemId}/upload`;

            console.log('Загрузка файла на:', endpoint);

            await uploadFile(endpoint, file, (p) => updateProgress(5 + p * 70 / 100));
        }

        // Загрузка миниатюры
        if (thumbnailInput.files.length > 0) {
            const file = thumbnailInput.files[0];
            const endpoint = category === 'movie'
                ? `/movies/${itemId}/upload_thumbnail`
                : `/books/${itemId}/upload_thumbnail`;

            await uploadFile(endpoint, file, (p) => updateProgress(75 + p * 25 / 100));
        }

        updateProgress(100);
        setTimeout(() => {
            loadItems();
            showViewMode();
            hideProgress();
            showLoading(false);
        }, 600);

    } catch (err) {
        console.error('Ошибка в handleSubmit:', err);
        showError(err.message || 'Не удалось сохранить элемент');
        hideLoading();
        hideProgress();
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
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch {
                    resolve({ success: true });
                }
            } else {
                let errorMsg = 'Ошибка загрузки файла';
                try {
                    const err = JSON.parse(xhr.responseText);
                    errorMsg = err.detail || err.message || errorMsg;
                } catch {}
                reject(new Error(errorMsg));
            }
        };

        xhr.onerror = () => reject(new Error('Сетевая ошибка при загрузке'));

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
    updateFileInfo();
    updateThumbnailInfo();

    if (currentCategory === 'movie' && item.thumbnail_path) {
        document.getElementById('thumbnail-info').textContent += ` (текущая: ${item.thumbnail_path.split('/').pop()})`;
    }
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

document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentCategory = btn.dataset.view;
    document.getElementById('category').value = currentCategory;
    loadItems();
    updateFormLabels();
  });
});
document.getElementById('show-add').addEventListener('click', showAddMode);
document.getElementById('show-view').addEventListener('click', showViewMode);
// Выпадающее меню
const menuToggle = document.getElementById('menu-toggle');
const dropdownMenu = document.getElementById('dropdown-menu');

if (menuToggle && dropdownMenu) {
  menuToggle.addEventListener('click', () => {
    menuToggle.classList.toggle('active');
    dropdownMenu.classList.toggle('active');
  });

  // Закрытие при клике вне меню
  document.addEventListener('click', (e) => {
    if (!menuToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
      menuToggle.classList.remove('active');
      dropdownMenu.classList.remove('active');
    }
  });
}

// Обработчики пунктов меню (замени старые show-movies/show-books)
document.querySelectorAll('.nav-item[data-category]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item[data-category]').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    currentCategory = item.dataset.category;
    document.getElementById('category').value = currentCategory;
    loadItems();
    updateFormLabels();

    // Закрываем меню на мобильных
    menuToggle?.classList.remove('active');
    dropdownMenu?.classList.remove('active');
  });
});