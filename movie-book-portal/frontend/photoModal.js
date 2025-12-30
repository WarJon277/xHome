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
                </div>
                <h3 id="modal-photo-title" class="photo-info" style="
                    margin: 10px 0;
                    font-size: 1.3rem;
                    color: #fff;
                    text-align: center;
                    text-shadow: 0 1px 3px rgba(0,0,0.8);
                    max-width: 95vw;
                    word-wrap: break-word;
                ">Заголовок фото</h3>
                <div class="modal-controls" style="
                    display: flex;
                    gap: 10px;
                    margin-top: 10px;
                ">
                    <button id="close-modal" class="modal-btn" style="
                        background-color: #444;
                        color: #fff;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 1rem;
                        transition: background-color 0.2s ease;
                    ">Закрыть</button>
                    <button id="delete-photo-modal" class="modal-btn delete-btn-modal" style="
                        background-color: #c33;
                        color: #fff;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 1rem;
                        transition: background-color 0.2s ease;
                    ">Удалить</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('photo-modal');
    }
    
    const modalImg = document.getElementById('modal-photo');
    const modalTitle = document.getElementById('modal-photo-title');
    const closeModalBtn = document.getElementById('close-modal');
    const deleteBtn = document.getElementById('delete-photo-modal');
    
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
    modalTitle.textContent = photoTitle || 'Без названия';
    
    // Обработчик закрытия модального окна
    const closeHandler = () => {
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