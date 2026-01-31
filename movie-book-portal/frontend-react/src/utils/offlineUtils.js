// This file provides functions for downloading, caching, and managing offline books
import { fetchBookPage, fetchProgress } from '../api';
import { saveBookPage, saveBookMetadata, clearAllData, saveLocalProgress } from './offlineStorage';

const DB_NAME = 'books-offline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'epub-files';
const MAX_BOOKS = 20; // Maximum number of cached books

/**
 * Helper to promisify IndexedDB requests
 */
function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

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
 * Also pre-fetches all pages and internal resources to "warm up" the Service Worker cache
 */
export async function downloadBookForOffline(bookId, metadata, onProgress) {
    try {
        console.log(`[Offline] Starting comprehensive download for book ${bookId}: ${metadata.title}...`);

        if (onProgress) onProgress({ status: 'metadata', progress: 5 });

        // Save metadata to BOTH stores to ensure Reader.jsx finds it
        await saveBookMetadata(metadata);
        console.log(`[Offline] Metadata synced to Reader storage for book ${bookId}`);

        // Fetch latest progress from server and save it locally
        try {
            const prog = await fetchProgress('book', bookId);
            if (prog && prog.progress_seconds > 0) {
                await saveLocalProgress(bookId, Math.floor(prog.progress_seconds), prog.scroll_ratio || 0);
                console.log(`[Offline] Pre-fetched server progress for book ${bookId}: page ${Math.floor(prog.progress_seconds)}`);
            }
        } catch (e) {
            console.warn('[Offline] Failed to pre-fetch progress for book', bookId, e);
        }

        // 1. Download EPUB file (Shell/Legacy support)
        const baseUrl = window.location.origin;
        const downloadUrl = `${baseUrl}/api/books/${bookId}/download?t=${Date.now()}`;

        const response = await fetch(downloadUrl, {
            method: 'GET',
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`Failed to download book: ${response.status} ${response.statusText}`);
        }

        const bookData = await response.arrayBuffer();

        // Open/Save to EPUB database
        const db = await openDB();
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        await requestToPromise(store.put({
            bookId,
            bookData,
            metadata,
            lastAccessed: Date.now(),
            downloadedAt: Date.now(),
            size: bookData.byteLength
        }));

        if (onProgress) onProgress({ status: 'epub', progress: 15 });

        // 2. Pre-fetch all pages and resources to warm up SW cache
        const totalPages = metadata.total_pages || metadata.totalPages || 0;
        console.log(`[Offline] Pre-fetching ${totalPages} pages...`);

        if (totalPages > 0) {
            // Fetch pages in chunks to avoid overwhelming the network
            const CHUNK_SIZE = 5;
            for (let i = 1; i <= totalPages; i += CHUNK_SIZE) {
                const chunkPromise = [];
                const end = Math.min(i + CHUNK_SIZE - 1, totalPages);

                for (let p = i; p <= end; p++) {
                    chunkPromise.push((async (pageNum) => {
                        try {
                            const pageData = await fetchBookPage(bookId, pageNum);

                            // Also save to offlineStorage for double redundancy
                            if (pageData && pageData.content) {
                                await saveBookPage(bookId, pageNum, pageData.content);

                                // Scan for internal resources (images) and fetch them to warm SW cache
                                // Pattern: /api/books/{id}/file_resource/{path}
                                const resourceRegex = /\/api\/books\/\d+\/file_resource\/[^"'> ]+/g;
                                const resources = pageData.content.match(resourceRegex) || [];

                                if (resources.length > 0) {
                                    // Fetch resources in background (don't block page loop too much)
                                    resources.forEach(resUrl => {
                                        fetch(resUrl).catch(e => console.warn(`Failed to pre-cache resource: ${resUrl}`, e));
                                    });
                                }
                            }
                        } catch (err) {
                            console.warn(`[Offline] Failed to pre-fetch page ${pageNum}:`, err);
                        }
                    })(p));
                }

                await Promise.all(chunkPromise);

                if (onProgress) {
                    const percent = 15 + Math.round((end / totalPages) * 85);
                    onProgress({
                        status: 'pages',
                        progress: percent,
                        current: end,
                        total: totalPages
                    });
                }
            }
        }

        console.log(`[Offline] Book ${bookId} fully cached with pages`);
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
        const book = await requestToPromise(store.get(bookId));
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
        const book = await requestToPromise(store.get(bookId));

        if (book) {
            // Update last accessed time
            book.lastAccessed = Date.now();
            await requestToPromise(store.put(book));
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
        await requestToPromise(tx.objectStore(STORE_NAME).delete(bookId));
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
        const keys = await requestToPromise(tx.objectStore(STORE_NAME).getAllKeys());
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
        const count = await requestToPromise(tx.objectStore(STORE_NAME).count());
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

        // Get oldest book using cursor
        return new Promise((resolve, reject) => {
            const request = index.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    console.log(`[Offline] Removing oldest book: ${cursor.primaryKey}`);
                    const deleteRequest = store.delete(cursor.primaryKey);
                    deleteRequest.onsuccess = () => resolve();
                    deleteRequest.onerror = () => reject(deleteRequest.error);
                } else {
                    resolve(); // No books to remove
                }
            };
            request.onerror = () => reject(request.error);
        });
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
        const allBooks = await requestToPromise(store.getAll());

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
        await requestToPromise(tx.objectStore(STORE_NAME).clear());
        console.log('[Offline] All cached books (EPUBs) cleared');
        return true;
    } catch (error) {
        console.error('[Offline] Error clearing cache:', error);
        return false;
    }
}

/**
 * Comprehensive reset of all offline data
 * Wipes both IndexedDB databases and all Service Worker caches
 */
export async function resetOfflineData() {
    try {
        console.log('[Offline] Starting comprehensive cache reset...');

        // 1. Clear IndexedDB 'xHomePortal' (reader pages/metadata)
        await clearAllData();

        // 2. Clear IndexedDB 'books-offline-cache' (EPUB files)
        await clearAllCache();

        // 3. Clear Service Worker Caches (Workbox rules)
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(name => {
                    console.log(`[Offline] Deleting cache: ${name}`);
                    return caches.delete(name);
                })
            );
        }

        console.log('[Offline] Comprehensive reset complete');
        return true;
    } catch (error) {
        console.error('[Offline] Failed during comprehensive reset:', error);
        return false;
    }
}
