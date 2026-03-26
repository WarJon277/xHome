import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchDashboardData, fetchMovie, fetchBook, fetchTvshow, clearProgress, fetchEpisode, saveProgress } from '../api';
import { Play, Book, Film, Tv, Image, BarChart2, Zap, Clock, RefreshCw, Trash2, Music, Users, X } from 'lucide-react';
import Player from '../components/Player';
import ConfirmationModal from '../components/ConfirmationModal';
import { useNavigate } from 'react-router-dom';
import { getCachedBooks, getLocalProgress } from '../utils/offlineStorage';
import PWACacheStatus from '../components/PWACacheStatus';
import OfflinePageManager from '../components/OfflinePageManager';
import { SkeletonDashboard } from '../components/Skeleton';
import useOnlineCount from '../hooks/useOnlineCount';
import { useUser } from '../contexts/UserContext';

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showClearModal, setShowClearModal] = useState(false);
    const [showOnlineModal, setShowOnlineModal] = useState(false);
    const navigate = useNavigate();
    const { onlineCount, onlineUsers } = useOnlineCount();
    const { username } = useUser();

    const loadData = async () => {
        try {
            setLoading(true);
            const [result, localBooks] = await Promise.all([
                fetchDashboardData().catch(err => {
                    console.warn("Dashboard fetch failed, using minimal mode", err);
                    return { continue_watching: [], new_arrivals: [], latest_photos: [], stats: { movies_count: 0, books_count: 0, tvshows_count: 0, photos_count: 0 } };
                }),
                getCachedBooks().catch(() => [])
            ]);

            // Enrich continue_watching with local book progress
            const localProgresses = await Promise.all(
                localBooks.map(async (b) => {
                    const lp = await getLocalProgress(b.id);
                    if (!lp) return null;
                    return {
                        id: b.id,
                        type: 'book',
                        title: b.title,
                        thumbnail: b.thumbnail_path,
                        total_pages: b.total_pages || b.totalPages,
                        progress: lp.page,
                        scroll_ratio: lp.scrollRatio,
                        last_updated: new Date(lp.updatedAt).toISOString()
                    };
                })
            );

            const validLocal = localProgresses.filter(p => p !== null);

            // Merge: For each book, take newest between remote and local
            const merged = [...result.continue_watching];
            validLocal.forEach(lp => {
                const existingIndex = merged.findIndex(rp => rp.type === 'book' && parseInt(rp.id) === parseInt(lp.id));
                if (existingIndex !== -1) {
                    const rp = merged[existingIndex];
                    if (new Date(lp.last_updated) > new Date(rp.last_updated)) {
                        merged[existingIndex] = lp;
                        // Proactive Sync: Push newest local progress to server if online
                        if (navigator.onLine) {
                            saveProgress('book', parseInt(lp.id), lp.progress, lp.scroll_ratio).catch(() => { });
                        }
                    }
                } else {
                    merged.push(lp);
                    // Proactive Sync: Push local progress to server if online
                    if (navigator.onLine) {
                        saveProgress('book', parseInt(lp.id), lp.progress, lp.scroll_ratio).catch(() => { });
                    }
                }
            });

            // Re-sort by last_updated
            merged.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));

            result.continue_watching = merged.slice(0, 10);
            setData(result);
        } catch (err) {
            console.error("Failed to load dashboard:", err);
            setError("Не удалось загрузить данные дашборда");
        } finally {
            setLoading(false);
        }
    };

    const handleClearHistory = async () => {
        try {
            await clearProgress();
            setShowClearModal(false);
            loadData();
        } catch (err) {
            console.error("Failed to clear progress:", err);
        }
    };

    const getImageUrl = (path) => {
        if (!path) return '/placeholder.jpg';
        if (path.startsWith('http')) return path;

        // Normalize slashes
        let normalizedPath = path.replace(/\\/g, '/');

        if (normalizedPath.startsWith('/')) {
            return normalizedPath;
        } else if (normalizedPath.startsWith('uploads/')) {
            return `/${normalizedPath}`;
        } else {
            return `/uploads/${normalizedPath}`;
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleMediaClick = async (item) => {
        try {
            if (item.type === 'movie' || item.type === 'episode') {
                const fullItem = item.type === 'movie'
                    ? await fetchMovie(item.id)
                    : await fetchEpisode(item.id); // It's an episode ID in progress

                window.dispatchEvent(new CustomEvent('app:play', { detail: fullItem }));
            } else if (item.type === 'tvshow') {
                navigate(`/tvshows/${item.id}`);
            } else if (item.type === 'book') {
                navigate(`/books/${item.id}`);
            } else if (item.type === 'audiobook') {
                navigate('/audiobooks', { state: { openBookId: item.id } });
            }
        } catch (err) {
            console.error("Error handling media click:", err);
        }
    };

    if (loading) return <SkeletonDashboard />;

    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="p-4 sm:p-8 pb-24 pt-20 sm:pt-8 max-w-7xl mx-auto space-y-10">
            {showClearModal && (
                <ConfirmationModal
                    title="Очистить историю?"
                    message="Все данные о просмотренных фильмах и прочитанных книгах будут удалены безвозвратно."
                    onClose={() => setShowClearModal(false)}
                    onConfirm={handleClearHistory}
                    confirmLabel="Очистить"
                    isDanger={true}
                />
            )}

            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
                        С возвращением{username ? `, ${username}` : ''}! 👋
                    </h1>
                    <p className="text-lg opacity-80" style={{ color: 'var(--text-secondary)' }}>Вот что нового в вашем домашнем портале.</p>
                </div>
                <button
                    onClick={loadData}
                    className="p-3 rounded-full hover:bg-white/10 transition-all active:scale-95"
                    title="Обновить"
                >
                    <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
                </button>
            </header>

            <div className="flex flex-col lg:flex-row gap-8">

                {/* 1. Continue Watching - Large Widget */}
                <section className="flex-1 lg:w-2/3 min-w-0 space-y-6">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <h2 className="flex items-center gap-3 text-2xl font-bold">
                            <Clock className="text-blue-500" size={24} /> Продолжить
                        </h2>
                        {data.continue_watching.length > 0 && (
                            <button
                                onClick={() => setShowClearModal(true)}
                                className="text-sm font-medium text-gray-400 hover:text-red-500 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
                                title="Очистить историю"
                            >
                                <Trash2 size={16} /> Очистить
                            </button>
                        )}
                    </div>
                    {data.continue_watching.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {data.continue_watching.map((item) => (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    onClick={() => handleMediaClick(item)}
                                    tabIndex={0}
                                    data-tv-clickable="true"
                                    onKeyDown={(e) => e.key === 'Enter' && handleMediaClick(item)}
                                    className="dashboard-card tv-focusable group relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer focus:ring-2 ring-red-500 outline-none shadow-xl"
                                >
                                    <div className="aspect-video overflow-hidden relative">
                                        <img
                                            src={getImageUrl(item.thumbnail)}
                                            alt={item.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                            onError={(e) => e.target.src = '/placeholder.jpg'}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                                        {/* Progress Bar */}
                                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10">
                                            <div
                                                className="h-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.9)] transition-all duration-1000"
                                                style={{ width: `${item.type === 'book' ? Math.min(100, Math.max(5, ((item.progress || 0) / (item.total_pages || 1)) * 100)) : (item.progress > 0 ? 30 : 0)}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="absolute bottom-4 left-5 right-5 text-white">
                                        <p className="text-[11px] font-black text-red-500 uppercase tracking-widest mb-1 opacity-90">
                                            {item.type === 'movie' ? 'Фильм' : item.type === 'book' ? 'Книга' : item.type === 'audiobook' ? 'Аудио' : 'Сериал'}
                                        </p>
                                        <h3 className="font-bold text-lg truncate leading-tight">{item.title}</h3>
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/20 backdrop-blur-[2px]">
                                        <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-2xl transform scale-75 group-hover:scale-100 transition-transform duration-500">
                                            {item.type === 'book' ? <Book size={32} /> : item.type === 'audiobook' ? <Music fill="white" size={32} /> : <Play fill="white" size={32} />}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white/5 border border-dashed border-white/20 rounded-3xl p-12 text-center">
                            <Clock className="mx-auto text-gray-600 mb-4" size={48} />
                            <p className="text-gray-500 text-lg">Здесь появятся фильмы и книги, которые вы начали смотреть или читать.</p>
                        </div>
                    )}
                </section>

                {/* 5. Daily Stats & Recommendation - Right Column */}
                <section className="lg:w-1/3 min-w-0 space-y-8">
                    {/* Online Counter */}
                    <div
                        onClick={() => setShowOnlineModal(true)}
                        className="relative overflow-hidden rounded-2xl border border-emerald-500/30 p-4 flex items-center gap-4 cursor-pointer hover:border-emerald-400/50 hover:bg-white/5 transition-all active:scale-[0.98]"
                        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.05) 100%)' }}
                        title="Показать подключённых"
                    >
                        <div className="relative">
                            <Users className="text-emerald-400" size={28} />
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
                        </div>
                        <div>
                            <span className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>{onlineCount}</span>
                            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400/80">
                                {onlineCount === 1 ? 'человек онлайн' : onlineCount >= 2 && onlineCount <= 4 ? 'человека онлайн' : 'человек онлайн'}
                            </p>
                        </div>
                    </div>

                    {/* Online Users Modal */}
                    {showOnlineModal && createPortal(
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setShowOnlineModal(false)}>
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                            <div
                                className="relative bg-[#1f1f1f] border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-auto shadow-2xl"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <Users className="text-emerald-400" size={20} />
                                        Сейчас на портале
                                    </h3>
                                    <button
                                        onClick={() => setShowOnlineModal(false)}
                                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                    {onlineUsers && onlineUsers.length > 0 ? onlineUsers.map((user, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
                                            <span className="font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                                {user.name || user.ip} {user.name && <span className="text-xs text-gray-500 ml-2">({user.ip})</span>}
                                            </span>
                                        </div>
                                    )) : (
                                        <p className="text-gray-500 text-center py-4">Нет подключений</p>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-4 text-center">
                                    Всего: {onlineUsers ? onlineUsers.length : 0}
                                </p>
                            </div>
                        </div>,
                        document.body
                    )}

                    <div className="space-y-4">
                        <h2 className="flex items-center gap-3 text-2xl font-bold">
                            <BarChart2 className="text-purple-500" size={24} /> Статистика
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { icon: Film, color: 'text-red-500', count: data.stats.movies_count, label: 'Фильмов' },
                                { icon: Book, color: 'text-green-500', count: data.stats.books_count, label: 'Книг' },
                                { icon: Music, color: 'text-blue-400', count: data.stats.audiobooks_count || 0, label: 'Аудиокниг' },
                                { icon: Tv, color: 'text-blue-500', count: data.stats.tvshows_count, label: 'Сериалов' },
                                { icon: Image, color: 'text-yellow-500', count: data.stats.photos_count, label: 'Фото' },
                            ].map((stat, i) => (
                                <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col items-center hover:bg-white/10 transition-colors">
                                    <stat.icon className={`${stat.color} mb-2`} size={24} />
                                    <span className="text-2xl font-bold tracking-tight">{stat.count}</span>
                                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="flex items-center gap-3 text-2xl font-bold">
                            <RefreshCw className="text-cyan-500" size={24} /> Оффлайн режим
                        </h2>
                        <PWACacheStatus />
                        <OfflinePageManager />
                    </div>

                    {/* 3. Random Recommendation inside stats column */}
                    {data.recommendation && (
                        <div className="space-y-4">
                            <h2 className="flex items-center gap-3 text-2xl font-bold">
                                <Zap className="text-yellow-400" size={24} /> Совет дня
                            </h2>
                            <div
                                onClick={() => handleMediaClick(data.recommendation)}
                                tabIndex={0}
                                data-tv-clickable="true"
                                onKeyDown={(e) => e.key === 'Enter' && handleMediaClick(data.recommendation)}
                                className="group tv-focusable relative rounded-3xl overflow-hidden aspect-[3/4.2] cursor-pointer focus:ring-2 ring-red-500 outline-none shadow-2xl"
                            >
                                <img
                                    src={getImageUrl(data.recommendation.thumbnail)}
                                    alt={data.recommendation.title}
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                    onError={(e) => e.target.src = '/placeholder.jpg'}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90" />
                                <div className="absolute bottom-6 left-6 right-6 text-white">
                                    <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest mb-1">
                                        Рекомендуем
                                    </p>
                                    <h3 className="text-xl font-black leading-tight group-hover:text-yellow-400 transition-colors">{data.recommendation.title}</h3>
                                    <p className="text-sm text-gray-300 mt-2 font-medium">{data.recommendation.type === 'movie' ? 'Фильм' : data.recommendation.type === 'book' ? 'Книга' : data.recommendation.type === 'audiobook' ? 'Аудиокнига' : 'Сериал'}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {/* 2. New Arrivals - Full Width Horizontal Scroll */}
            <section className="space-y-6 pt-4">
                <div className="flex items-center gap-3 border-b border-white/10 pb-2">
                    <h2 className="text-2xl font-bold">
                        <Zap className="text-red-500 inline mr-2" size={24} /> Новинки портала
                    </h2>
                </div>
                <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                    {data.new_arrivals.map((item) => (
                        <div
                            key={`new-${item.type}-${item.id}`}
                            onClick={() => handleMediaClick(item)}
                            tabIndex={0}
                            data-tv-clickable="true"
                            onKeyDown={(e) => e.key === 'Enter' && handleMediaClick(item)}
                            className="flex-none w-40 sm:w-52 group tv-focusable cursor-pointer outline-none p-1 rounded-2xl transition-all"
                        >
                            <div className="aspect-[2/3] rounded-2xl overflow-hidden mb-3 relative shadow-lg">
                                <img
                                    src={getImageUrl(item.thumbnail)}
                                    alt={item.title}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    onError={(e) => e.target.src = '/placeholder.jpg'}
                                />
                                <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-xl p-2 rounded-xl text-white shadow-lg border border-white/10">
                                    {item.type === 'movie' ? <Film size={16} /> : item.type === 'book' ? <Book size={16} /> : item.type === 'audiobook' ? <Music size={16} /> : <Tv size={16} />}
                                </div>
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                            </div>
                            <h3 className="text-base font-bold truncate px-1" style={{ color: 'var(--text-primary)' }}>{item.title}</h3>
                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-tighter px-1 mt-0.5">
                                {item.type === 'movie' ? 'Фильм' : item.type === 'book' ? 'Книга' : item.type === 'audiobook' ? 'Аудиокнига' : 'Сериал'}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* 4. Quick Access to Latest Photos - Grid */}
            <section className="space-y-6 pt-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h2 className="flex items-center gap-3 text-2xl font-bold">
                        <Image className="text-yellow-500" size={24} /> Недавние фото
                    </h2>
                    <button
                        onClick={() => navigate('/gallery')}
                        className="text-sm font-bold text-red-500 hover:text-red-400 transition-colors"
                    >
                        Смотреть все
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                    {data.latest_photos.slice(0, 5).map((photo) => (
                        <div
                            key={photo.id}
                            onClick={() => navigate('/gallery')}
                            tabIndex={0}
                            data-tv-clickable="true"
                            onKeyDown={(e) => e.key === 'Enter' && navigate('/gallery')}
                            className="aspect-square rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-all tv-focusable focus:ring-2 ring-red-500 outline-none shadow-lg group relative"
                        >
                            <img
                                src={getImageUrl(photo.thumbnail || photo.url)}
                                alt="Latest"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                onError={(e) => e.target.src = '/placeholder.jpg'}
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                        </div>
                    ))}
                </div>
            </section>

        </div>
    );
}
