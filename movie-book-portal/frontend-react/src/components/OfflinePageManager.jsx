import { useState, useCallback } from 'react';
import { useManualCache } from '../hooks/useManualCache';
import {
    Home, Film, Tv, Image, Book, Music, MessageSquare, Sparkles,
    Download, RefreshCw, Trash2, CheckCircle2, Circle, AlertCircle,
    WifiOff, CloudDownload, Loader2
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

// Список основных страниц для оффлайн-кэширования
const PAGES = [
    { label: 'Главная',       path: '/',               icon: Home },
    { label: 'Фильмы',        path: '/movies',          icon: Film },
    { label: 'Сериалы',       path: '/tvshows',         icon: Tv },
    { label: 'Галерея',       path: '/gallery',         icon: Image },
    { label: 'Видеогалерея',  path: '/video-gallery',   icon: Film },
    { label: 'Книги',         path: '/books',           icon: Book },
    { label: 'Аудиокниги',    path: '/audiobooks',      icon: Music },
    { label: 'Чат',           path: '/chat',            icon: MessageSquare },
    { label: 'Предложка',     path: '/requests',        icon: Sparkles },
];

function formatDate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function OfflinePageManager() {
    const { isSupported, loading, error, meta, savePages, refreshPage, deletePage, clearAll, isPageCached } = useManualCache();
    const [progress, setProgress] = useState(null); // { done, total }
    const [refreshingUrl, setRefreshingUrl] = useState(null);
    const [deletingUrl, setDeletingUrl] = useState(null);
    const [showClearModal, setShowClearModal] = useState(false);

    const cachedCount = PAGES.filter(p => isPageCached(p.path)).length;

    const handleSaveAll = useCallback(async () => {
        const urls = PAGES.map(p => p.path);
        setProgress({ done: 0, total: urls.length });
        await savePages(urls, (done, total) => setProgress({ done, total }));
        setProgress(null);
    }, [savePages]);

    const handleRefresh = useCallback(async (path) => {
        setRefreshingUrl(path);
        await refreshPage(path);
        setRefreshingUrl(null);
    }, [refreshPage]);

    const handleDelete = useCallback(async (path) => {
        setDeletingUrl(path);
        await deletePage(path);
        setDeletingUrl(null);
    }, [deletePage]);

    if (!isSupported) {
        return (
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-3 text-gray-500">
                <WifiOff size={18} />
                <span className="text-sm">Cache API не поддерживается в этом браузере</span>
            </div>
        );
    }

    return (
        <>
            {showClearModal && (
                <ConfirmationModal
                    title="Удалить оффлайн-кэш?"
                    message="Все вручную сохранённые страницы будут удалены. Без интернета они перестанут работать."
                    onClose={() => setShowClearModal(false)}
                    onConfirm={async () => { await clearAll(); setShowClearModal(false); }}
                    confirmLabel="Удалить"
                    isDanger={true}
                />
            )}

            <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <WifiOff size={16} className="text-cyan-400" />
                        <span className="text-sm font-bold">Страницы оффлайн</span>
                        <span className="text-[11px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                            {cachedCount}/{PAGES.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {cachedCount > 0 && (
                            <button
                                onClick={() => setShowClearModal(true)}
                                disabled={loading}
                                title="Удалить весь кэш страниц"
                                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                        <button
                            onClick={handleSaveAll}
                            disabled={loading}
                            title="Сохранить / обновить все страницы"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-xs font-bold transition-all disabled:opacity-50"
                        >
                            {loading && progress ? (
                                <>
                                    <Loader2 size={13} className="animate-spin" />
                                    {progress.done}/{progress.total}
                                </>
                            ) : (
                                <>
                                    <CloudDownload size={13} />
                                    Сохранить всё
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 text-xs border-b border-white/10">
                        <AlertCircle size={14} />
                        {error}
                    </div>
                )}

                {/* Page list */}
                <div className="divide-y divide-white/5">
                    {PAGES.map(({ label, path, icon: Icon }) => {
                        const cached = isPageCached(path);
                        const savedAt = meta[path]?.savedAt;
                        const isRefreshing = refreshingUrl === path;
                        const isDeleting = deletingUrl === path;
                        const busy = isRefreshing || isDeleting;

                        return (
                            <div
                                key={path}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors"
                            >
                                {/* Status icon */}
                                <div className={`shrink-0 ${cached ? 'text-emerald-400' : 'text-gray-600'}`}>
                                    {cached
                                        ? <CheckCircle2 size={16} />
                                        : <Circle size={16} />
                                    }
                                </div>

                                {/* Page icon + label */}
                                <Icon size={15} className="shrink-0 text-gray-400" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium truncate">{label}</span>
                                    {savedAt && (
                                        <p className="text-[10px] text-gray-500 mt-0.5 leading-none">
                                            Сохранено: {formatDate(savedAt)}
                                        </p>
                                    )}
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1 shrink-0">
                                    {/* Refresh / Save button */}
                                    <button
                                        onClick={() => handleRefresh(path)}
                                        disabled={busy || loading}
                                        title={cached ? 'Обновить страницу из сети' : 'Сохранить страницу'}
                                        className={`p-1.5 rounded-lg transition-all disabled:opacity-40
                                            ${cached
                                                ? 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10'
                                                : 'text-cyan-400 hover:bg-cyan-500/10'
                                            }`}
                                    >
                                        {isRefreshing
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : cached
                                                ? <RefreshCw size={14} />
                                                : <Download size={14} />
                                        }
                                    </button>

                                    {/* Delete button — only if cached */}
                                    {cached && (
                                        <button
                                            onClick={() => handleDelete(path)}
                                            disabled={busy || loading}
                                            title="Удалить из кэша"
                                            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                                        >
                                            {isDeleting
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <Trash2 size={14} />
                                            }
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer hint */}
                <div className="px-4 py-2.5 border-t border-white/5">
                    <p className="text-[10px] text-gray-600 leading-snug">
                        Сохранённые страницы открываются без интернета. Кэш обновляется только вручную.
                    </p>
                </div>
            </div>
        </>
    );
}
