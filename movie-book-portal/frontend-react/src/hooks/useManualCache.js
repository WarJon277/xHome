/**
 * useManualCache — хук для ручного управления оффлайн-кэшем страниц.
 *
 * Двухуровневая защита:
 *   1. Cache API (`manual-pages-v1`) — основное хранилище для SW/offline navigation
 *   2. AndroidApp native backup (SharedPreferences "OfflinePages") — резервный слой,
 *      никогда не очищается WebView. При старте автоматически восстанавливает Cache API
 *      если он был сброшен системой.
 *
 * Метаданные (даты сохранения) хранятся в localStorage.
 */

import { useState, useEffect, useCallback } from 'react';

const CACHE_NAME = 'manual-pages-v1';
const META_KEY = 'manualCacheMeta';

/** Загрузить метаданные из localStorage */
function loadMeta() {
    try {
        return JSON.parse(localStorage.getItem(META_KEY) || '{}');
    } catch {
        return {};
    }
}

/** Сохранить метаданные в localStorage */
function saveMeta(meta) {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
}

/** Проверить, работаем ли в Android WebView с нативным бэкапом */
function hasNativeBackup() {
    return typeof window.AndroidApp !== 'undefined' &&
        typeof window.AndroidApp.nativeSavePage === 'function';
}

/**
 * Сохранить HTML страницы в нативный бэкап (SharedPreferences).
 * Страница сначала загружается из кэша или с сети, после чего HTML сохраняется.
 */
async function saveToNative(path, response) {
    if (!hasNativeBackup()) return;
    try {
        // Клонируем чтобы не испортить оригинальный response
        const clone = response.clone();
        const html = await clone.text();
        if (html && html.length > 0) {
            window.AndroidApp.nativeSavePage(path, html);
        }
    } catch (e) {
        console.warn('[ManualCache] Failed to save to native backup:', e);
    }
}

/**
 * Восстановить страницу из нативного бэкапа в Cache API.
 * Возвращает true если восстановление прошло успешно.
 */
async function restoreFromNative(cache, path) {
    if (!hasNativeBackup()) return false;
    try {
        const html = window.AndroidApp.nativeGetPage(path);
        if (!html || html.length === 0) return false;

        const response = new Response(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'X-Restored-From': 'native-backup'
            }
        });
        await cache.put(path, response);
        console.log(`[ManualCache] Restored ${path} from native backup (${html.length} chars)`);
        return true;
    } catch (e) {
        console.warn(`[ManualCache] Failed to restore ${path} from native:`, e);
        return false;
    }
}

export function useManualCache() {
    const [meta, setMeta] = useState(loadMeta);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [restored, setRestored] = useState(false); // был ли уже запущен восстановление

    const isSupported = 'caches' in window;

    /**
     * При монтировании: проверить Cache API и восстановить из нативного бэкапа
     * если какие-то страницы исчезли (WebView сбросил кэш).
     */
    useEffect(() => {
        if (!isSupported || restored) return;
        setRestored(true);

        const currentMeta = loadMeta();
        const savedPaths = Object.keys(currentMeta);
        if (savedPaths.length === 0) return;

        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                let restoredCount = 0;

                for (const path of savedPaths) {
                    // Проверяем — есть ли страница в Cache API
                    const existing = await cache.match(path);
                    if (!existing) {
                        // Cache API пустой — пробуем восстановить из нативного бэкапа
                        const ok = await restoreFromNative(cache, path);
                        if (ok) restoredCount++;
                    }
                }

                if (restoredCount > 0) {
                    console.log(`[ManualCache] Auto-restored ${restoredCount} pages from native backup`);
                }
            } catch (e) {
                console.error('[ManualCache] Auto-restore error:', e);
            }
        })();
    }, [isSupported, restored]);

    /**
     * Сохранить (или обновить) список URL в кэше.
     * @param {string[]} urls
     * @param {function} onProgress — (completed, total) => void
     */
    const savePages = useCallback(async (urls, onProgress) => {
        if (!isSupported) return;
        setLoading(true);
        setError(null);
        let completed = 0;
        const newMeta = { ...loadMeta() };

        try {
            const cache = await caches.open(CACHE_NAME);
            for (const url of urls) {
                try {
                    const response = await fetch(url, { cache: 'no-store' });
                    if (response.ok || response.status === 0) {
                        // Сохраняем в Cache API (клон нужен, т.к. body читается один раз)
                        const cacheClone = response.clone();
                        await cache.put(url, cacheClone);

                        // Сохраняем HTML в нативный бэкап (второй клон)
                        await saveToNative(url, response);

                        newMeta[url] = { savedAt: new Date().toISOString() };
                    }
                } catch (e) {
                    console.warn(`[ManualCache] Failed to cache ${url}:`, e);
                }
                completed++;
                if (onProgress) onProgress(completed, urls.length);
            }
        } catch (e) {
            setError('Не удалось открыть кэш. Возможно, не хватает места на устройстве.');
            console.error('[ManualCache] savePages error:', e);
        } finally {
            saveMeta(newMeta);
            setMeta(newMeta);
            setLoading(false);
        }
    }, [isSupported]);

    /**
     * Принудительно обновить конкретную страницу из сети.
     * @param {string} url
     */
    const refreshPage = useCallback(async (url) => {
        if (!isSupported) return;
        setLoading(true);
        setError(null);
        try {
            const cache = await caches.open(CACHE_NAME);
            const response = await fetch(url, { cache: 'no-store' });
            if (response.ok || response.status === 0) {
                const cacheClone = response.clone();
                await cache.put(url, cacheClone);

                // Обновляем нативный бэкап
                await saveToNative(url, response);

                const newMeta = { ...loadMeta(), [url]: { savedAt: new Date().toISOString() } };
                saveMeta(newMeta);
                setMeta(newMeta);
            }
        } catch (e) {
            setError('Не удалось обновить страницу. Проверьте интернет-соединение.');
            console.error('[ManualCache] refreshPage error:', e);
        } finally {
            setLoading(false);
        }
    }, [isSupported]);

    /**
     * Удалить одну страницу из кэша (и из нативного бэкапа).
     * @param {string} url
     */
    const deletePage = useCallback(async (url) => {
        if (!isSupported) return;
        try {
            const cache = await caches.open(CACHE_NAME);
            await cache.delete(url);

            // Удаляем из нативного бэкапа
            if (hasNativeBackup()) {
                window.AndroidApp.nativeDeletePage(url);
            }

            const newMeta = { ...loadMeta() };
            delete newMeta[url];
            saveMeta(newMeta);
            setMeta(newMeta);
        } catch (e) {
            console.error('[ManualCache] deletePage error:', e);
        }
    }, [isSupported]);

    /**
     * Полностью удалить весь ручной кэш (и нативный бэкап).
     */
    const clearAll = useCallback(async () => {
        if (!isSupported) return;
        try {
            await caches.delete(CACHE_NAME);

            // Очищаем нативный бэкап
            if (hasNativeBackup()) {
                window.AndroidApp.nativeClearPages();
            }

            saveMeta({});
            setMeta({});
        } catch (e) {
            console.error('[ManualCache] clearAll error:', e);
        }
    }, [isSupported]);

    /**
     * Проверить, кэширована ли страница (по метаданным в localStorage).
     */
    const isPageCached = useCallback((url) => {
        return !!meta[url];
    }, [meta]);

    return {
        isSupported,
        loading,
        error,
        meta,
        savePages,
        refreshPage,
        deletePage,
        clearAll,
        isPageCached,
    };
}
