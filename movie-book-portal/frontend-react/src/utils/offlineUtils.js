// Offline Books Utility - IndexedDB wrapper for storing books offline
// This file provides functions for downloading, caching, and managing offline books

const DB_NAME = 'books-offline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'epub-files';
const MAX_BOOKS = 20; // Maximum number of cached books

/**
 * Open IndexedDB database
 */
async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'bookId' });
                store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
                store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
            }
        };
    });
}

/**
 * Download book EPUB file and cache it in IndexedDB
 */
export async function downloadBookForOffline(bookId, metadata) {
    try {
        console.log(`[Offline] Downloading book ${bookId} for offline use...`);

        // Download EPUB file
        const response = await fetch(`/api/books/${bookId}/download`);
        if (!response.ok) {
            throw new Error(`Failed to download book: ${response.status}`);
        }

        const bookData = await response.arrayBuffer();
        console.log(`[Offline] Downloaded ${bookData.byteLength} bytes`);

        // Open database
        const db = await openDB();

        // Check if we need to make room
        const count = await getBookCount();
        if (count >= MAX_BOOKS) {
            console.log(`[Offline] Cache full (${count}/${MAX_BOOKS}), removing oldest book`);
            await removeOldestBook();
        }

        // Save to IndexedDB
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        await store.put({
            bookId,
            bookData,
            metadata, // Book info (title, author, total_pages, etc.)
            lastAccessed: Date.now(),
            downloadedAt: Date.now(),
            size: bookData.byteLength
        });

        console.log(`[Offline] Book ${bookId} cached successfully`);
        return true;
    } catch (error) {
        console.error(`[Offline] Failed to download book ${bookId}:`, error);
        throw error;
    }
}

/**
 * Check if a book is already downloaded and cached
 */
export async function checkIfDownloaded(bookId) {
    try {
        const db = await openDB();
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const book = await store.get(bookId);
        return book !== undefined;
    } catch (error) {
        console.error(`[Offline] Error checking if book ${bookId} is downloaded:`, error);
        return false;
    }
}

/**
 * Get cached book data
 */
export async function getCachedBook(bookId) {
    try {
        const db = await openDB();
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const book = await store.get(bookId);

        if (book) {
            // Update last accessed time
            book.lastAccessed = Date.now();
            await store.put(book);
        }

        return book;
    } catch (error) {
        console.error(`[Offline] Error getting cached book ${bookId}:`, error);
        return null;
    }
}

/**
 * Remove a book from offline cache
 */
export async function removeBookFromCache(bookId) {
    try {
        const db = await openDB();
        const tx = db.transaction([STORE_NAME], 'readwrite');
        await tx.objectStore(STORE_NAME).delete(bookId);
        console.log(`[Offline] Removed book ${bookId} from cache`);
        return true;
    } catch (error) {
        console.error(`[Offline] Error removing book ${bookId}:`, error);
        return false;
    }
}

/**
 * Get list of all cached book IDs
 */
export async function getCachedBookIds() {
    try {
        const db = await openDB();
        const tx = db.transaction([STORE_NAME], 'readonly');
        const keys = await tx.objectStore(STORE_NAME).getAllKeys();
        return keys;
    } catch (error) {
        console.error('[Offline] Error getting cached book IDs:', error);
        return [];
    }
}

/**
 * Get total count of cached books
 */
async function getBookCount() {
    try {
        const db = await openDB();
        const tx = db.transaction([STORE_NAME], 'readonly');
        const count = await tx.objectStore(STORE_NAME).count();
        return count;
    } catch (error) {
        console.error('[Offline] Error getting book count:', error);
        return 0;
    }
}

/**
 * Remove oldest book from cache (LRU eviction)
 */
async function removeOldestBook() {
    try {
        const db = await openDB();
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('lastAccessed');

        // Get oldest book
        const cursor = await index.openCursor();
        if (cursor) {
            console.log(`[Offline] Removing oldest book: ${cursor.primaryKey}`);
            await store.delete(cursor.primaryKey);
        }
    } catch (error) {
        console.error('[Offline] Error removing oldest book:', error);
    }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
    try {
        const db = await openDB();
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const allBooks = await store.getAll();

        const totalSize = allBooks.reduce((sum, book) => sum + (book.size || 0), 0);
        const count = allBooks.length;

        return {
            count,
            totalSize,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            maxBooks: MAX_BOOKS,
            books: allBooks.map(b => ({
                id: b.bookId,
                title: b.metadata?.title || 'Unknown',
                size: b.size,
                downloadedAt: new Date(b.downloadedAt).toLocaleString()
            }))
        };
    } catch (error) {
        console.error('[Offline] Error getting cache stats:', error);
        return { count: 0, totalSize: 0, totalSizeMB: '0', maxBooks: MAX_BOOKS, books: [] };
    }
}

/**
 * Clear all cached books
 */
export async function clearAllCache() {
    try {
        const db = await openDB();
        const tx = db.transaction([STORE_NAME], 'readwrite');
        await tx.objectStore(STORE_NAME).clear();
        console.log('[Offline] All cached books cleared');
        return true;
    } catch (error) {
        console.error('[Offline] Error clearing cache:', error);
        return false;
    }
}
