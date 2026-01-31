// Offline Storage using IndexedDB for Books
// Stores book metadata and page content for offline reading

const DB_NAME = 'xHomePortal';
const DB_VERSION = 1;
const BOOKS_STORE = 'books';
const PAGES_STORE = 'pages';
const PROGRESS_STORE = 'progress';

// Helper to promisify IndexedDB requests
const requestToPromise = (request) => {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// Initialize IndexedDB
const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Books store: metadata
            if (!db.objectStoreNames.contains(BOOKS_STORE)) {
                const booksStore = db.createObjectStore(BOOKS_STORE, { keyPath: 'id' });
                booksStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
            }

            // Pages store: content
            if (!db.objectStoreNames.contains(PAGES_STORE)) {
                const pagesStore = db.createObjectStore(PAGES_STORE, { keyPath: ['bookId', 'pageNumber'] });
                pagesStore.createIndex('bookId', 'bookId', { unique: false });
                pagesStore.createIndex('cachedAt', 'cachedAt', { unique: false });
            }

            // Progress store: local progress backup
            if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
                db.createObjectStore(PROGRESS_STORE, { keyPath: 'id' });
            }
        };
    });
};

// Save book metadata
export const saveBookMetadata = async (book) => {
    try {
        const db = await initDB();
        const tx = db.transaction(BOOKS_STORE, 'readwrite');
        const store = tx.objectStore(BOOKS_STORE);

        const bookData = {
            id: parseInt(book.id),
            title: book.title,
            author: book.author,
            thumbnail_path: book.thumbnail_path,
            totalPages: book.total_pages || book.totalPages,
            genre: book.genre,
            year: book.year,
            description: book.description,
            lastAccessed: Date.now()
        };

        await requestToPromise(store.put(bookData));
        console.log('[OfflineStorage] Saved book metadata:', book.id);
        return true;
    } catch (error) {
        console.error('[OfflineStorage] Failed to save book metadata:', error);
        return false;
    }
};

// Save book page content
export const saveBookPage = async (bookId, pageNumber, content) => {
    try {
        const db = await initDB();
        const tx = db.transaction(PAGES_STORE, 'readwrite');
        const store = tx.objectStore(PAGES_STORE);

        const pageData = {
            bookId: parseInt(bookId),
            pageNumber: parseInt(pageNumber),
            content: content,
            cachedAt: Date.now()
        };

        await requestToPromise(store.put(pageData));
        console.log(`[OfflineStorage] Saved page ${pageNumber} for book ${bookId}`);
        return true;
    } catch (error) {
        console.error('[OfflineStorage] Failed to save page:', error);
        return false;
    }
};

// Get all cached books
export const getCachedBooks = async () => {
    try {
        const db = await initDB();
        const tx = db.transaction(BOOKS_STORE, 'readonly');
        const store = tx.objectStore(BOOKS_STORE);

        const result = await requestToPromise(store.getAll());
        const books = result.map(book => ({
            ...book,
            total_pages: book.totalPages,
            isCached: true
        }));
        console.log('[OfflineStorage] Retrieved cached books:', books.length);
        return books;
    } catch (error) {
        console.error('[OfflineStorage] Failed to get cached books:', error);
        return [];
    }
};

// Get book metadata
export const getBookMetadata = async (bookId) => {
    try {
        const db = await initDB();
        const tx = db.transaction(BOOKS_STORE, 'readonly');
        const store = tx.objectStore(BOOKS_STORE);

        const book = await requestToPromise(store.get(parseInt(bookId)));
        if (book) {
            console.log('[OfflineStorage] Retrieved book metadata:', bookId);
            return {
                ...book,
                total_pages: book.totalPages
            };
        }
        return null;
    } catch (error) {
        console.error('[OfflineStorage] Failed to get book metadata:', error);
        return null;
    }
};

// Get book page content
export const getBookPage = async (bookId, pageNumber) => {
    try {
        const db = await initDB();
        const tx = db.transaction(PAGES_STORE, 'readonly');
        const store = tx.objectStore(PAGES_STORE);

        const page = await requestToPromise(store.get([parseInt(bookId), parseInt(pageNumber)]));
        if (page) {
            console.log(`[OfflineStorage] Retrieved page ${pageNumber} for book ${bookId}`);
            return page.content;
        }
        return null;
    } catch (error) {
        console.error('[OfflineStorage] Failed to get page:', error);
        return null;
    }
};

// Check if book is cached
export const isBookCached = async (bookId) => {
    try {
        const metadata = await getBookMetadata(parseInt(bookId));
        return metadata !== null;
    } catch (error) {
        console.error('[OfflineStorage] Failed to check if book is cached:', error);
        return false;
    }
};

// Get cached pages for a book
export const getCachedPagesForBook = async (bookId) => {
    try {
        const db = await initDB();
        const tx = db.transaction(PAGES_STORE, 'readonly');
        const store = tx.objectStore(PAGES_STORE);
        const index = store.index('bookId');

        const result = await requestToPromise(index.getAll(parseInt(bookId)));
        const pages = result.map(p => p.pageNumber);
        console.log(`[OfflineStorage] Book ${bookId} has ${pages.length} cached pages`);
        return pages;
    } catch (error) {
        console.error('[OfflineStorage] Failed to get cached pages:', error);
        return [];
    }
};

// Clear old cache (keep last 30 days)
export const clearOldCache = async (daysToKeep = 30) => {
    try {
        const db = await initDB();
        const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

        // Clear old pages
        const pagesTx = db.transaction(PAGES_STORE, 'readwrite');
        const pagesStore = pagesTx.objectStore(PAGES_STORE);
        const pagesIndex = pagesStore.index('cachedAt');

        const pagesCursorRequest = pagesIndex.openCursor(IDBKeyRange.upperBound(cutoffTime));
        pagesCursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };

        // Clear old books
        const booksTx = db.transaction(BOOKS_STORE, 'readwrite');
        const booksStore = booksTx.objectStore(BOOKS_STORE);
        const booksIndex = booksStore.index('lastAccessed');

        const booksCursorRequest = booksIndex.openCursor(IDBKeyRange.upperBound(cutoffTime));
        booksCursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };

        console.log('[OfflineStorage] Cleared cache older than', daysToKeep, 'days');
        return true;
    } catch (error) {
        console.error('[OfflineStorage] Failed to clear old cache:', error);
        return false;
    }
};

// Save progress locally
export const saveLocalProgress = async (id, page, scrollRatio, updatedAt = null) => {
    try {
        const db = await initDB();
        const tx = db.transaction(PROGRESS_STORE, 'readwrite');
        const store = tx.objectStore(PROGRESS_STORE);

        await requestToPromise(store.put({
            id: parseInt(id),
            page: parseInt(page),
            scrollRatio: scrollRatio,
            updatedAt: updatedAt || Date.now()
        }));
        return true;
    } catch (error) {
        console.error('[OfflineStorage] Failed to save local progress:', error);
        return false;
    }
};

// Get progress locally
export const getLocalProgress = async (id) => {
    try {
        const db = await initDB();
        const tx = db.transaction(PROGRESS_STORE, 'readonly');
        const store = tx.objectStore(PROGRESS_STORE);

        const result = await requestToPromise(store.get(parseInt(id)));
        return result || null;
    } catch (error) {
        console.error('[OfflineStorage] Failed to get local progress:', error);
        return null;
    }
};


// Delete specific book and its pages
export const deleteBookCache = async (bookId) => {
    try {
        const db = await initDB();

        // Delete book metadata
        const booksTx = db.transaction(BOOKS_STORE, 'readwrite');
        await requestToPromise(booksTx.objectStore(BOOKS_STORE).delete(parseInt(bookId)));

        // Delete all pages for this book
        const pagesTx = db.transaction(PAGES_STORE, 'readwrite');
        const pagesStore = pagesTx.objectStore(PAGES_STORE);
        const index = pagesStore.index('bookId');

        const cursorRequest = index.openCursor(parseInt(bookId));
        cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };

        // Also delete progress for this book
        const progressTx = db.transaction(PROGRESS_STORE, 'readwrite');
        await requestToPromise(progressTx.objectStore(PROGRESS_STORE).delete(parseInt(bookId)));

        console.log('[OfflineStorage] Deleted cache and progress for book:', bookId);
        return true;
    } catch (error) {
        console.error('[OfflineStorage] Failed to delete book cache:', error);
        return false;
    }
};

// Clear all data from this store
export const clearAllData = async () => {
    try {
        const db = await initDB();
        const tx = db.transaction([BOOKS_STORE, PAGES_STORE, PROGRESS_STORE], 'readwrite');
        await Promise.all([
            requestToPromise(tx.objectStore(BOOKS_STORE).clear()),
            requestToPromise(tx.objectStore(PAGES_STORE).clear()),
            requestToPromise(tx.objectStore(PROGRESS_STORE).clear())
        ]);
        console.log('[OfflineStorage] All book data and progress cleared');
        return true;
    } catch (error) {
        console.error('[OfflineStorage] Failed to clear all data:', error);
        return false;
    }
};


// Get storage usage estimate
export const getStorageEstimate = async () => {
    if (navigator.storage && navigator.storage.estimate) {
        try {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
            };
        } catch (error) {
            console.error('[OfflineStorage] Failed to get storage estimate:', error);
            return null;
        }
    }
    return null;
};
