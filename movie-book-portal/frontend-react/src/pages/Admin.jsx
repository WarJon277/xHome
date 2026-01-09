import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react';
import {
    fetchMovies, fetchBooks, fetchTvshows,
    createMovie, createBook, createTvshow,
    updateMovie, updateBook, updateTvshow,
    deleteMovie, deleteBook, deleteTvshow,
    uploadMovieFile, uploadTvshowFile, uploadEpisodeFile,
    createEpisode,
    fetchTheme, updateTheme, resetTheme, fetchStats, uploadBookFile
} from '../api';
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
    isUploading, uploadProgress, editingId
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

            <select
                value={formData.genre}
                onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                className="w-full p-3 mb-4 bg-gray-800 rounded"
            >
                <option value="Общее">Общее</option>
                <option value="Боевик">Боевик</option>
                <option value="Приключения">Приключения</option>
                <option value="Комедия">Комедия</option>
                <option value="Криминал">Криминал</option>
                <option value="Драма">Драма</option>
                <option value="Фэнтези">Фэнтези</option>
                <option value="Ужасы">Ужасы</option>
                <option value="Мистика">Мистика</option>
                <option value="Мелодрама">Мелодрама</option>
                <option value="Фантастика">Фантастика</option>
                <option value="Триллер">Триллер</option>
                <option value="Документальный">Документальный</option>
            </select>

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
                    <label className="block mb-2">Файл:</label>
                    <input
                        type="file"
                        accept={contentType === 'movies' ? 'video/*' : '.pdf,.epub,.djvu'}
                        onChange={(e) => setMainFile(e.target.files[0])}
                        className="w-full p-3 mb-4 bg-gray-800 rounded"
                    />
                </>
            )}

            <label className="block mb-2">Миниатюра:</label>
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
