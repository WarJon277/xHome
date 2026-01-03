// Функция для открытия модального окна просмотра фото
window.openPhotoModal = async function (photoSrc, photoTitle, photoId) {
    // Проверяем, существует ли модальное окно, если нет - создаем его
    let modal = document.getElementById('photo-modal');

    if (!modal) {
        // Создаем HTML модального окна динамически
        const modalHTML = `
            <div id="photo-modal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.9);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 1000;
                padding: 0;
                display: none;
            ">
                <div class="photo-container" style="
                    width: 100%;
                    height: 100%;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <img id="modal-photo" src="" alt="Фото" style="
                        max-width: 100%;
                        max-height: calc(100vh - 120px);
                        object-fit: contain;
                        border-radius: 0;
                        box-shadow: none;
                    ">
                
                <!-- Стрелки навигации -->
                <button id="prev-photo" class="nav-arrow" title="Предыдущее фото" style="
                    position: absolute;
                    left: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    background-color: rgba(0, 0, 0, 0.3);
                    color: white;
                    border: none;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 2rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.2s;
                    z-index: 1001;
                    backdrop-filter: blur(5px);
                ">‹</button>
                <button id="next-photo" class="nav-arrow" title="Следующее фото" style="
                    position: absolute;
                    right: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    background-color: rgba(0, 0, 0, 0.3);
                    color: white;
                    border: none;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 2rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.2s;
                    z-index: 1001;
                    backdrop-filter: blur(5px);
                ">›</button>
                </div>
                
                <!-- Панель управления внизу -->
                <div class="modal-bottom-panel" style="
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.7));
                    backdrop-filter: blur(10px);
                    padding: 15px;
                    z-index: 1002;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                ">
                    <!-- Кнопки управления -->
                    <div class="modal-controls" style="
                        display: flex;
                        justify-content: center;
                        gap: 12px;
                        flex-wrap: wrap;
                    ">
                        <button id="close-modal" class="modal-btn" title="Закрыть" style="
                            background-color: rgba(100, 100, 100, 0.8);
                            color: #fff;
                            border: none;
                            padding: 10px 16px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 0.95rem;
                            transition: all 0.2s ease;
                            backdrop-filter: blur(5px);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 6px;
                            font-weight: 500;
                            min-width: 80px;
                        ">× Закрыть</button>
                        <button id="download-photo-modal" class="modal-btn" title="Скачать" style="
                            background-color: rgba(0, 100, 200, 0.8);
                            color: #fff;
                            border: none;
                            padding: 10px 16px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 0.95rem;
                            transition: all 0.2s ease;
                            backdrop-filter: blur(5px);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 6px;
                            font-weight: 500;
                            min-width: 80px;
                        ">📥</button>
                        <button id="share-photo-modal" class="modal-btn" title="Поделиться" style="
                            background-color: rgba(0, 150, 0, 0.8);
                            color: #fff;
                            border: none;
                            padding: 10px 16px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 0.95rem;
                            transition: all 0.2s ease;
                            backdrop-filter: blur(5px);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 6px;
                            font-weight: 500;
                            min-width: 80px;
                        ">🔗</button>
                        <button id="delete-photo-modal" class="modal-btn delete-btn-modal" title="Удалить" style="
                            background-color: rgba(204, 51, 0, 0.8);
                            color: #fff;
                            border: none;
                            padding: 10px 16px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 0.95rem;
                            transition: all 0.2s ease;
                            backdrop-filter: blur(5px);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 6px;
                            font-weight: 500;
                            min-width: 80px;
                        ">🗑</button>
                    </div>
                    
                    <!-- Кнопки для фильтров -->
                    <div class="photo-filters" style="
                        display: flex;
                        gap: 8px;
                        justify-content: center;
                        flex-wrap: wrap;
                    ">
                        <button id="filter-brightness" class="filter-btn" title="Яркость" style="
                            background-color: rgba(255, 255, 255, 0.5);
                            color: black;
                            border: none;
                            width: 40px;
                            height: 40px;
                            border-radius: 50%;
                            cursor: pointer;
                            font-size: 1.1rem;
                            transition: all 0.2s ease;
                            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
                        ">☀️</button>
                        <button id="filter-contrast" class="filter-btn" title="Контраст" style="
                            background-color: rgba(255, 255, 255, 0.5);
                            color: black;
                            border: none;
                            width: 40px;
                            height: 40px;
                            border-radius: 50%;
                            cursor: pointer;
                            font-size: 1.1rem;
                            transition: all 0.2s ease;
                            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
                        ">◑</button>
                        <button id="filter-saturation" class="filter-btn" title="Насыщенность" style="
                            background-color: rgba(255, 255, 255, 0.5);
                            color: black;
                            border: none;
                            width: 40px;
                            height: 40px;
                            border-radius: 50%;
                            cursor: pointer;
                            font-size: 1.1rem;
                            transition: all 0.2s ease;
                            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
                        ">🌈</button>
                        <button id="filter-bw" class="filter-btn" title="Черно-белый" style="
                            background-color: rgba(128, 128, 128, 0.7);
                            color: white;
                            border: none;
                            width: 40px;
                            height: 40px;
                            border-radius: 50%;
                            cursor: pointer;
                            font-size: 1.1rem;
                            transition: all 0.2s ease;
                            box-shadow: 0 2px 5px rgba(0, 0.3);
                        ">⚫</button>
                        <button id="filter-vintage" class="filter-btn" title="Винтаж" style="
                            background-color: rgba(160, 82, 45, 0.7);
                            color: white;
                            border: none;
                            width: 40px;
                            height: 40px;
                            border-radius: 50%;
                            cursor: pointer;
                            font-size: 1.1rem;
                            transition: all 0.2s ease;
                            box-shadow: 0 2px 5px rgba(0, 0.3);
                        ">❐</button>
                        <button id="filter-reset" class="filter-btn" title="Сбросить фильтр" style="
                            background-color: rgba(255, 255, 255, 0.5);
                            color: black;
                            border: none;
                            width: 40px;
                            height: 40px;
                            border-radius: 50%;
                            cursor: pointer;
                            font-size: 1.1rem;
                            transition: all 0.2s ease;
                            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
                        ">↺</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('photo-modal');
    }

    const modalImg = document.getElementById('modal-photo');
    const closeModalBtn = document.getElementById('close-modal');
    const deleteBtn = document.getElementById('delete-photo-modal');
    const downloadBtn = document.getElementById('download-photo-modal');
    const shareBtn = document.getElementById('share-photo-modal');

    // Элементы для фильтров
    const filterBrightnessBtn = document.getElementById('filter-brightness');
    const filterContrastBtn = document.getElementById('filter-contrast');
    const filterSaturationBtn = document.getElementById('filter-saturation');
    const filterBwBtn = document.getElementById('filter-bw');
    const filterVintageBtn = document.getElementById('filter-vintage');
    const filterResetBtn = document.getElementById('filter-reset');
    const prevBtn = document.getElementById('prev-photo');
    const nextBtn = document.getElementById('next-photo');

    // Функция для переключения на другое фото
    const navigateToPhoto = (direction) => {
        const photoItems = Array.from(document.querySelectorAll('.photo-item'));
        if (photoItems.length <= 1) return;

        const currentIndex = photoItems.findIndex(item => item.getAttribute('data-id') === photoId.toString());
        if (currentIndex === -1) return;

        let nextIndex;
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % photoItems.length;
        } else {
            nextIndex = (currentIndex - 1 + photoItems.length) % photoItems.length;
        }

        const nextItem = photoItems[nextIndex];
        const nextId = nextItem.getAttribute('data-id');
        const nextImg = nextItem.querySelector('img');
        const nextSrc = nextImg.getAttribute('data-path') || nextImg.src;
        const nextTitle = nextImg.alt;

        // Вместо открытия нового модального окна, обновляем текущее
        // Но для простоты реализации и сохранения всех обработчиков,
        // мы можем просто вызвать openPhotoModal снова
        window.openPhotoModal(nextSrc, nextTitle, nextId);
    };

    // Функция для скачивания
    const handleDownload = async () => {
        // Сначала пробуем через Android Interface
        if (window.AndroidApp && typeof window.AndroidApp.downloadFile === 'function') {
            const currentSrc = modalImg.getAttribute('src');
            const fullUrl = window.location.origin + (currentSrc.startsWith('/') ? currentSrc : '/' + currentSrc);
            window.AndroidApp.downloadFile(fullUrl, photoTitle.includes('.') ? photoTitle : `${photoTitle}.jpg`);
            return;
        }

        try {
            const response = await fetch(modalImg.src);
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = photoTitle.includes('.') ? photoTitle : `${photoTitle}.jpg`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Ошибка при скачивании:', error);
            if (window.showAlert) window.showAlert('Ошибка', 'Не удалось начать скачивание. Попробуйте использовать официальное приложение.');
        }
    };

    // Функция для "поделиться"
    const handleShare = async () => {
        // Сначала пробуем через Android Interface (если приложение открыто в WebView)
        if (window.AndroidApp && typeof window.AndroidApp.shareFile === 'function') {
            const fullUrl = window.location.origin + modalImg.getAttribute('src');
            window.AndroidApp.shareFile(fullUrl, photoTitle);
            return;
        }

        if (navigator.share) {
            try {
                // Получаем файл
                const response = await fetch(modalImg.src);
                if (!response.ok) throw new Error('Failed to fetch file');

                const blob = await response.blob();

                // Определяем правильное расширение и MIME тип
                let fileName = photoTitle;
                let mimeType = blob.type || 'image/jpeg';

                // Если в названии нет расширения, добавляем его
                if (!fileName.includes('.')) {
                    const extension = mimeType.split('/')[1] || 'jpg';
                    fileName = `${fileName}.${extension}`;
                }

                const file = new File([blob], fileName, { type: mimeType });

                // Проверяем, поддерживает ли браузер шаринг файлов
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: photoTitle,
                        files: [file]
                    });
                } else {
                    // Если шаринг файлов не поддерживается, показываем сообщение
                    if (window.showAlert) window.showAlert('Инфо', 'Ваш браузер не поддерживает отправку файлов. Попробуйте скачать файл и отправить его вручную.');
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Ошибка при шаринге:', error);
                    if (window.showAlert) window.showAlert('Ошибка', 'Не удалось поделиться файлом. Попробуйте скачать файл и отправить его вручную.');
                }
            }
        } else {
            if (window.showAlert) window.showAlert('Инфо', 'Ваш браузер не поддерживает функцию "Поделиться". Попробуйте использовать HTTPS или официальное приложение.');
        }
    };

    // Сохраняем оригинальный src изображения
    let originalSrc = modalImg.src;
    let currentFilter = 'none';

    // Функция для применения фильтра к изображению
    function applyFilter(filterType) {
        switch (filterType) {
            case 'brightness':
                modalImg.style.filter = 'brightness(1.3)';
                break;
            case 'contrast':
                modalImg.style.filter = 'contrast(1.3)';
                break;
            case 'saturation':
                modalImg.style.filter = 'saturate(1.5)';
                break;
            case 'bw':
                modalImg.style.filter = 'grayscale(1)';
                break;
            case 'vintage':
                modalImg.style.filter = 'sepia(0.5) contrast(1.2) saturate(1.8) hue-rotate(-30deg)';
                break;
            case 'none':
                modalImg.style.filter = 'none';
                break;
            default:
                modalImg.style.filter = 'none';
        }
        currentFilter = filterType;

        // Обновляем миниатюру на странице с тем же фильтром
        if (photoId) {
            updateThumbnailFilter(photoId, modalImg.style.filter);

            // Сохраняем фильтр в localStorage для сохранения между сессиями
            localStorage.setItem(`photo_filter_${photoId}`, modalImg.style.filter);
        }
    }

    // Загружаем сохраненный фильтр при открытии модального окна, если он существует
    const savedFilter = localStorage.getItem(`photo_filter_${photoId}`);
    if (savedFilter) {
        modalImg.style.filter = savedFilter;
        // Обновляем интерфейс для соответствия сохраненного фильтра
        if (savedFilter === 'brightness(1.3)') {
            currentFilter = 'brightness';
        } else if (savedFilter === 'contrast(1.3)') {
            currentFilter = 'contrast';
        } else if (savedFilter === 'saturate(1.5)') {
            currentFilter = 'saturation';
        } else if (savedFilter === 'grayscale(1)') {
            currentFilter = 'bw';
        } else if (savedFilter.includes('sepia')) {
            currentFilter = 'vintage';
        } else if (savedFilter === 'none') {
            currentFilter = 'none';
        }
    }

    // Назначаем обработчики для кнопок фильтров
    if (filterBrightnessBtn) filterBrightnessBtn.onclick = () => applyFilter('brightness');
    if (filterContrastBtn) filterContrastBtn.onclick = () => applyFilter('contrast');
    if (filterSaturationBtn) filterSaturationBtn.onclick = () => applyFilter('saturation');
    if (filterBwBtn) filterBwBtn.onclick = () => applyFilter('bw');
    if (filterVintageBtn) filterVintageBtn.onclick = () => applyFilter('vintage');
    if (filterResetBtn) filterResetBtn.onclick = () => applyFilter('none');

    // Загружаем полноразмерное фото, если оно доступно, иначе используем миниатюру
    if (photoId && window.currentCategory === 'photo') {
        // Пытаемся получить полный путь к фото из API
        try {
            const { fetchPhoto } = await import('./api.js');
            const photoData = await fetchPhoto(photoId);
            if (photoData && photoData.file_path) {
                // Используем полный путь к фото, если он доступен
                modalImg.src = photoData.file_path;
            } else {
                // Если полный путь не доступен, используем переданный путь (который может быть миниатюрой)
                modalImg.src = photoSrc;
            }
        } catch (error) {
            // В случае ошибки используем переданный путь
            modalImg.src = photoSrc;
            console.error('Ошибка при получении данных фото:', error);
        }
    } else {
        // Для других случаев используем переданный путь
        modalImg.src = photoSrc;
    }
    // Обработчик закрытия модального окна
    const closeHandler = async () => {
        // Если есть примененный фильтр, применяем его к изображению на сервере
        if (currentFilter !== 'none' && photoId) {
            try {
                // Импортируем функцию применения фильтра
                const { applyPhotoFilter } = await import('./api.js');

                // Применяем фильтр на сервере
                await applyPhotoFilter(photoId, currentFilter);

                // Получаем обновленные данные фото с сервера
                const { fetchPhoto } = await import('./api.js');
                const updatedPhoto = await fetchPhoto(photoId);

                // Обновляем src изображения на обновленный путь
                modalImg.src = updatedPhoto.file_path || originalSrc;
                modalImg.style.filter = 'none';
                currentFilter = 'none';

                // Обновляем миниатюру на странице, если она существует
                // Используем обновленный путь к миниатюре с временным параметром для обновления кэша
                if (updatedPhoto.thumbnail_path) {
                    updateThumbnail(photoId, updatedPhoto.thumbnail_path + '?t=' + new Date().getTime());
                } else if (updatedPhoto.file_path) {
                    updateThumbnail(photoId, updatedPhoto.file_path + '?t=' + new Date().getTime());
                } else {
                    updateThumbnail(photoId, originalSrc + '?t=' + new Date().getTime());
                }

                // Обновляем галерею на главной странице и на странице галереи
                try {
                    // Пробуем вызвать глобальную функцию loadItems
                    if (window.loadItems) {
                        await window.loadItems();
                    } else {
                        // Если глобальная функция недоступна, импортируем и вызываем напрямую
                        const { loadItems } = await import('./itemDisplay.js');
                        await loadItems();
                    }
                } catch (loadError) {
                    console.error('Ошибка при обновлении галереи:', loadError);
                    // В крайнем случае обновляем страницу, если мы на странице галереи
                    if (window.location.pathname.includes('gallery.html')) {
                        window.location.reload();
                    }
                }
            } catch (error) {
                console.error('Ошибка при применении фильтра к фото:', error);
            }
        } else {
            // Если фильтр не применялся, просто обновляем миниатюру, чтобы сбросить возможный фильтр
            if (photoId) {
                updateThumbnail(photoId, photoSrc);
            }
        }


        modal.style.display = 'none';
        document.body.style.overflow = 'auto';

        // Восстанавливаем FAB кнопки при закрытии модального окна
        const fabContainer = document.querySelector('.fab-container');
        if (fabContainer) {
            fabContainer.style.visibility = 'visible';
            fabContainer.style.opacity = '1';
            fabContainer.style.pointerEvents = 'auto';
        }
        
    };

    // Удаляем предыдущие обработчики, чтобы избежать дублирования
    closeModalBtn.onclick = null;
    deleteBtn.onclick = null;
    if (downloadBtn) downloadBtn.onclick = null;
    if (shareBtn) shareBtn.onclick = null;
    if (prevBtn) prevBtn.onclick = null;
    if (nextBtn) nextBtn.onclick = null;

    closeModalBtn.onclick = closeHandler;
    if (downloadBtn) downloadBtn.onclick = handleDownload;
    if (shareBtn) shareBtn.onclick = handleShare;
    if (prevBtn) prevBtn.onclick = () => navigateToPhoto('prev');
    if (nextBtn) nextBtn.onclick = () => navigateToPhoto('next');

    // Скрываем стрелки, если фото всего одно
    const totalPhotos = document.querySelectorAll('.photo-item').length;
    if (totalPhotos <= 1) {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    } else {
        if (prevBtn) prevBtn.style.display = 'flex';
        if (nextBtn) nextBtn.style.display = 'flex';
    }

    // Закрытие по клику вне изображения
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeHandler();
        }
    };

    // Закрытие по клавише Escape и навигация стрелками
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeHandler();
        } else if (e.key === 'ArrowRight') {
            navigateToPhoto('next');
        } else if (e.key === 'ArrowLeft') {
            navigateToPhoto('prev');
        }
    };

    // Удаляем предыдущий обработчик клавиатуры
    document.onkeydown = null;
    document.onkeydown = handleKeyDown;

    // Обработчик удаления фото
    deleteBtn.onclick = async () => {
        if (confirm('Вы уверены, что хотите удалить это фото?')) {
            try {
                // Импортируем функцию удаления фото
                const { deletePhoto } = await import('./api.js');
                await deletePhoto(photoId);
                closeHandler();

                // Обновляем галерею на главной странице и на странице галереи
                try {
                    // Пробуем вызвать глобальную функцию loadItems
                    if (window.loadItems) {
                        await window.loadItems();
                    } else {
                        // Если глобальная функция недоступна, импортируем и вызываем напрямую
                        const { loadItems } = await import('./itemDisplay.js');
                        await loadItems();
                    }
                } catch (loadError) {
                    console.error('Ошибка при обновлении галереи:', loadError);
                    // В крайнем случае обновляем страницу, если мы на странице галереи
                    if (window.location.pathname.includes('gallery.html')) {
                        window.location.reload();
                    }
                }
            } catch (error) {
                console.error('Ошибка при удалении фото:', error);
                alert('Ошибка при удалении фото');
            }
        }
    };

    // Скрываем FAB кнопки при открытии модального окна
    const fabContainer = document.querySelector('.fab-container');
    if (fabContainer) {
        fabContainer.style.visibility = 'hidden';
        fabContainer.style.opacity = '0';
        fabContainer.style.pointerEvents = 'none';
    }

    // Показываем модальное окно
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
};

// Функция для обновления миниатюры на странице
async function updateThumbnail(photoId, newSrc) {
    // Обновляем изображение на странице галереи, если оно существует
    const galleryImages = document.querySelectorAll(`img[data-photo-id="${photoId}"], img[src*="${photoId}"], .photo-item img, img.thumbnail`);

    for (const img of galleryImages) {
        // Проверяем, является ли это изображение миниатюрой для того же фото
        if (img.src.includes(photoId.toString()) ||
            img.dataset.photoId === photoId.toString() ||
            img.alt.includes(photoId.toString())) {
            // Обновляем src изображения
            img.src = newSrc; // Используем новый путь с фильтрами
            // Не сбрасываем фильтр при обновлении src, а применяем сохраненный фильтр
            const savedFilter = localStorage.getItem(`photo_filter_${photoId}`);
            if (savedFilter) {
                img.style.filter = savedFilter;
                img.style.webkitFilter = savedFilter;
            } else {
                img.style.filter = 'none';
                img.style.webkitFilter = 'none';
            }
            break;
        }
    }

    // Также проверяем элементы с классом photo-item
    const photoItems = document.querySelectorAll(`.photo-item[data-id="${photoId}"]`);
    for (const item of photoItems) {
        const img = item.querySelector('img');
        if (img) {
            img.src = newSrc; // Используем новый путь с фильтрами
            // Не сбрасываем фильтр при обновлении src, а применяем сохраненный фильтр
            const savedFilter = localStorage.getItem(`photo_filter_${photoId}`);
            if (savedFilter) {
                img.style.filter = savedFilter;
                img.style.webkitFilter = savedFilter;
            } else {
                img.style.filter = 'none';
                img.style.webkitFilter = 'none';
            }
            break;
        }
    }
}

// Функция для обновления фильтра у миниатюры на странице
function updateThumbnailFilter(photoId, filterValue) {
    // Находим изображение миниатюры на странице по photoId
    const galleryImages = document.querySelectorAll(`img[data-photo-id="${photoId}"], .photo-item img, img.thumbnail`);

    for (const img of galleryImages) {
        // Проверяем, является ли это изображение миниатюрой для того же фото
        // Проверяем по data-photo-id, по вхождению photoId в src, или по alt атрибуту
        if (img.dataset.photoId === photoId.toString() ||
            img.src.includes(photoId.toString()) ||
            img.alt.includes(photoId.toString())) {
            // Применяем фильтр к изображению
            img.style.filter = filterValue;
            img.style.webkitFilter = filterValue; // Для совместимости с некоторыми браузерами

            // Сохраняем фильтр в localStorage для сохранения между сессиями
            if (photoId) {
                localStorage.setItem(`photo_filter_${photoId}`, filterValue);
            }
            break;
        }
    }

    // Также проверяем элементы с классом photo-item
    const photoItems = document.querySelectorAll(`.photo-item[data-id="${photoId}"]`);
    for (const item of photoItems) {
        const img = item.querySelector('img');
        if (img) {
            img.style.filter = filterValue;
            img.style.webkitFilter = filterValue; // Для совместимости с некоторыми браузерами
            break;
        }
    }
}

// Функция для применения сохраненного фильтра к миниатюре при загрузке страницы
function applySavedFilterToThumbnail(photoId) {
    const savedFilter = localStorage.getItem(`photo_filter_${photoId}`);
    if (savedFilter) {
        updateThumbnailFilter(photoId, savedFilter);
    }
}

// Функция для применения всех сохраненных фильтров при загрузке страницы
function applyAllSavedFilters() {
    // Находим все фото-элементы на странице и применяем к ним сохраненные фильтры
    const photoItems = document.querySelectorAll('.photo-item');
    photoItems.forEach(item => {
        const photoId = item.dataset.id;
        if (photoId) {
            applySavedFilterToThumbnail(photoId);
        }
    });
}

// Автоматически применяем сохраненные фильтры при загрузке документа
document.addEventListener('DOMContentLoaded', applyAllSavedFilters);

// Также применяем при полной загрузке страницы
window.addEventListener('load', applyAllSavedFilters);