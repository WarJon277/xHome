import { searchMovies, searchTvshows, searchBooks } from './api.js';
import { displayItems } from './itemDisplay.js';

let searchTimeout;

export function initSearch() {
    const searchInput = document.getElementById('global-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length === 0) {
            // Restore default view
            import('./itemDisplay.js').then(module => module.loadItems());
            return;
        }

        searchTimeout = setTimeout(() => {
            performGlobalSearch(query);
        }, 500);
    });
}

async function performGlobalSearch(query) {
    try {
        const [movies, tvshows, books] = await Promise.all([
            searchMovies(query),
            searchTvshows(query),
            searchBooks(query)
        ]);

        const mixedItems = [
            ...movies.map(i => ({ ...i, type: 'movie' })),
            ...tvshows.map(i => ({ ...i, type: 'tvshow' })),
            ...books.map(i => ({ ...i, type: 'book' }))
        ];

        displayItems(mixedItems);

    } catch (e) {
        console.error("Search failed", e);
    }
}
