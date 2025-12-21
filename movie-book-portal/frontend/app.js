let currentCategory = 'movie';
let editingItem = null;

document.addEventListener('DOMContentLoaded', () => {
    loadItems();
    document.getElementById('show-movies').addEventListener('click', () => {
        currentCategory = 'movie';
        loadItems();
    });
    document.getElementById('show-books').addEventListener('click', () => {
        currentCategory = 'book';
        loadItems();
    });
    document.getElementById('search').addEventListener('input', handleSearch);
    document.getElementById('item-form').addEventListener('submit', handleSubmit);
    document.getElementById('category').addEventListener('change', toggleFileInput);
    document.getElementById('show-view').addEventListener('click', () => {
        document.getElementById('add-form').style.display = 'none';
        document.getElementById('items-grid').style.display = 'grid';
        // Reset form state
        document.getElementById('item-form').reset();
        document.querySelector('#item-form button[type="submit"]').textContent = 'Добавить';
        editingItem = null;
        toggleFileInput();
    });
    document.getElementById('show-add').addEventListener('click', () => {
        document.getElementById('add-form').style.display = 'block';
        document.getElementById('items-grid').style.display = 'none';
        toggleFileInput();
    });
    toggleFileInput(); // initial check
});

async function loadItems() {
    const items = currentCategory === 'movie' ? await fetchMovies() : await fetchBooks();
    displayItems(items);
}

async function handleSearch() {
    const query = document.getElementById('search').value;
    if (query) {
        const items = currentCategory === 'movie' ? await searchMovies(query) : await searchBooks(query);
        displayItems(items);
    } else {
        loadItems();
    }
}

function toggleFileInput() {
    const category = document.getElementById('category').value;
    const fileUploadContainer = document.getElementById('file-upload-container');
    fileUploadContainer.style.display = category === 'movie' ? 'block' : 'none';
    
    // Сбросить информацию о файле при переключении категории
    if (category !== 'movie') {
        document.getElementById('file-info').textContent = '';
        document.getElementById('thumbnail-info').textContent = '';
        document.getElementById('file').value = '';
        document.getElementById('thumbnail').value = '';
    }
    
    // Показываем контейнер миниатюры только для фильмов
    document.getElementById('thumbnail-upload-container').style.display = category === 'movie' ? 'block' : 'none';
}

// Добавляем обработчик события для отслеживания выбора файла
document.getElementById('file').addEventListener('change', function(e) {
    const fileInfo = document.getElementById('file-info');
    if (this.files.length > 0) {
        const file = this.files[0];
        const fileSize = (file.size / (1024 * 1024)).toFixed(2); // размер в МБ
        fileInfo.textContent = `Выбран файл: ${file.name} (${fileSize} МБ)`;
    } else {
        fileInfo.textContent = '';
    }
});

// Добавляем обработчик события для отслеживания выбора миниатюры
document.getElementById('thumbnail').addEventListener('change', function(e) {
    const thumbnailInfo = document.getElementById('thumbnail-info');
    if (this.files.length > 0) {
        const file = this.files[0];
        const fileSize = (file.size / (1024 * 1024)).toFixed(2); // размер в МБ
        thumbnailInfo.textContent = `Выбрана миниатюра: ${file.name} (${fileSize} МБ)`;
    } else {
        thumbnailInfo.textContent = '';
    }
});

async function handleSubmit(e) {
    e.preventDefault();
    
    // Показываем сообщение о загрузке
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    loadingMessage.style.display = 'block';
    errorMessage.style.display = 'none';
    
    try {
        const category = document.getElementById('category').value;
        const title = document.getElementById('title').value;
        const year = parseInt(document.getElementById('year').value);
        const directorAuthor = document.getElementById('director-author').value;
        const genre = document.getElementById('genre').value;
        const rating = parseFloat(document.getElementById('rating').value);
        const description = document.getElementById('description').value;
        const file = document.getElementById('file').files[0];

        const data = category === 'movie' ? { title, year, director: directorAuthor, genre, rating, description } : { title, year, author: directorAuthor, genre, rating, description };

        let item;
        if (editingItem) {
            // Update existing item
            if (category === 'movie') {
                item = await updateMovie(editingItem.id, data);
                if (file) {
                    // Показываем контейнер прогресса
                    document.getElementById('progress-container').style.display = 'block';
                    await uploadMovieFile(item.id, file, (progress) => {
                        // Обновляем прогресс-бар
                        document.getElementById('progress').style.width = progress + '%';
                        document.getElementById('progress-text').textContent = progress + '%';
                    });
                    // Скрываем контейнер прогресса после завершения
                    document.getElementById('progress-container').style.display = 'none';
                }
                
                // Загружаем миниатюру, если она выбрана
                const thumbnail = document.getElementById('thumbnail').files[0];
                if (thumbnail) {
                    await uploadMovieThumbnail(item.id, thumbnail);
                }
            } else {
                item = await updateBook(editingItem.id, data);
            }
        } else {
            // Create new item
            if (category === 'movie') {
                item = await createMovie(data);
                if (file) {
                    // Показываем контейнер прогресса
                    document.getElementById('progress-container').style.display = 'block';
                    await uploadMovieFile(item.id, file, (progress) => {
                        // Обновляем прогресс-бар
                        document.getElementById('progress').style.width = progress + '%';
                        document.getElementById('progress-text').textContent = progress + '%';
                    });
                    // Скрываем контейнер прогресса после завершения
                    document.getElementById('progress-container').style.display = 'none';
                }
                
                // Загружаем миниатюру, если она выбрана
                const thumbnail = document.getElementById('thumbnail').files[0];
                if (thumbnail) {
                    await uploadMovieThumbnail(item.id, thumbnail);
                }
            } else {
                item = await createBook(data);
            }
        }

        // Reset form and state
        document.getElementById('item-form').reset();
        document.querySelector('#item-form button[type="submit"]').textContent = 'Добавить';
        editingItem = null;
        toggleFileInput();
        // Очищаем информацию о файле
        document.getElementById('file-info').textContent = '';
        
        // Загружаем элементы только после завершения всех операций
        await loadItems();
    } catch (error) {
        console.error('Error submitting form:', error);
        errorMessage.textContent = `Ошибка: ${error.message || 'Произошла ошибка при сохранении'}`;
        errorMessage.style.display = 'block';
    } finally {
        // Скрываем сообщение о загрузке
        loadingMessage.style.display = 'none';
    }
}

function displayItems(items) {
    const grid = document.getElementById('items-grid');
    grid.innerHTML = '';
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        let mediaElement = '';
        if (currentCategory === 'movie') {
            if (item.thumbnail_path) {
                // Показываем миниатюру с возможностью открыть плеер при клике
                mediaElement = `<img src="/${item.thumbnail_path}" alt="${item.title}" class="thumbnail" onclick="openVideoPlayer('${item.file_path}', '${item.title}')">`;
            } else if (item.file_path) {
                // Если миниатюры нет, но есть видео - показываем плеер
                const videoType = getVideoType(item.file_path);
                mediaElement = `<video controls onclick="openVideoPlayer('${item.file_path}', '${item.title}')"><source src="/${item.file_path}" type="${videoType}"></video>`;
            }
        }
        card.innerHTML = `
            <h3>${item.title}</h3>
            ${mediaElement}
            <p>Год: ${item.year}</p>
            <p>${currentCategory === 'movie' ? 'Режиссёр' : 'Автор'}: ${currentCategory === 'movie' ? item.director : item.author}</p>
            <p>Жанр: ${item.genre}</p>
            <p>Рейтинг: ${item.rating}/10</p>
            ${item.description ? `<p>Описание: ${item.description}</p>` : ''}
            <button class="edit-btn" onclick="editItem(${item.id})">Редактировать</button>
            <button class="delete-btn" onclick="deleteItem(${item.id})">Удалить</button>
        `;
        grid.appendChild(card);
    });
}

async function deleteItem(id) {
    if (currentCategory === 'movie') {
        await deleteMovie(id);
    } else {
        await deleteBook(id);
    }
    loadItems();
}

async function editItem(id) {
    const item = currentCategory === 'movie' ? await fetchMovie(id) : await fetchBook(id);
    editingItem = item;

    // Switch to add form
    document.getElementById('show-add').click();

    // Populate form
    document.getElementById('category').value = currentCategory === 'movie' ? 'movie' : 'book';
    document.getElementById('title').value = item.title;
    document.getElementById('year').value = item.year;
    document.getElementById('director-author').value = currentCategory === 'movie' ? item.director : item.author;
    document.getElementById('genre').value = item.genre;
    document.getElementById('rating').value = item.rating;
    document.getElementById('description').value = item.description || '';

    // Change submit button text
    document.querySelector('#item-form button[type="submit"]').textContent = 'Обновить';

    toggleFileInput();
    
    // Если это фильм, показываем текущую миниатюру
    if (currentCategory === 'movie' && item.thumbnail_path) {
        document.getElementById('thumbnail-info').textContent = `Текущая миниатюра: ${item.thumbnail_path.split('/').pop()}`;
    }
}

// Добавляем вспомогательную функцию для определения типа видео
function getVideoType(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    const typeMap = {
        'mp4': 'video/mp4',
        'mp4v': 'video/mp4',
        'webm': 'video/webm',
        'ogg': 'video/ogg',
        'ogv': 'video/ogg',
        'mov': 'video/quicktime',
        'qt': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'wmv': 'video/x-ms-wmv',
        'flv': 'video/x-flv',
        'mkv': 'video/x-matroska',
        'm4v': 'video/mp4',
        '3gp': 'video/3gpp',
        '3g2': 'video/3gpp2'
    };
    return typeMap[extension] || 'video/mp4';
}

// Функция для открытия видео-плеера
function openVideoPlayer(filePath, title) {
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.id = 'video-modal';

    // Контейнер для плеера
    const videoContainer = document.createElement('div');
    videoContainer.className = 'plyr-container';

    // Элемент video
    const videoElement = document.createElement('video');
    videoElement.className = 'plyr';
    videoElement.controls = true;
    videoElement.preload = 'metadata'; // Лучше чем auto — экономит трафик
    videoElement.playsInline = true;

    const source = document.createElement('source');
    source.src = '/' + filePath;
    source.type = getVideoType(filePath);
    videoElement.appendChild(source);

    videoContainer.appendChild(videoElement);

    // Название фильма
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;

    // Собираем модальное окно
    modal.appendChild(videoContainer);
    modal.appendChild(titleElement);
    document.body.appendChild(modal);

    // Инициализируем Plyr
    const player = new Plyr(videoElement, {
        controls: [
            'play-large',
            'play',
            'progress',
            'current-time',
            'duration',
            'mute',
            'volume',
            'captions',
            'settings',
            'pip',
            'airplay',
            'fullscreen'
        ],
        volume: 0.5,
        clickToPlay: true,
        keyboard: { focused: true, global: true },
        fullscreen: { enabled: true, fallback: true, iosNative: true },
        hideControls: true,         // Авто-скрытие controls при бездействии
        controlsTimeout: 3000       // Скрывать через 3 секунды
    });

    // Добавляем кнопку "Закрыть" в панель управления после готовности плеера
    player.on('ready', () => {
        const closeControl = document.createElement('button');
        closeControl.type = 'button';
        closeControl.className = 'plyr__control plyr__control--close';
        closeControl.setAttribute('aria-label', 'Закрыть');
        closeControl.innerHTML = `
            <svg role="presentation" focusable="false" viewBox="0 0 24 24" width="18" height="18">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
            </svg>
            <span class="plyr__tooltip">Закрыть</span>
        `;

        closeControl.onclick = () => {
            player.destroy();
            document.body.removeChild(modal);
            document.removeEventListener('keydown', handleEscape);
        };

        // Добавляем в конец панели управления (справа)
        player.elements.controls.appendChild(closeControl);
    });

    // Обработка ошибок воспроизведения
    player.on('error', () => {
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; text-align: center; padding: 20px; z-index: 1000;">
                <h3>Ошибка воспроизведения</h3>
                <p style="max-width: 800px; margin: 20px 0; font-size: 1.1em;">
                    Не удалось воспроизвести видео. Возможно, формат или кодек не поддерживается браузером.
                </p>
                <a href="/${filePath}" download="${title}" style="background:#4caf50; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; font-size:1.1em;">
                    Скачать видео
                </a>
                <p style="margin-top: 20px; color: #aaa; font-size: 0.9em;">
                    Рекомендуем VLC, MPC-HC или PotPlayer<br>
                    Для лучшей совместимости: MP4 + H.264
                </p>
                <button onclick="this.closest('#video-modal').remove()" style="margin-top: 20px; background:#dc3545; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer;">
                    Закрыть
                </button>
            </div>
        `;
    });

    // Закрытие по Esc
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            player.destroy();
            document.body.removeChild(modal);
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Закрытие по клику вне плеера
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            player.destroy();
            document.body.removeChild(modal);
            document.removeEventListener('keydown', handleEscape);
        }
    });
}