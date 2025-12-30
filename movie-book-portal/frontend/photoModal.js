// Функция для открытия модального окна просмотра фото
window.openPhotoModal = async function(photoSrc, photoTitle, photoId) {
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
                padding: 20px;
                display: none;
            ">
                <div class="photo-container" style="
                    width: 95vw;
                    max-width: 1200px;
                    max-height: 80vh;
                    position: relative;
                    margin-bottom: 10px;
                ">
                    <img id="modal-photo" src="" alt="Фото" style="
                        width: 100%;
                        height: 100%;
                        max-height: 80vh;
                        object-fit: contain;
                        border-radius: 8px;
                        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.9);
                    ">
                <div class="modal-controls" style="
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    z-index: 1001;
                ">
                    <button id="close-modal" class="modal-btn" title="Закрыть" style="
                        background-color: rgba(0, 0, 0, 0.6);
                        color: #fff;
                        border: none;
                        padding: 8px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 1rem;
                        transition: background-color 0.2s ease;
                        backdrop-filter: blur(5px);
                        width: 36px;
                        height: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                    ">×</button>
                    <button id="delete-photo-modal" class="modal-btn delete-btn-modal" title="Удалить" style="
                        background-color: rgba(204, 51, 0.7);
                        color: #fff;
                        border: none;
                        padding: 8px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 1rem;
                        transition: background-color 0.2s ease;
                        backdrop-filter: blur(5px);
                        width: 36px;
                        height: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                    ">🗑</button>
                </div>
                
                <!-- Кнопки для фильтров -->
                <div class="photo-filters" style="
                    position: absolute;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 10px;
                    z-index: 1001;
                    background-color: rgba(0, 0, 0, 0.6);
                    padding: 10px;
                    border-radius: 30px;
                    backdrop-filter: blur(5px);
                ">
                    <button id="filter-brightness" class="filter-btn" title="Яркость" style="
                        background-color: rgba(255, 255, 255, 0.5);
                        color: black;
                        border: none;
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 1rem;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
                    ">☀️</button>
                    <button id="filter-contrast" class="filter-btn" title="Контраст" style="
                        background-color: rgba(255, 255, 255, 0.5);
                        color: black;
                        border: none;
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 1rem;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 5px rgba(0, 0, 0.3);
                    ">◑</button>
                    <button id="filter-saturation" class="filter-btn" title="Насыщенность" style="
                        background-color: rgba(255, 255, 255, 0.5);
                        color: black;
                        border: none;
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 1rem;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 5px rgba(0, 0, 0.3);
                    ">🌈</button>
                    <button id="filter-bw" class="filter-btn" title="Черно-белый" style="
                        background-color: rgba(128, 128, 128, 0.7);
                        color: white;
                        border: none;
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 1rem;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 5px rgba(0, 0.3);
                    ">⚫</button>
                    <button id="filter-vintage" class="filter-btn" title="Винтаж" style="
                        background-color: rgba(160, 82, 45, 0.7);
                        color: white;
                        border: none;
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 1rem;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 5px rgba(0, 0.3);
                    ">❐</button>
                    <button id="filter-reset" class="filter-btn" title="Сбросить фильтр" style="
                        background-color: rgba(255, 255, 255, 0.5);
                        color: black;
                        border: none;
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 1rem;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 5px rgba(0, 0, 0.3);
                    ">↺</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('photo-modal');
    }
    
    const modalImg = document.getElementById('modal-photo');
    const closeModalBtn = document.getElementById('close-modal');
    const deleteBtn = document.getElementById('delete-photo-modal');
    
    // Элементы для фильтров
    const filterBrightnessBtn = document.getElementById('filter-brightness');
    const filterContrastBtn = document.getElementById('filter-contrast');
    const filterSaturationBtn = document.getElementById('filter-saturation');
    const filterBwBtn = document.getElementById('filter-bw');
    const filterVintageBtn = document.getElementById('filter-vintage');
    const filterResetBtn = document.getElementById('filter-reset');
    
    // Сохраняем оригинальный src изображения
    let originalSrc = modalImg.src;
    let currentFilter = 'none';
    
    // Функция для применения фильтра к изображению
    function applyFilter(filterType) {
        switch(filterType) {
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
        // Если есть примененный фильтр, сохраняем изображение с фильтром
        if (currentFilter !== 'none' && photoId) {
            try {
                // Используем HTML5 Canvas для применения фильтра и получения изображения
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Устанавливаем размеры canvas в соответствии с изображением
                canvas.width = modalImg.naturalWidth || modalImg.width;
                canvas.height = modalImg.naturalHeight || modalImg.height;
                
                // Применяем фильтр к изображению на canvas
                ctx.filter = modalImg.style.filter;
                ctx.drawImage(modalImg, 0, 0, canvas.width, canvas.height);
                
                // Получаем данные изображения с фильтром в формате blob
                canvas.toBlob(async (blob) => {
                    try {
                        // Создаем файл из blob
                        const file = new File([blob], `filtered_${photoId}.jpg`, { type: 'image/jpeg' });
                        
                        // Импортируем функцию обновления фото
                        const { uploadPhotoFile } = await import('./api.js');
                        
                        // Загружаем отфильтрованное изображение на сервер
                        await uploadPhotoFile(photoId, file);
                        
                        // Обновляем src изображения на оригинальный путь, чтобы избежать проблем с CORS
                        modalImg.src = originalSrc;
                        modalImg.style.filter = 'none';
                        currentFilter = 'none';
                        
                        // Обновляем миниатюру на странице, если она существует
                        updateThumbnail(photoId, modalImg.src);
                    } catch (error) {
                        console.error('Ошибка при сохранении отфильтрованного фото:', error);
                    }
                }, 'image/jpeg', 0.9);
            } catch (error) {
                console.error('Ошибка при обработке фильтра:', error);
            }
        }
        
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };
    
    // Удаляем предыдущие обработчики, чтобы избежать дублирования
    closeModalBtn.onclick = null;
    deleteBtn.onclick = null;
    
    closeModalBtn.onclick = closeHandler;
    
    // Закрытие по клику вне изображения
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeHandler();
        }
    };
    
    // Закрытие по клавише Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeHandler();
        }
    };
    
    // Удаляем предыдущий обработчик клавиатуры
    document.onkeydown = null;
    document.onkeydown = handleEscape;
    
    // Обработчик удаления фото
    
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
    
    // Показываем модальное окно
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

// Функция для обновления миниатюры на странице
async function updateThumbnail(photoId, newSrc) {
    // Обновляем изображение на странице галереи, если оно существует
    const galleryImages = document.querySelectorAll(`img[data-photo-id="${photoId}"], img[src*="${photoId}"], .photo-item img`);
    
    for (const img of galleryImages) {
        // Проверяем, является ли это изображение миниатюрой для того же фото
        if (img.src.includes(photoId.toString()) || img.dataset.photoId === photoId.toString()) {
            // Обновляем src изображения
            img.src = newSrc + '?t=' + new Date().getTime(); // Добавляем временный параметр для обхода кэширования
            break;
        }
    }
    
    // Также проверяем элементы с классом photo-item
    const photoItems = document.querySelectorAll(`.photo-item[data-id="${photoId}"]`);
    for (const item of photoItems) {
        const img = item.querySelector('img');
        if (img) {
            img.src = newSrc + '?t=' + new Date().getTime(); // Добавляем временный параметр для обхода кэширования
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