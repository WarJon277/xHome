import { state } from './state.js';
import { deleteMovie, deleteTvshow, deleteBook, deletePhoto } from './api.js';
import { loadItems } from './itemDisplay.js';

export async function deleteItem(id) {
    if (!confirm('Удалить этот элемент навсегда?')) return;

    try {
        if (state.currentCategory === 'movie') {
            await deleteMovie(id);
        } else if (state.currentCategory === 'tvshow') {
            await deleteTvshow(id);
        } else if (state.currentCategory === 'photo') {
            await deletePhoto(id);
        } else {
            await deleteBook(id);
        }
        // Wait a moment for the deletion to complete before reloading
        setTimeout(() => {
            loadItems();
        }, 100);
    } catch (err) {
        alert('Ошибка при удалении');
    }
}