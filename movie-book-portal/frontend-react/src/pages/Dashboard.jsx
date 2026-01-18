import { useEffect, useState } from 'react';
import { fetchDashboardData, fetchMovie, fetchBook, fetchTvshow, clearProgress, fetchEpisode } from '../api';
import { Play, Book, Film, Tv, Image, BarChart2, Zap, Clock, RefreshCw, Trash2, Music } from 'lucide-react';
import Player from '../components/Player';
import ConfirmationModal from '../components/ConfirmationModal';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showClearModal, setShowClearModal] = useState(false);
    const navigate = useNavigate();

    const loadData = async () => {
        try {
            setLoading(true);
            const result = await fetchDashboardData();
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

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400">Собираем ваш дашборд...</p>
        </div>
    );

    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="p-4 sm:p-8 pb-24 pt-20 sm:pt-8 max-w-7xl mx-auto">
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

            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                        С возвращением! 👋
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Вот что нового в вашем домашнем портале.</p>
                </div>
                <button
                    onClick={loadData}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* 1. Continue Watching - Large Widget */}
                <section className="md:col-span-8 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-xl font-semibold">
                            <Clock className="text-blue-500" /> Продолжить просмотр
                        </h2>
                        {data.continue_watching.length > 0 && (
                            <button
                                onClick={() => setShowClearModal(true)}
                                className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                                title="Очистить историю"
                            >
                                <Trash2 size={14} /> Очистить
                            </button>
                        )}
                    </div>
                    {data.continue_watching.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {data.continue_watching.map((item, idx) => (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    onClick={() => handleMediaClick(item)}
                                    tabIndex={0}
                                    data-tv-clickable="true"
                                    onKeyDown={(e) => e.key === 'Enter' && handleMediaClick(item)}
                                    className="dashboard-card tv-focusable group relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer focus:ring-2 ring-red-500 outline-none"
                                >
                                    <div className="aspect-video overflow-hidden">
                                        <img
                                            src={getImageUrl(item.thumbnail)}
                                            alt={item.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            onError={(e) => e.target.src = '/placeholder.jpg'}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                                        {/* Progress Bar */}
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                                            <div
                                                className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]"
                                                style={{ width: `${item.type === 'book' ? Math.max(5, item.scroll_ratio * 100) : (item.progress > 0 ? 30 : 0)}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="absolute bottom-3 left-4 right-4 text-white">
                                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-tighter mb-0.5 opacity-90">
                                            {item.type === 'movie' ? 'Фильм' : item.type === 'book' ? 'Книга' : item.type === 'audiobook' ? 'Аудио' : 'Сериал'}
                                        </p>
                                        <h3 className="font-bold text-sm truncate">{item.title}</h3>
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                            {item.type === 'book' ? <Book /> : item.type === 'audiobook' ? <Music fill="white" /> : <Play fill="white" />}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white/5 border border-dashed border-white/20 rounded-2xl p-8 text-center text-gray-500">
                            Здесь появятся фильмы и книги, которые вы начали смотреть или читать.
                        </div>
                    )}
                </section>

                {/* 5. Daily Stats - Right Widget */}
                <section className="md:col-span-4 space-y-4">
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                        <BarChart2 className="text-purple-500" /> Статистика
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col items-center">
                            <Film className="text-red-500 mb-2" size={20} />
                            <span className="text-2xl font-bold">{data.stats.movies_count}</span>
                            <span className="text-xs text-gray-400 capitalize">Фильмов</span>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col items-center">
                            <Book className="text-green-500 mb-2" size={20} />
                            <span className="text-2xl font-bold">{data.stats.books_count}</span>
                            <span className="text-xs text-gray-400 capitalize">Книг</span>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col items-center">
                            <Music className="text-blue-400 mb-2" size={20} />
                            <span className="text-2xl font-bold">{data.stats.audiobooks_count || 0}</span>
                            <span className="text-xs text-gray-400 capitalize">Аудиокниг</span>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col items-center">
                            <Tv className="text-blue-500 mb-2" size={20} />
                            <span className="text-2xl font-bold">{data.stats.tvshows_count}</span>
                            <span className="text-xs text-gray-400 capitalize">Сериалов</span>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col items-center">
                            <Image className="text-yellow-500 mb-2" size={20} />
                            <span className="text-2xl font-bold">{data.stats.photos_count}</span>
                            <span className="text-xs text-gray-400 capitalize">Фото</span>
                        </div>
                    </div>

                    {/* 3. Random Recommendation inside stats column */}
                    {data.recommendation && (
                        <div className="mt-6 space-y-4">
                            <h2 className="flex items-center gap-2 text-lg font-semibold">
                                <Zap className="text-yellow-400" /> Рекомендация
                            </h2>
                            <div
                                onClick={() => handleMediaClick(data.recommendation)}
                                tabIndex={0}
                                data-tv-clickable="true"
                                onKeyDown={(e) => e.key === 'Enter' && handleMediaClick(data.recommendation)}
                                className="group tv-focusable relative rounded-2xl overflow-hidden aspect-[3/4] cursor-pointer focus:ring-2 ring-red-500 outline-none"
                            >
                                <img
                                    src={getImageUrl(data.recommendation.thumbnail)}
                                    alt={data.recommendation.title}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    onError={(e) => e.target.src = '/placeholder.jpg'}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                                <div className="absolute bottom-4 left-4 right-4 text-white">
                                    <h3 className="text-lg font-bold leading-tight">{data.recommendation.title}</h3>
                                    <p className="text-xs text-gray-300 mt-1">{data.recommendation.type === 'movie' ? 'Фильм' : data.recommendation.type === 'book' ? 'Книга' : data.recommendation.type === 'audiobook' ? 'Аудиокнига' : 'Сериал'}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* 2. New Arrivals - Horizontal Scroll or Grid */}
                <section className="md:col-span-12 space-y-4 mt-4">
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                        <Zap className="text-red-500" /> Новинки
                    </h2>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                        {data.new_arrivals.map((item) => (
                            <div
                                key={`new-${item.type}-${item.id}`}
                                onClick={() => handleMediaClick(item)}
                                tabIndex={0}
                                data-tv-clickable="true"
                                onKeyDown={(e) => e.key === 'Enter' && handleMediaClick(item)}
                                className="flex-none w-36 sm:w-44 group tv-focusable cursor-pointer outline-none p-1 rounded-xl"
                            >
                                <div className="aspect-[2/3] rounded-xl overflow-hidden mb-2 relative">
                                    <img
                                        src={getImageUrl(item.thumbnail)}
                                        alt={item.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        onError={(e) => e.target.src = '/placeholder.jpg'}
                                    />
                                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md p-1.5 rounded-lg text-white">
                                        {item.type === 'movie' ? <Film size={14} /> : item.type === 'book' ? <Book size={14} /> : item.type === 'audiobook' ? <Music size={14} /> : <Tv size={14} />}
                                    </div>
                                </div>
                                <h3 className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</h3>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 4. Quick Access to Latest Photos */}
                <section className="md:col-span-12 space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-xl font-semibold">
                            <Image className="text-yellow-500" /> Недавние фото
                        </h2>
                        <button
                            onClick={() => navigate('/gallery')}
                            className="text-sm text-red-500 font-medium hover:underline"
                        >
                            Все фото
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {data.latest_photos.slice(0, 5).map((photo) => (
                            <div
                                key={photo.id}
                                onClick={() => navigate('/gallery')} // For simplicity, go to gallery
                                tabIndex={0}
                                data-tv-clickable="true"
                                onKeyDown={(e) => e.key === 'Enter' && navigate('/gallery')}
                                className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity tv-focusable focus:ring-2 ring-red-500 outline-none"
                            >
                                <img
                                    src={getImageUrl(photo.thumbnail || photo.url)}
                                    alt="Latest"
                                    className="w-full h-full object-cover"
                                    onError={(e) => e.target.src = '/placeholder.jpg'}
                                />
                            </div>
                        ))}
                    </div>
                </section>

            </div>
        </div>
    );
}
