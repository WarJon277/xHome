import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Wand2, Search, Loader2, RefreshCw } from 'lucide-react';
import {
    fetchMovies, fetchBooks, fetchTvshows,
    createMovie, createBook, createTvshow,
    updateMovie, updateBook, updateTvshow,
    deleteMovie, deleteBook, deleteTvshow,
    uploadMovieFile, uploadTvshowFile, uploadEpisodeFile,
    createEpisode,
    fetchTheme, updateTheme, resetTheme, fetchStats, uploadBookFile,
    fetchSuggestion, fetchBrowse, fetchDetails
} from '../api';
import { X, Download, BookOpen } from 'lucide-react';
import KaleidoscopeManager from '../components/KaleidoscopeManager';

export default function AdminPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState({ movies: 0, books: 0, tvshows: 0, photos: 0 });

    // Content Management State
    const [contentType, setContentType] = useState('movies'); // movies, books, tvshows
    const [items, setItems] = useState([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        year: '',
        director: '',
        author: '',
        rating: '',
        description: '',
        genre: 'Общее'
    });
    const [mainFile, setMainFile] = useState(null);
    const [thumbnail, setThumbnail] = useState(null);
    const [episodeFiles, setEpisodeFiles] = useState([]);
    const [seasonNumber, setSeasonNumber] = useState(1);
    const [isSuggesting, setIsSuggesting] = useState(false);

    // Browse/Suggestion State
    const [showBrowseModal, setShowBrowseModal] = useState(false);
    const [browseItems, setBrowseItems] = useState([]);
    const [isLoadingBrowse, setIsLoadingBrowse] = useState(false);

    // Lazy load covers AND descriptions effect
    useEffect(() => {
        let mounted = true;
        const timeouts = [];
        if (browseItems.length > 0 && showBrowseModal) {
            // Check for items needing covers/details
            browseItems.forEach((item, index) => {
                // If we don't have the cover/description loaded yet
                if (!item.coverLoaded) {
                    // Stagger requests to avoid flooding the backend
                    const tid = setTimeout(async () => {
                        if (!mounted) return;
                        try {
                            const data = await fetchDetails(item.id);
                            if (mounted && data) {
                                setBrowseItems(prev => {
                                    const next = [...prev];
                                    const idx = next.findIndex(i => i.id === item.id);
                                    if (idx !== -1) {
                                        next[idx] = {
                                            ...next[idx],
                                            description: data.description,
                                            coverLoaded: true
                                        };
                                    }
                                    return next;
                                });
                            }
                        } catch (e) {
                            if (mounted) {
                                // Mark as loaded to stop retrying even if failed
                                setBrowseItems(prev => {
                                    const next = [...prev];
                                    const idx = next.findIndex(i => i.id === item.id);
                                    if (idx !== -1) next[idx] = { ...next[idx], coverLoaded: true };
                                    return next;
                                });
                            }
                        }
                    }, index * 50);
                    timeouts.push(tid);
                }
            });
        }
        return () => {
            mounted = false;
            timeouts.forEach(clearTimeout);
        };
    }, [browseItems, showBrowseModal]);

    // Theme State
    const [themeColors, setThemeColors] = useState({
        '--bg-primary': '#0a0a1a',
        '--bg-secondary': '#1e1e1e',
        '--text-primary': '#ffffff',
        '--text-secondary': '#e0e0e0',
        '--accent-color': '#e50914',
        '--card-bg': '#1f1f1f',
    });

    useEffect(() => {
        loadStats();
        // Sync local state with API theme
        fetchTheme()
            .then(theme => {
                if (theme && Object.keys(theme).length > 0) {
                    setThemeColors(theme);
                }
            })
            .catch(err => {
                console.warn('Failed to load theme from API, using defaults/localStorage', err);
                const savedTheme = localStorage.getItem('appTheme');
                if (savedTheme) {
                    try { setThemeColors(JSON.parse(savedTheme)); } catch (e) { }
                }
            });
    }, []);

    useEffect(() => {
        if (activeTab === 'content') {
            loadContent();
        }
    }, [contentType, activeTab]);

    const loadStats = async () => {
        try {
            const data = await fetchStats();
            setStats(data);
        } catch (e) {
            console.error('Failed to load stats:', e);
        }
    };

    const loadContent = async () => {
        setIsLoadingItems(true);
        setLoadError(null);
        try {
            console.log('Fetching content for type:', contentType);
            let data;
            switch (contentType) {
                case 'movies':
                    data = await fetchMovies();
                    break;
                case 'books':
                    data = await fetchBooks();
                    break;
                case 'tvshows':
                    data = await fetchTvshows();
                    break;
                default:
                    data = [];
            }
            console.log('Fetched data:', data);

            // Ensure data is an array
            if (Array.isArray(data)) {
                setItems(data);
            } else {
                console.warn('Expected array for content, got:', typeof data);
                setItems([]);
                setLoadError('Неверный формат данных от сервера');
            }
        } catch (e) {
            console.error('Failed to load content:', e);
            setLoadError(`Ошибка загрузки: ${e.message}`);
            setItems([]);
        } finally {
            setIsLoadingItems(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsUploading(true);

        try {
            const data = {
                title: formData.title,
                year: formData.year ? parseInt(formData.year) : null,
                director: formData.director,
                author: formData.author,
                rating: formData.rating ? parseFloat(formData.rating) : 0,
                description: formData.description,
                genre: formData.genre
            };

            let itemId;

            // Create or Update
            if (editingId) {
                switch (contentType) {
                    case 'movies':
                        await updateMovie(editingId, data);
                        break;
                    case 'books':
                        await updateBook(editingId, data);
                        break;
                    case 'tvshows':
                        await updateTvshow(editingId, data);
                        break;
                }
                itemId = editingId;
            } else {
                let created;
                switch (contentType) {
                    case 'movies':
                        created = await createMovie(data);
                        break;
                    case 'books':
                        created = await createBook(data);
                        break;
                    case 'tvshows':
                        created = await createTvshow(data);
                        break;
                }
                itemId = created.id;
            }

            // Upload files
            if (contentType === 'tvshows' && episodeFiles.length > 0) {
                for (let i = 0; i < episodeFiles.length; i++) {
                    const file = episodeFiles[i];
                    const epData = {
                        tvshow_id: itemId,
                        season_number: seasonNumber,
                        episode_number: i + 1,
                        title: `Эпизод ${i + 1}`
                    };
                    const episode = await createEpisode(epData);
                    await uploadEpisodeFile(episode.id, file, (pct) => {
                        setUploadProgress(pct);
                    });
                }
            } else if (mainFile) {
                if (contentType === 'movies') {
                    await uploadMovieFile(itemId, mainFile, (pct) => setUploadProgress(pct));
                } else if (contentType === 'tvshows') {
                    await uploadTvshowFile(itemId, mainFile, (pct) => setUploadProgress(pct));
                } else if (contentType === 'books') {
                    await uploadBookFile(itemId, mainFile, (pct) => setUploadProgress(pct));
                }
            }

            // Upload Thumbnail
            if (thumbnail) {
                const formData = new FormData();
                formData.append('file', thumbnail);

                const endpoint = contentType === 'movies' ? 'movies' :
                    contentType === 'books' ? 'books' : 'tvshows';

                const response = await fetch(`/api/${endpoint}/${itemId}/upload_thumbnail`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    console.error('Thumbnail upload failed');
                }
            }

            alert(editingId ? 'Успешно обновлено!' : 'Успешно добавлено!');
            resetForm();
            loadContent();
            loadStats();
        } catch (e) {
            console.error('Submit error:', e);
            alert('Ошибка: ' + e.message);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleEdit = (item) => {
        setFormData({
            title: item.title || '',
            year: item.year || '',
            director: item.director || '',
            author: item.author || '',
            rating: item.rating || '',
            description: item.description || '',
            genre: item.genre || 'Общее'
        });
        setEditingId(item.id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Удалить этот элемент?')) return;

        try {
            switch (contentType) {
                case 'movies':
                    await deleteMovie(id);
                    break;
                case 'books':
                    await deleteBook(id);
                    break;
                case 'tvshows':
                    await deleteTvshow(id);
                    break;
            }
            loadContent();
            loadStats();
        } catch (e) {
            alert('Ошибка удаления: ' + e.message);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            year: '',
            director: '',
            author: '',
            rating: '',
            description: '',
            genre: 'Общее'
        });
        setMainFile(null);
        setThumbnail(null);
        setEpisodeFiles([]);
        setEditingId(null);
        setShowForm(false);
    };

    const handleBrowse = async () => {
        if (!formData.genre || formData.genre === 'Общее') {
            alert('Пожалуйста, выберите конкретный жанр');
            return;
        }
        setShowBrowseModal(true);
        setIsLoadingBrowse(true);
        try {
            // 1. Fetch list of ~20 items (lite)
            const items = await fetchBrowse(contentType, formData.genre);
            setBrowseItems(items);
        } catch (e) {
            console.error("Browse failed:", e);
            alert("Не удалось загрузить список книг.");
            setShowBrowseModal(false);
        } finally {
            setIsLoadingBrowse(false);
        }
    };

    const handleSelectSuggestion = async (item) => {
        // item has { id, title, author, source_url }
        setShowBrowseModal(false);
        setIsSuggesting(true); // Reuse loading state on the button or global

        try {
            // 2. Fetch full details for selected item
            const data = await fetchDetails(item.id);

            setFormData({
                ...formData,
                title: data.title,
                year: data.year || '',
                director: data.type === 'movie' ? (data.author_director || '') : '',
                author: data.type === 'book' ? (data.author_director || '') : '',
                description: data.description || '',
                rating: data.rating || '',
            });

            // Helper to fetch file via proxy and create File object
            const fetchFileViaProxy = async (url, defaultName) => {
                if (!url) return null;
                try {
                    const res = await fetch(`/api/discovery/proxy?url=${encodeURIComponent(url)}`);
                    if (!res.ok) throw new Error('Proxy fetch failed');
                    const blob = await res.blob();
                    // Try to get filename from content-disposition if possible, or use default
                    const contentDisp = res.headers.get('Content-Disposition');
                    let filename = defaultName;
                    if (contentDisp && contentDisp.includes('filename=')) {
                        filename = contentDisp.split('filename=')[1].replace(/["']/g, '');
                    }
                    if (!filename.includes('.')) {
                        // guess extension
                        if (blob.type.includes('epub')) filename += '.epub';
                        else if (blob.type.includes('fb2')) filename += '.fb2';
                        else if (blob.type.includes('image')) filename += '.jpg';
                    }
                    return new File([blob], filename, { type: blob.type });
                } catch (e) {
                    console.error("Failed to fetch file via proxy:", url, e);
                    return null;
                }
            };

            // 3. Fetch Thumbnail
            if (data.image) {
                const thumbFile = await fetchFileViaProxy(data.image, `cover_${data.title}.jpg`);
                if (thumbFile) setThumbnail(thumbFile);
            }

            // 4. Fetch Book File
            if (data.type === 'book' && data.download_url) {
                const bookFile = await fetchFileViaProxy(data.download_url, `${data.title}.epub`);
                if (bookFile) setMainFile(bookFile);
            }

            alert(`Книга "${data.title}" загружена!\nФайлы прикреплены.`);

        } catch (err) {
            console.error("Details fetch failed:", err);
            alert("Не удалось загрузить детали книги.");
        } finally {
            setIsSuggesting(false);
        }
    };

    const applyThemePreset = (preset) => {
        const presets = {
            midnight: {
                '--bg-primary': '#0a0a1a',
                '--bg-secondary': '#1e1e1e',
                '--text-primary': '#ffffff',
                '--text-secondary': '#e0e0e0',
                '--accent-color': '#e50914',
                '--card-bg': '#1f1f1f',
            },
            light: {
                '--bg-primary': '#f5f5f5',
                '--bg-secondary': '#ffffff',
                '--text-primary': '#333333',
                '--text-secondary': '#555555',
                '--accent-color': '#2196f3',
                '--card-bg': '#ffffff',
            },
            ocean: {
                '--bg-primary': '#001e3c',
                '--bg-secondary': '#0a2e52',
                '--text-primary': '#e3f2fd',
                '--text-secondary': '#90caf9',
                '--accent-color': '#00bcd4',
                '--card-bg': '#0a2e52',
            },
            forest: {
                '--bg-primary': '#1b2e1b',
                '--bg-secondary': '#2e4a2e',
                '--text-primary': '#e8f5e9',
                '--text-secondary': '#a5d6a7',
                '--accent-color': '#66bb6a',
                '--card-bg': 'rgba(46, 74, 46, 0.7)',
            },
            cyberpunk: {
                '--bg-primary': '#050014',
                '--bg-secondary': '#1a0b2e',
                '--text-primary': '#fff0f5',
                '--text-secondary': '#ff69b4',
                '--accent-color': '#ff00ff',
                '--card-bg': 'rgba(26, 11, 46, 0.7)',
            },
            sunset: {
                '--bg-primary': '#2d1b2e',
                '--bg-secondary': '#b0413e',
                '--text-primary': '#ffffc2',
                '--text-secondary': '#feb2a8',
                '--accent-color': '#fca311',
                '--card-bg': 'rgba(45, 27, 46, 0.7)',
            },
            dracula: {
                '--bg-primary': '#282a36',
                '--bg-secondary': '#44475a',
                '--text-primary': '#f8f8f2',
                '--text-secondary': '#6272a4',
                '--accent-color': '#ff79c6',
                '--card-bg': 'rgba(68, 71, 90, 0.7)',
            },
            coffee: {
                '--bg-primary': '#2c241b',
                '--bg-secondary': '#4a3c31',
                '--text-primary': '#e6d7c3',
                '--text-secondary': '#a89f91',
                '--accent-color': '#c08c5d',
                '--card-bg': 'rgba(60, 48, 40, 0.75)',
            }
        };

        if (presets[preset]) {
            const newTheme = presets[preset];
            setThemeColors(newTheme);
            // Apply to document root
            Object.entries(newTheme).forEach(([key, value]) => {
                document.documentElement.style.setProperty(key, value);
            });
            // Apply gradient background to body
            if (newTheme['--bg-primary']) {
                const bg2 = newTheme['--bg-secondary'] || newTheme['--bg-primary'];
                document.body.style.background = `linear-gradient(135deg, ${newTheme['--bg-primary']} 0%, ${bg2} 100%)`;
                document.body.style.backgroundAttachment = 'fixed';
            }
            // Save to API (and local storage as backup)
            updateTheme(newTheme).catch(console.error);
            localStorage.setItem('appTheme', JSON.stringify(newTheme));
        }
    };

    return (
        <div
            className="min-h-screen p-4 sm:p-8"
            style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-white/10 rounded-full"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-2xl sm:text-3xl font-bold">Админ-панель</h1>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 sm:gap-4 border-b border-gray-700 mb-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-4 sm:px-6 py-3 font-medium transition-colors ${activeTab === 'dashboard'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    Дашборд
                </button>
                <button
                    onClick={() => setActiveTab('content')}
                    className={`px-4 sm:px-6 py-3 font-medium transition-colors ${activeTab === 'content'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    Контент
                </button>
                <button
                    onClick={() => setActiveTab('themes')}
                    className={`px-4 sm:px-6 py-3 font-medium transition-colors ${activeTab === 'themes'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    Оформление
                </button>
                <button
                    onClick={() => setActiveTab('kaleidoscopes')}
                    className={`px-4 sm:px-6 py-3 font-medium transition-colors ${activeTab === 'kaleidoscopes'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    Калейдоскопы
                </button>
            </div>

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Фильмы" value={stats.movies} />
                    <StatCard title="Книги" value={stats.books} />
                    <StatCard title="Сериалы" value={stats.tvshows} />
                    <StatCard title="Фото" value={stats.photos} />
                </div>
            )}

            {/* Content Tab */}
            {activeTab === 'content' && (
                <div>
                    {!showForm ? (
                        <>
                            <div className="flex flex-wrap gap-4 mb-6 items-center">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setContentType('movies')}
                                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded text-sm sm:text-base ${contentType === 'movies' ? 'bg-primary' : 'bg-gray-700'
                                            }`}
                                    >
                                        Фильмы
                                    </button>
                                    <button
                                        onClick={() => setContentType('books')}
                                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded text-sm sm:text-base ${contentType === 'books' ? 'bg-primary' : 'bg-gray-700'
                                            }`}
                                    >
                                        Книги
                                    </button>
                                    <button
                                        onClick={() => setContentType('tvshows')}
                                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded text-sm sm:text-base ${contentType === 'tvshows' ? 'bg-primary' : 'bg-gray-700'
                                            }`}
                                    >
                                        Сериалы
                                    </button>
                                </div>
                                <button
                                    onClick={() => setShowForm(true)}
                                    className="ml-auto px-4 py-2 bg-green-600 rounded flex items-center gap-2 text-sm sm:text-base"
                                >
                                    <Plus size={20} /> <span className="hidden sm:inline">Добавить</span>
                                </button>
                            </div>

                            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--card-bg)' }}>
                                {loadError && (
                                    <div className="p-4 bg-red-900/30 border border-red-500/50 text-red-200 text-center">
                                        {loadError}
                                        <button onClick={loadContent} className="ml-4 underline">Повторить</button>
                                    </div>
                                )}

                                {isLoadingItems && (
                                    <div className="p-8 text-center text-gray-400">Загрузка...</div>
                                )}

                                {!isLoadingItems && !loadError && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-gray-800 text-gray-300">
                                                <tr>
                                                    <th className="p-4 whitespace-nowrap">ID</th>
                                                    <th className="p-4 whitespace-nowrap">Название</th>
                                                    <th className="p-4 whitespace-nowrap">Действия</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-[var(--text-primary)]">
                                                {items.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="3" className="p-8 text-center text-gray-400">
                                                            Нет элементов
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    items.map(item => (
                                                        <tr key={item.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                                                            <td className="p-4">{item.id}</td>
                                                            <td className="p-4 font-medium">{item.title}</td>
                                                            <td className="p-4 flex gap-2">
                                                                <button
                                                                    onClick={() => handleEdit(item)}
                                                                    className="p-2 bg-yellow-600 rounded hover:bg-yellow-700 text-white"
                                                                    title="Редактировать"
                                                                >
                                                                    <Edit size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(item.id)}
                                                                    className="p-2 bg-red-600 rounded hover:bg-red-700 text-white"
                                                                    title="Удалить"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <ContentForm
                            contentType={contentType}
                            formData={formData}
                            setFormData={setFormData}
                            mainFile={mainFile}
                            setMainFile={setMainFile}
                            thumbnail={thumbnail}
                            setThumbnail={setThumbnail}
                            episodeFiles={episodeFiles}
                            setEpisodeFiles={setEpisodeFiles}
                            seasonNumber={seasonNumber}
                            setSeasonNumber={setSeasonNumber}
                            onSubmit={handleSubmit}
                            onCancel={resetForm}
                            isUploading={isUploading}
                            uploadProgress={uploadProgress}
                            editingId={editingId}
                            onSuggest={handleBrowse}
                            isSuggesting={isSuggesting}
                        />
                    )}
                </div>
            )}

            {/* Themes Tab */}
            {activeTab === 'themes' && (
                <ThemeSettings
                    themeColors={themeColors}
                    setThemeColors={setThemeColors}
                    applyPreset={applyThemePreset}
                    updateThemeAPI={updateTheme}
                />
            )}

            {/* Kaleidoscopes Tab */}
            {activeTab === 'kaleidoscopes' && (
                <KaleidoscopeManager />
            )}

            {/* Browse Modal */}
            {showBrowseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-700 shadow-2xl">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold">Выберите книгу ({formData.genre})</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleBrowse}
                                    className="p-2 hover:bg-white/10 rounded-full text-primary"
                                    title="Обновить список"
                                    disabled={isLoadingBrowse}
                                >
                                    <RefreshCw size={24} className={isLoadingBrowse ? "animate-spin" : ""} />
                                </button>
                                <button onClick={() => setShowBrowseModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {isLoadingBrowse ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Loader2 className="animate-spin mb-4 text-primary" size={48} />
                                    <p className="text-gray-400">Ищем книги на Flibusta...</p>
                                </div>
                            ) : browseItems.length === 0 ? (
                                <div className="text-center py-20 text-gray-400">
                                    Книги не найдены. Попробуйте другой жанр.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {browseItems.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleSelectSuggestion(item)}
                                            title={`${item.title} - ${item.author}`}
                                            className="group relative cursor-pointer bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-primary transition-all hover:scale-105 shadow-lg"
                                        >
                                            <div className="aspect-[2/3] bg-gray-900 relative">
                                                <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex flex-col justify-between p-3 text-center">
                                                    <div className="text-xs text-gray-300 border-b border-gray-600 pb-2 mb-2 line-clamp-1">{item.author}</div>
                                                    <div className="font-bold text-sm text-gray-100 line-clamp-4 leading-snug">{item.title}</div>
                                                    <div className="mt-auto pt-2 opacity-50 text-gray-400"><BookOpen size={24} className="mx-auto" /></div>
                                                </div>
                                                {/* Overlay */}
                                                <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center p-4 text-center z-10">
                                                    {item.description ? (
                                                        <div className="text-[10px] leading-relaxed text-gray-300 mb-3 overflow-hidden line-clamp-[10]">
                                                            {item.description}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] text-gray-500 mb-4 animate-pulse">Загрузка описания...</div>
                                                    )}
                                                    <div className="bg-primary text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-transform mt-auto">
                                                        <Download size={16} /> Выбрать
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ title, value }) {
    return (
        <div
            className="p-6 rounded-lg text-center"
            style={{ backgroundColor: 'var(--card-bg)' }}
        >
            <h3 className="text-gray-400 mb-2">{title}</h3>
            <div className="text-4xl font-bold text-primary">{value}</div>
        </div>
    );
}

function ContentForm({
    contentType, formData, setFormData, mainFile, setMainFile,
    thumbnail, setThumbnail, episodeFiles, setEpisodeFiles,
    seasonNumber, setSeasonNumber, onSubmit, onCancel,
    isUploading, uploadProgress, editingId,
    onSuggest, isSuggesting
}) {
    return (
        <form onSubmit={onSubmit} className="p-4 sm:p-6 rounded-lg max-w-2xl" style={{ backgroundColor: 'var(--card-bg)' }}>
            <h2 className="text-2xl mb-6">{editingId ? 'Редактирование' : 'Добавить новый элемент'}</h2>

            <input
                type="text"
                placeholder="Название"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 mb-4 bg-gray-800 rounded"
                required
            />

            <input
                type="number"
                placeholder="Год"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className="w-full p-3 mb-4 bg-gray-800 rounded"
            />

            <input
                type="text"
                placeholder={contentType === 'books' ? 'Автор' : 'Режиссёр'}
                value={contentType === 'books' ? formData.author : formData.director}
                onChange={(e) => setFormData({
                    ...formData,
                    [contentType === 'books' ? 'author' : 'director']: e.target.value
                })}
                className="w-full p-3 mb-4 bg-gray-800 rounded"
            />

            <input
                type="number"
                step="0.1"
                placeholder="Рейтинг (0-10)"
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                className="w-full p-3 mb-4 bg-gray-800 rounded"
            />

            <div className="flex gap-2 mb-4">
                <select
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    className="flex-1 p-3 bg-gray-800 rounded"
                >
                    <option value="">Выберите жанр</option>
                    <optgroup label="Фантастика">
                        <option value="Альтернативная история">Альтернативная история</option>
                        <option value="Боевая фантастика">Боевая фантастика</option>
                        <option value="Бояръ-аниме">Бояръ-аниме</option>
                        <option value="Героическая фантастика">Героическая фантастика</option>
                        <option value="Городское фэнтези">Городское фэнтези</option>
                        <option value="Киберпанк">Киберпанк</option>
                        <option value="Космическая фантастика">Космическая фантастика</option>
                        <option value="ЛитРПГ">ЛитРПГ</option>
                        <option value="Мистика">Мистика</option>
                        <option value="Научная фантастика">Научная фантастика</option>
                        <option value="Попаданцы">Попаданцы</option>
                        <option value="Постапокалипсис">Постапокалипсис</option>
                        <option value="Социальная фантастика">Социальная фантастика</option>
                        <option value="Стимпанк">Стимпанк</option>
                        <option value="Тёмное фэнтези">Тёмное фэнтези</option>
                        <option value="Ужасы">Ужасы</option>
                        <option value="Фэнтези">Фэнтези</option>
                        <option value="Эпическая фантастика">Эпическая фантастика</option>
                        <option value="Юмористическая фантастика">Юмористическая фантастика</option>
                    </optgroup>
                    <optgroup label="Детективы и Триллеры">
                        <option value="Артефакт-детективы">Артефакт-детективы</option>
                        <option value="Боевик">Боевик</option>
                        <option value="Дамский детективный роман">Дамский детективный роман</option>
                        <option value="Детективы">Детективы</option>
                        <option value="Иронический детектив">Иронический детектив</option>
                        <option value="Исторический детектив">Исторический детектив</option>
                        <option value="Классический детектив">Классический детектив</option>
                        <option value="Криминальный детектив">Криминальный детектив</option>
                        <option value="Крутой детектив">Крутой детектив</option>
                        <option value="Политический детектив">Политический детектив</option>
                        <option value="Полицейский детектив">Полицейский детектив</option>
                        <option value="Про маньяков">Про маньяков</option>
                        <option value="Советский детектив">Советский детектив</option>
                        <option value="Триллер">Триллер</option>
                        <option value="Шпионский детектив">Шпионский детектив</option>
                    </optgroup>
                    <optgroup label="Детская литература">
                        <option value="Детская литература: прочее">Детская литература: прочее</option>
                        <option value="Детская образовательная литература">Детская образовательная литература</option>
                        <option value="Зарубежная литература для детей">Зарубежная литература для детей</option>
                        <option value="Классическая детская литература">Классическая детская литература</option>
                        <option value="Народные сказки">Народные сказки</option>
                        <option value="Сказки зарубежных писателей">Сказки зарубежных писателей</option>
                        <option value="Сказки отечественных писателей">Сказки отечественных писателей</option>
                        <option value="Детская проза: приключения">Детская проза: приключения</option>
                        <option value="Детская фантастика">Детская фантастика</option>
                        <option value="Стихи для детей и подростков">Стихи для детей и подростков</option>
                    </optgroup>
                    <optgroup label="Любовные романы">
                        <option value="Исторические любовные романы">Исторические любовные романы</option>
                        <option value="Короткие любовные романы">Короткие любовные романы</option>
                        <option value="Любовное фэнтези">Любовное фэнтези</option>
                        <option value="Остросюжетные любовные романы">Остросюжетные любовные романы</option>
                        <option value="Современные любовные романы">Современные любовные романы</option>
                        <option value="Эротика">Эротика</option>
                    </optgroup>
                    <optgroup label="Проза">
                        <option value="Историческая проза">Историческая проза</option>
                        <option value="Классическая проза">Классическая проза</option>
                        <option value="Проза о войне">Проза о войне</option>
                        <option value="Современная проза">Современная проза</option>
                        <option value="Русская классика">Русская классика</option>
                        <option value="Советская классика">Советская классика</option>
                    </optgroup>
                    <optgroup label="Приключения">
                        <option value="Вестерн">Вестерн</option>
                        <option value="Исторические приключения">Исторические приключения</option>
                        <option value="Морские приключения">Морские приключения</option>
                        <option value="Приключения">Приключения</option>
                        <option value="Природа и животные">Природа и животные</option>
                        <option value="Путешествия и география">Путешествия и география</option>
                    </optgroup>
                    <optgroup label="Искусство и Культура">
                        <option value="Искусство и Дизайн">Искусство и Дизайн</option>
                        <option value="Кино">Кино</option>
                        <option value="Музыка">Музыка</option>
                        <option value="Культурология">Культурология</option>
                    </optgroup>
                    <optgroup label="Деловая литература">
                        <option value="Деловая литература">Деловая литература</option>
                        <option value="Карьера, кадры">Карьера, кадры</option>
                        <option value="Маркетинг, PR">Маркетинг, PR</option>
                        <option value="Финансы">Финансы</option>
                        <option value="Экономика">Экономика</option>
                    </optgroup>
                    <optgroup label="Наука и Образование">
                        <option value="История">История</option>
                        <option value="Психология">Психология</option>
                        <option value="Философия">Философия</option>
                        <option value="Математика">Математика</option>
                        <option value="Физика">Физика</option>
                        <option value="Литературоведение">Литературоведение</option>
                        <option value="Языкознание">Языкознание</option>
                        <option value="Политика">Политика</option>
                    </optgroup>
                    <optgroup label="Дом и семья">
                        <option value="Боевые искусства, спорт">Боевые искусства, спорт</option>
                        <option value="Домашние животные">Домашние животные</option>
                        <option value="Здоровье">Здоровье</option>
                        <option value="Кулинария">Кулинария</option>
                        <option value="Педагогика, воспитание">Педагогика, воспитание</option>
                        <option value="Популярная психология">Популярная психология</option>
                        <option value="Семейные отношения, секс">Семейные отношения, секс</option>
                        <option value="Хобби и ремесла">Хобби и ремесла</option>
                    </optgroup>
                    <optgroup label="Компьютеры и Интернет">
                        <option value="Интернет и Сети">Интернет и Сети</option>
                        <option value="Программирование">Программирование</option>
                        <option value="Компьютерная литература">Компьютерная литература</option>
                    </optgroup>
                    <optgroup label="Документальная литература">
                        <option value="Биографии и мемуары">Биографии и мемуары</option>
                        <option value="Военная документалистика">Военная документалистика</option>
                        <option value="Документальная литература">Документальная литература</option>
                        <option value="Публицистика">Публицистика</option>
                    </optgroup>
                    <optgroup label="Религия и Эзотерика">
                        <option value="Религия">Религия</option>
                        <option value="Православие">Православие</option>
                        <option value="Эзотерика">Эзотерика</option>
                        <option value="Самосовершенствование">Самосовершенствование</option>
                    </optgroup>
                    <optgroup label="Поэзия и Юмор">
                        <option value="Поэзия">Поэзия</option>
                        <option value="Классическая поэзия">Классическая поэзия</option>
                        <option value="Юмористические стихи">Юмористические стихи</option>
                        <option value="Анекдоты">Анекдоты</option>
                        <option value="Юмор">Юмор</option>
                        <option value="Юмористическая проза">Юмористическая проза</option>
                    </optgroup>
                </select>
                {!editingId && (
                    <button
                        type="button"
                        onClick={onSuggest}
                        disabled={isSuggesting}
                        className="bg-purple-600 hover:bg-purple-700 p-3 rounded flex items-center justify-center gap-2 transition-colors min-w-[50px]"
                        title="Предложить случайный контент по жанру"
                    >
                        {isSuggesting ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                        <span className="hidden sm:inline">Подобрать</span>
                    </button>
                )}
            </div>

            <textarea
                placeholder="Описание"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-3 mb-4 bg-gray-800 rounded h-32"
            />

            {contentType === 'tvshows' ? (
                <>
                    <label className="block mb-2">Эпизоды (выберите несколько):</label>
                    <input
                        type="file"
                        multiple
                        accept="video/*"
                        onChange={(e) => setEpisodeFiles(Array.from(e.target.files))}
                        className="w-full p-3 mb-4 bg-gray-800 rounded"
                    />
                    <input
                        type="number"
                        placeholder="Номер сезона"
                        value={seasonNumber}
                        onChange={(e) => setSeasonNumber(parseInt(e.target.value))}
                        className="w-full p-3 mb-4 bg-gray-800 rounded"
                    />
                </>
            ) : (
                <>
                    <label className="block mb-2 text-sm">
                        {contentType === 'movies' && '🎬 Видео файл фильма'}
                        {contentType === 'books' && '📖 Файл книги (.epub, .pdf, .djvu, .fb2, .mobi)'}
                    </label>
                    {mainFile && (
                        <div className="p-2 mb-2 bg-green-900/30 border border-green-500/50 rounded text-green-200 text-sm flex items-center gap-2">
                            <span>📎 Выбран файл: <b>{mainFile.name}</b></span>
                            <button type="button" onClick={() => setMainFile(null)} className="text-red-400 hover:text-white">✕</button>
                        </div>
                    )}
                    <input
                        type="file"
                        accept={contentType === 'movies' ? 'video/*' : '.pdf,.epub,.djvu,.fb2,.mobi'}
                        onChange={(e) => setMainFile(e.target.files[0])}
                        className="w-full p-3 mb-4 bg-gray-800 rounded"
                    />
                </>
            )}

            <label className="block mb-2 text-sm">🖼️ Обложка / Постер (изображение)</label>
            {thumbnail && (
                <div className="p-2 mb-2 bg-green-900/30 border border-green-500/50 rounded text-green-200 text-sm flex items-center gap-2">
                    <span>🖼️ Выбрана обложка: <b>{thumbnail.name}</b></span>
                    <button type="button" onClick={() => setThumbnail(null)} className="text-red-400 hover:text-white">✕</button>
                </div>
            )}
            <input
                type="file"
                accept="image/*"
                onChange={(e) => setThumbnail(e.target.files[0])}
                className="w-full p-3 mb-4 bg-gray-800 rounded"
            />

            {isUploading && (
                <div className="mb-4">
                    <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div
                            className="bg-green-600 h-full transition-all"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                    <p className="text-center mt-2">{uploadProgress}%</p>
                </div>
            )}

            <div className="flex gap-4">
                <button
                    type="submit"
                    disabled={isUploading}
                    className="flex-1 py-3 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                >
                    {isUploading ? 'Загрузка...' : (editingId ? 'Сохранить' : 'Добавить')}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-3 bg-gray-700 rounded hover:bg-gray-600"
                >
                    Отмена
                </button>
            </div>
        </form>
    );
}

function ThemeSettings({ themeColors, setThemeColors, applyPreset, updateThemeAPI }) {
    return (
        <div className="max-w-2xl">
            <div className="mb-6">
                <label className="block mb-2">Выберите готовый стиль:</label>
                <select
                    onChange={(e) => applyPreset(e.target.value)}
                    className="w-full p-3 bg-gray-800 rounded"
                >
                    <option value="">-- Выберите пресет --</option>
                    <option value="midnight">Midnight</option>
                    <option value="light">Light Mode</option>
                    <option value="ocean">Deep Ocean</option>
                    <option value="forest">Forest</option>
                    <option value="cyberpunk">Cyberpunk</option>
                    <option value="sunset">Sunset</option>
                    <option value="dracula">Dracula</option>
                    <option value="coffee">Coffee</option>
                </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(themeColors).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-4 p-4 rounded" style={{ backgroundColor: 'var(--card-bg)' }}>
                        <label className="flex-1 text-sm sm:text-base">{key}</label>
                        <input
                            type="color"
                            value={value}
                            onChange={(e) => {
                                const newColors = { ...themeColors, [key]: e.target.value };
                                setThemeColors(newColors);
                                document.documentElement.style.setProperty(key, e.target.value);
                                // Save individual change to API and localStorage
                                updateThemeAPI(newColors).catch(console.error);
                                localStorage.setItem('appTheme', JSON.stringify(newColors));

                                // Special case for body background gradient if these specific keys change
                                if (key === '--bg-primary' || key === '--bg-secondary') {
                                    const bg2 = newColors['--bg-secondary'] || newColors['--bg-primary'];
                                    document.body.style.background = `linear-gradient(135deg, ${newColors['--bg-primary']} 0%, ${bg2} 100%)`;
                                    document.body.style.backgroundAttachment = 'fixed';
                                }
                            }}
                            className="w-12 h-8 sm:w-16 sm:h-10 cursor-pointer"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
