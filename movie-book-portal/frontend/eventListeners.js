import { state, setCurrentCategory, setCurrentGenre } from './state.js';
import { updateGenreSelect, updateGenreSelectInForm } from './genreSelectors.js';
import { updateFormLabels } from './utils.js';
import { loadItems } from './itemDisplay.js';
import { showAddMode, showViewMode, handleSubmit } from './itemForm.js';
import { updateFileInfo, updateThumbnailInfo, updateEpisodesInfo } from './utils.js';

const initListeners = () => {
    // Ждем, пока состояние загрузится
    loadItems();
    updateGenreSelect();
    updateGenreSelectInForm();
    updateFormLabels();

    // Навигация по категориям
    document.querySelectorAll('.nav-item[data-category]').forEach(item => {
        item.addEventListener('click', () => {
            // Обработка навигации на страницу галереи
            if (item.dataset.category === 'photo') {
                // Устанавливаем категорию в фото перед переходом
                setCurrentCategory('photo');
                window.currentCategory = 'photo'; // для совместимости
                if (window.state) window.state.currentCategory = 'photo'; // обновляем в глобальном состоянии если существует
                setCurrentGenre('Все');
                window.currentGenre = 'Все'; // для совместимости
                if (window.state) window.state.currentGenre = 'Все'; // обновляем в глобальном состоянии если существует

                // Переход на страницу галереи
                window.location.href = '/gallery.html';
                return;
            }

            // Обработка навигации на другие категории
            // Если мы на странице галереи и переходим в другую категорию, перенаправляем на главную страницу
            const isGalleryPage = window.location.pathname.includes('gallery.html');
            if (isGalleryPage) {
                // Устанавливаем категорию перед переходом
                setCurrentCategory(item.dataset.category);
                window.currentCategory = item.dataset.category; // для совместимости
                if (window.state) window.state.currentCategory = item.dataset.category; // обновляем в глобальном состоянии если существует
                setCurrentGenre('Все');
                window.currentGenre = 'Все'; // для совместимости
                if (window.state) window.state.currentGenre = 'Все'; // обновляем в глобальном состоянии если существует

                // Переход на главную страницу с нужной категорией
                window.location.href = '/';
                return;
            }

            document.querySelectorAll('.nav-item[data-category]').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Обновляем состояние приложения
            setCurrentCategory(item.dataset.category);
            window.currentCategory = item.dataset.category; // для совместимости
            if (window.state) window.state.currentCategory = item.dataset.category; // обновляем также в глобальном состоянии если существует
            document.getElementById('category').value = item.dataset.category;
            setCurrentGenre('Все');
            window.currentGenre = 'Все'; // для совместимости
            if (window.state) window.state.currentGenre = 'Все'; // обновляем также в глобальном состоянии если существует
            updateGenreSelect();
            updateGenreSelectInForm();
            updateFormLabels();
            loadItems();

            // Закрываем мобильное меню
            document.getElementById('menu-toggle')?.classList.remove('active');
            document.getElementById('dropdown-menu')?.classList.remove('active');
        });
    });

    // Обработка навигации на страницу галереи - теперь обрабатывается в основном обработчике
    // навигации по категориям (строки 14-42), где добавлена специальная логика для 'photo' категории

    // Фильтр по жанру
    const genreFilter = document.getElementById('genre-filter');
    if (genreFilter) {
        genreFilter.addEventListener('change', (e) => {
            setCurrentGenre(e.target.value);
            window.currentGenre = e.target.value; // для совместимости
            if (window.state) window.state.currentGenre = e.target.value; // обновляем также в глобальном состоянии если существует
            loadItems();
        });
    }

    // Фильтр по категории на странице галереи
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            setCurrentGenre(e.target.value);
            window.currentGenre = e.target.value; // для совместимости
            if (window.state) window.state.currentGenre = e.target.value; // обновляем также в глобальном состоянии если существует
            loadItems();
        });
    }

    // Переключение вида (список / форма)
    const showAddBtn = document.getElementById('show-add');
    const showViewBtn = document.getElementById('show-view');
    if (showAddBtn) showAddBtn.addEventListener('click', showAddMode);
    if (showViewBtn) showViewBtn.addEventListener('click', showViewMode);

    // Форма
    const itemForm = document.getElementById('item-form') || document.getElementById('photo-form');
    const categorySelect = document.getElementById('category');
    if (itemForm) itemForm.addEventListener('submit', handleSubmit);
    if (categorySelect) categorySelect.addEventListener('change', () => {
        const newCategory = categorySelect.value;
        setCurrentCategory(newCategory);
        window.currentCategory = newCategory; // для совместимости
        if (window.state) window.state.currentCategory = newCategory; // обновляем также в глобальном состоянии если существует
        updateFormLabels();
        updateGenreSelectInForm();
    });

    // Проверяем, на какой странице мы находимся - на главной или на галерее
    const isGalleryPage = window.location.pathname.includes('gallery.html') || !!document.getElementById('photos-grid');

    // Для разных страниц используются разные элементы
    if (isGalleryPage) {
        // На странице галереи
        const photoInput = document.getElementById('photo');
        const thumbnailInput = document.getElementById('thumbnail');
        const episodesInput = document.getElementById('episodes'); // может не существовать на галерее
        const uploadArea = document.getElementById('upload-area'); // зона для drag-and-drop

        if (photoInput) photoInput.addEventListener('change', updateFileInfo);
        if (thumbnailInput) thumbnailInput.addEventListener('change', updateThumbnailInfo);
        if (episodesInput) episodesInput.addEventListener('change', updateEpisodesInfo);

        // Добавляем обработчики для зоны загрузки фото
        if (uploadArea && photoInput) {
            // Клик по зоне загрузки активирует скрытый input - ТЕПЕРЬ ТАКЖЕ ЧЕРЕЗ LABEL 'for' в HTML
            // Но мы оставляем JS как дополнительный слой (без повторных срабатываний)
            uploadArea.addEventListener('click', (e) => {
                // Если клик произошел не по самому input (который скрыт), а по label
                if (e.target !== photoInput) {
                    // Native label behavior will handle this, but for robustness:
                    // photoInput.click(); 
                    // Мы не вызываем click() вручную, так как label (for="photo") сделает это нативно.
                }
            });

            // Обработчики drag-and-drop событий
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '#4caf50';
                uploadArea.style.backgroundColor = '#2e2e2e';
            });

            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '#555';
                uploadArea.style.backgroundColor = 'transparent';
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '#555';
                uploadArea.style.backgroundColor = 'transparent';

                if (e.dataTransfer.files.length) {
                    // Создаем событие изменения для скрытого input
                    photoInput.files = e.dataTransfer.files;

                    // Создаем и dispatch custom event для обновления информации о файле
                    const event = new Event('change', { bubbles: true });
                    photoInput.dispatchEvent(event);
                }
            });
        }
    } else {
        // На главной странице
        const fileInput = document.getElementById('file');
        const photoInput = document.getElementById('photo'); // может не существовать на главной
        const thumbnailInput = document.getElementById('thumbnail');
        const episodesInput = document.getElementById('episodes');

        if (fileInput) fileInput.addEventListener('change', updateFileInfo);
        if (photoInput) photoInput.addEventListener('change', updateFileInfo);
        if (thumbnailInput) thumbnailInput.addEventListener('change', updateThumbnailInfo);
        if (episodesInput) episodesInput.addEventListener('change', updateEpisodesInfo);
    }

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

    // Делаем select более "дружелюбным" к touch
    const genreFilterTouch = document.getElementById('genre-filter');
    if (genreFilterTouch) {
        genreFilterTouch.addEventListener('touchend', function (e) {
            // даём браузеру шанс обработать выбор
            setTimeout(() => {
                this.focus();
                this.click();      // принудительно открываем список
            }, 50);
        }, { passive: false });
    }
};

// Запускаем инициализацию сразу или по DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initListeners);
} else {
    initListeners();
}