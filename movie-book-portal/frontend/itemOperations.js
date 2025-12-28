import { state } from './state.js';
import { deleteMovie, deleteTvshow, deleteBook } from './api.js';
import { loadItems } from './itemDisplay.js';

export async function deleteItem(id) {
    if (!confirm('Удалить этот элемент навсегда?')) return;

    try {
        state.currentCategory === 'movie'
            ? await deleteMovie(id)
            : state.currentCategory === 'tvshow'
                ? await deleteTvshow(id)
                : await deleteBook(id);
        loadItems();
    } catch (err) {
        alert('Ошибка при удалении');
    }
}