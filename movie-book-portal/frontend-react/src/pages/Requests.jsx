import { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, BookOpen, Film, Headphones, Download, Loader2, AlertCircle, CheckCircle, X, Info, ChevronDown } from 'lucide-react';
import { searchRequests, fetchRequestDetails, downloadRequest, fetchDownloadStatus } from '../api';

const TABS = [
    { id: 'all', label: 'Все', icon: Sparkles },
    { id: 'books', label: 'Книги', icon: BookOpen },
    { id: 'movies', label: 'Фильмы', icon: Film },
    { id: 'audiobooks', label: 'Аудиокниги', icon: Headphones },
];

const STATUS_LABELS = {
    starting: 'Запуск...',
    checking: 'Проверка...',
    fetching_details: 'Получение данных...',
    downloading: 'Скачивание...',
    downloading_torrent: 'Скачивание торрента...',
    converting: 'Конвертация видео...',
    completed: 'Готово!',
    error: 'Ошибка',
};

export default function RequestsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [downloads, setDownloads] = useState([]);
    const [downloadingIds, setDownloadingIds] = useState(new Set());
    const [expandedId, setExpandedId] = useState(null);
    const [detailsCache, setDetailsCache] = useState({});
    const [loadingDetails, setLoadingDetails] = useState(new Set());
    const searchAbort = useRef(null);
    const statusIntervalRef = useRef(null);

    // Debounced search
    useEffect(() => {
        const q = searchQuery.trim();
        if (!q || q.length < 2) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        const timer = setTimeout(async () => {
            if (searchAbort.current) searchAbort.current.abort();
            searchAbort.current = new AbortController();

            try {
                const data = await searchRequests(q, activeTab, { signal: searchAbort.current.signal });
                setResults(Array.isArray(data) ? data : []);
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.error('Search failed:', e);
                    setResults([]);
                }
            } finally {
                setIsSearching(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery, activeTab]);

    // Poll download status
    useEffect(() => {
        const poll = async () => {
            try {
                const data = await fetchDownloadStatus();
                setDownloads(Array.isArray(data) ? data : []);
            } catch (e) {
                // Silently ignore status poll errors
            }
        };

        poll();
        statusIntervalRef.current = setInterval(poll, 3000);
        return () => clearInterval(statusIntervalRef.current);
    }, []);

    // Load details on expand
    const toggleExpand = async (item) => {
        const key = `${item.type}:${item.id}`;
        if (expandedId === key) {
            setExpandedId(null);
            return;
        }
        setExpandedId(key);

        if (!detailsCache[key]) {
            setLoadingDetails(prev => new Set([...prev, key]));
            try {
                const details = await fetchRequestDetails(item.id, item.type);
                if (details) {
                    setDetailsCache(prev => ({ ...prev, [key]: details }));
                }
            } catch (e) {
                console.error('Details fetch failed:', e);
            } finally {
                setLoadingDetails(prev => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                });
            }
        }
    };

    const handleDownload = async (item) => {
        const key = `${item.type}:${item.id}`;
        if (downloadingIds.has(key)) return;

        setDownloadingIds(prev => new Set([...prev, key]));

        try {
            // Use cached details if available
            const details = detailsCache[key];

            const payload = {
                type: item.type,
                id: item.id,
                title: item.title,
                author: item.author || details?.author,
                year: item.year || details?.year,
                genre: details?.genre,
                rating: item.rating || details?.rating,
                description: item.description || details?.description,
                image_url: item.image || details?.image,
                download_url: item.download_url || details?.download_url,
                source_url: item.source_url || details?.source_url,
                director: details?.director,
                narrator: details?.narrator,
            };

            // For movies with multiple torrents, use the first one
            if (item.type === 'movie' && details?.torrents?.length) {
                payload.torrent_url = details.torrents[0].download_url;
            }

            await downloadRequest(payload);
        } catch (e) {
            console.error('Download failed:', e);
            alert(`Ошибка: ${e.message}`);
        } finally {
            // Keep in downloading state — status poll will track
            setTimeout(() => {
                setDownloadingIds(prev => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                });
            }, 2000);
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'book': return <BookOpen size={16} />;
            case 'movie': return <Film size={16} />;
            case 'audiobook': return <Headphones size={16} />;
            default: return <Sparkles size={16} />;
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'book': return '#4ade80';
            case 'movie': return '#f97316';
            case 'audiobook': return '#a78bfa';
            default: return '#60a5fa';
        }
    };

    const getTypeLabel = (type) => {
        switch (type) {
            case 'book': return 'Книга';
            case 'movie': return 'Фильм';
            case 'audiobook': return 'Аудиокнига';
            default: return type;
        }
    };

    const activeDownloads = downloads.filter(d => !['completed', 'error'].includes(d.status));
    const recentDownloads = downloads.filter(d => ['completed', 'error'].includes(d.status)).slice(0, 5);

    return (
        <div className="p-4 sm:p-6 pb-24" style={{ minHeight: '100vh' }}>
            {/* Header */}
            <header className="mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
                    <Sparkles className="text-yellow-400" /> Предложка
                </h1>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                    Найдите книгу, фильм или аудиокнигу — и добавьте в библиотеку одним нажатием
                </p>

                {/* Search Input */}
                <div className="relative max-w-2xl">
                    <input
                        type="text"
                        placeholder="Введите название..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        className="w-full pl-12 pr-10 py-3.5 rounded-2xl text-base transition-all duration-200"
                        style={{
                            backgroundColor: 'var(--card-bg)',
                            color: 'var(--text-primary)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            outline: 'none',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2" size={20}
                        style={{ color: 'var(--text-secondary)' }} />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X size={18} style={{ color: 'var(--text-secondary)' }} />
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mt-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200"
                                style={{
                                    backgroundColor: isActive ? 'var(--accent-color)' : 'var(--card-bg)',
                                    color: isActive ? '#fff' : 'var(--text-secondary)',
                                    border: isActive ? 'none' : '1px solid rgba(255,255,255,0.06)',
                                    transform: isActive ? 'scale(1.02)' : 'scale(1)',
                                }}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* Active Downloads */}
            {(activeDownloads.length > 0 || recentDownloads.length > 0) && (
                <div className="mb-6 rounded-2xl p-4" style={{
                    backgroundColor: 'var(--card-bg)',
                    border: '1px solid rgba(255,255,255,0.06)'
                }}>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Download size={16} /> Загрузки
                    </h3>
                    <div className="space-y-2">
                        {activeDownloads.map(dl => (
                            <div key={dl.id} className="flex items-center gap-3 p-2 rounded-xl"
                                style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                                <div className="flex-shrink-0">
                                    <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                        {dl.title}
                                    </div>
                                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        {STATUS_LABELS[dl.status] || dl.status}
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                    {/* Progress bar */}
                                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                                        <div className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${dl.progress || 0}%`, backgroundColor: 'var(--accent-color)' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {recentDownloads.map(dl => (
                            <div key={dl.id} className="flex items-center gap-3 p-2 rounded-xl opacity-70"
                                style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                <div className="flex-shrink-0">
                                    {dl.status === 'completed' ? (
                                        <CheckCircle size={18} style={{ color: '#4ade80' }} />
                                    ) : (
                                        <AlertCircle size={18} style={{ color: '#ef4444' }} />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                        {dl.title}
                                    </div>
                                    {dl.error && (
                                        <div className="text-xs text-red-400 truncate">{dl.error}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Search Results */}
            {isSearching && (
                <div className="flex items-center justify-center gap-3 py-12">
                    <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Поиск...</span>
                </div>
            )}

            {!isSearching && searchQuery.trim().length >= 2 && results.length === 0 && (
                <div className="text-center py-12">
                    <Search size={48} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-secondary)' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>Ничего не найдено</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                        Попробуйте другой запрос или выберите другую категорию
                    </p>
                </div>
            )}

            {!isSearching && !searchQuery.trim() && (
                <div className="text-center py-16">
                    <Sparkles size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--text-secondary)' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Введите название для поиска
                    </p>
                </div>
            )}

            {!isSearching && results.length > 0 && (
                <div className="space-y-3 max-w-2xl">
                    <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                        Найдено: {results.length}
                    </div>
                    {results.map((item, idx) => {
                        const key = `${item.type}:${item.id}`;
                        const isExpanded = expandedId === key;
                        const details = detailsCache[key];
                        const isLoadingDetail = loadingDetails.has(key);
                        const typeColor = getTypeColor(item.type);

                        return (
                            <div key={idx}
                                className="rounded-2xl overflow-hidden transition-all duration-300"
                                style={{
                                    backgroundColor: 'var(--card-bg)',
                                    border: `1px solid ${isExpanded ? typeColor + '40' : 'rgba(255,255,255,0.06)'}`,
                                    boxShadow: isExpanded ? `0 4px 20px ${typeColor}10` : 'none',
                                }}
                            >
                                {/* Main row */}
                                <div
                                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                    onClick={() => toggleExpand(item)}
                                >
                                    {/* Type badge */}
                                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{ backgroundColor: typeColor + '15', color: typeColor }}>
                                        {getTypeIcon(item.type)}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                            {item.title}
                                        </div>
                                        <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                                            {item.author && <span>{item.author}</span>}
                                            {item.year && <span> · {item.year}</span>}
                                            {item.rating && <span> · ★ {item.rating}</span>}
                                            <span className="ml-2" style={{ color: typeColor, opacity: 0.8 }}>
                                                {getTypeLabel(item.type)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <ChevronDown
                                            size={18}
                                            style={{
                                                color: 'var(--text-secondary)',
                                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-3 pb-3 pt-0"
                                        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                        {isLoadingDetail ? (
                                            <div className="flex items-center gap-2 py-4 justify-center">
                                                <Loader2 size={16} className="animate-spin" style={{ color: typeColor }} />
                                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                    Загрузка деталей...
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="pt-3">
                                                {/* Cover + Details */}
                                                <div className="flex gap-3 mb-3">
                                                    {(details?.image || item.image) && (
                                                        <img
                                                            src={details?.image || item.image}
                                                            alt={item.title}
                                                            className="w-20 h-28 object-cover rounded-lg flex-shrink-0"
                                                            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                                                            onError={(e) => e.target.style.display = 'none'}
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        {(details?.description || item.description) && (
                                                            <p className="text-xs leading-relaxed mb-2" style={{
                                                                color: 'var(--text-secondary)',
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: 4,
                                                                WebkitBoxOrient: 'vertical',
                                                                overflow: 'hidden'
                                                            }}>
                                                                {details?.description || item.description}
                                                            </p>
                                                        )}
                                                        {details?.director && (
                                                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                                Режиссёр: <span style={{ color: 'var(--text-primary)' }}>{details.director}</span>
                                                            </div>
                                                        )}
                                                        {details?.narrator && (
                                                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                                Чтец: <span style={{ color: 'var(--text-primary)' }}>{details.narrator}</span>
                                                            </div>
                                                        )}
                                                        {details?.pages && (
                                                            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                                Страниц: {details.pages}
                                                            </div>
                                                        )}
                                                        {details?.torrents?.length > 0 && (
                                                            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                                                Торренты: {details.torrents.map(t => `${t.quality} (${t.size_gb?.toFixed(1)}GB)`).join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Download Button */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                                                    disabled={downloadingIds.has(key)}
                                                    className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200"
                                                    style={{
                                                        backgroundColor: downloadingIds.has(key) ? 'rgba(255,255,255,0.05)' : typeColor,
                                                        color: downloadingIds.has(key) ? 'var(--text-secondary)' : '#fff',
                                                        opacity: downloadingIds.has(key) ? 0.7 : 1,
                                                    }}
                                                >
                                                    {downloadingIds.has(key) ? (
                                                        <><Loader2 size={16} className="animate-spin" /> Добавляется...</>
                                                    ) : (
                                                        <><Download size={16} /> Скачать в библиотеку</>
                                                    )}
                                                </button>

                                                {/* Info about movie requirements */}
                                                {item.type === 'movie' && (
                                                    <div className="flex items-start gap-1.5 mt-2 text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
                                                        <Info size={12} className="flex-shrink-0 mt-0.5" />
                                                        <span>Для фильмов нужен запущенный qBittorrent и FFmpeg</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
