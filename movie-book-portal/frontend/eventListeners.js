import { state, setCurrentCategory, setCurrentGenre } from './state.js';
import { updateGenreSelect, updateGenreSelectInForm } from './genreSelectors.js';
import { updateFormLabels } from './utils.js';
import { loadItems } from './itemDisplay.js';
import { showAddMode, showViewMode, handleSubmit } from './itemForm.js';
import { updateFileInfo, updateThumbnailInfo, updateEpisodesInfo } from './utils.js';

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

            // Обновляем состояние приложения
            setCurrentCategory(item.dataset.category);
            window.currentCategory = item.dataset.category; // для совместимости
            document.getElementById('category').value = item.dataset.category;
            setCurrentGenre('Все');
            window.currentGenre = 'Все'; // для совместимости
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
        setCurrentGenre(e.target.value);
        window.currentGenre = e.target.value; // для совместимости
        loadItems();
    });

    // Переключение вида (список / форма)
    document.getElementById('show-add').addEventListener('click', showAddMode);
    document.getElementById('show-view').addEventListener('click', showViewMode);

    // Форма
    document.getElementById('item-form').addEventListener('submit', handleSubmit);
    document.getElementById('category').addEventListener('change', () => {
        const newCategory = document.getElementById('category').value;
        setCurrentCategory(newCategory);
        window.currentCategory = newCategory; // для совместимости
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

// Делаем select более "дружелюбным" к touch
document.getElementById('genre-filter').addEventListener('touchend', function(e) {
    // даём браузеру шанс обработать выбор
    setTimeout(() => {
        this.focus();
        this.click();      // принудительно открываем список
    }, 50);
}, { passive: false });