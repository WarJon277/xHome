import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Wand2, Search, Loader2, RefreshCw, Music, Activity } from 'lucide-react';
import {
    fetchMovies, fetchBooks, fetchTvshows, fetchAudiobooks,
    createMovie, createBook, createTvshow, createAudiobook,
    updateMovie, updateBook, updateTvshow, updateAudiobook,
    deleteMovie, deleteBook, deleteTvshow, deleteAudiobook,
    uploadMovieFile, uploadTvshowFile, uploadEpisodeFile, uploadAudiobookFile, uploadAudiobookThumbnail,
    createEpisode,
    fetchTheme, updateTheme, resetTheme, fetchStats, uploadBookFile,
    fetchSuggestion, fetchBrowse, fetchDetails, fetchSearch, searchAudioboo, fetchAudiobooDetails, downloadFromAudioboo
} from '../api';
import { X, Download, BookOpen } from 'lucide-react';
import KaleidoscopeManager from '../components/KaleidoscopeManager';

// Genre Options Structure
const GENRE_OPTIONS = {
    "Фантастика": [
        "Альтернативная история", "Боевая фантастика", "Бояръ-аниме",
        "Героическая фантастика", "Городское фэнтези", "Киберпанк",
        "Космическая фантастика", "ЛитРПГ", "Мистика", "Научная фантастика",
        "Попаданцы", "Постапокалипсис", "Социальная фантастика", "Стимпанк",
        "Тёмное фэнтези", "Ужасы", "Фэнтези", "Эпическая фантастика",
        "Юмористическая фантастика"
    ],
    "Детективы и Триллеры": [
        "Артефакт-детективы", "Боевик", "Дамский детективный роман",
        "Детективы", "Иронический детектив", "Исторический детектив",
        "Классический детектив", "Криминальный детектив", "Крутой детектив",
        "Политический детектив", "Полицейский детектив", "Про маньяков",
        "Советский детектив", "Триллер", "Шпионский детектив"
    ],
    "Детская литература": [
        "Детская литература: прочее", "Детская образовательная литература",
        "Зарубежная литература для детей", "Классическая детская литература",
        "Народные сказки", "Сказки зарубежных писателей",
        "Сказки отечественных писателей", "Детская проза: приключения",
        "Детская фантастика", "Стихи для детей и подростков"
    ],
    "Любовные романы": [
        "Исторические любовные романы", "Короткие любовные романы",
        "Любовное фэнтези", "Остросюжетные любовные романы",
        "Современные любовные романы", "Эротика"
    ],
    "Проза": [
        "Историческая проза", "Классическая проза", "Проза о войне",
        "Современная проза", "Русская классика", "Советская классика"
    ],
    "Приключения": [
        "Вестерн", "Исторические приключения", "Морские приключения",
        "Приключения", "Природа и животные", "Путешествия и география"
    ],
    "Искусство и Культура": [
        "Искусство и Дизайн", "Кино", "Музыка", "Культурология"
    ],
    "Деловая литература": [
        "Деловая литература", "Карьера, кадры", "Маркетинг, PR",
        "Финансы", "Экономика"
    ],
    "Наука и Образование": [
        "История", "Психология", "Философия", "Математика",
        "Физика", "Литературоведение", "Языкознание", "Политика"
    ],
    "Дом и семья": [
        "Боевые искусства, спорт", "Домашние животные", "Здоровье",
        "Кулинария", "Педагогика, воспитание", "Популярная психология",
        "Семейные отношения, секс", "Хобби и ремесла"
    ],
    "Компьютеры и Интернет": [
        "Интернет и Сети", "Программирование", "Компьютерная литература"
    ],
    "Документальная литература": [
        "Биографии и мемуары", "Военная документалистика",
        "Документальная литература", "Публицистика"
    ],
    "Религия и Эзотерика": [
        "Религия", "Православие", "Эзотерика", "Самосовершенствование"
    ],
    "Поэзия и Юмор": [
        "Поэзия", "Классическая поэзия", "Юмористические стихи",
        "Анекдоты", "Юмор", "Юмористическая проза"
    ]
};

const PROVIDERS_LIST = [
    { id: 'flibusta', name: 'Flibusta (.is)' },
    { id: 'coollib', name: 'CoolLib (.net)' },
    { id: 'royallib', name: 'RoyalLib.com' }
];

const AUDIOBOOK_PROVIDERS_LIST = [
    { id: 'audioboo', name: 'Audioboo.org' }
];

const AUDIOBOOK_GENRES = [
    "Альтернативная история", "Античность", "Аудиоспектакль", "Бизнес", "Биография",
    "Боевик", "Война", "Вселенная метро 2033", "Детектив", "Детская литература",
    "Драма", "Интервью", "История", "Классика", "Лекция", "ЛФФР", "Мемуары",
    "Медицина", "Мистика", "Новелла", "Повесть", "Попаданцы", "Познавательная литература",
    "Постапокалипсис", "Поэзия", "Притча", "Приключения", "Проза", "Психология",
    "Публицистика", "Ранобэ", "Религия", "Роман", "Сказка", "Стихи", "Триллер",
    "Трэш", "Трєш", "Ужасы", "Учебник", "Фантастика", "Философия", "Фэнтези", "Хоррор",
    "Эзотерика", "Эротика", "Этногенез", "Юмор", "LitRPG", "Warhammer 40000", "S.T.A.L.K.E.R."
];

export default function AdminPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState({ movies: 0, books: 0, tvshows: 0, photos: 0 });

    // Content Management State
    const [contentType, setContentType] = useState('movies'); // movies, books, audiobooks
    const [browseProvider, setBrowseProvider] = useState('flibusta');

    // Switch provider when content type changes
    useEffect(() => {
        if (contentType === 'audiobooks') {
            setBrowseProvider('audioboo');
        } else if (contentType === 'books') {
            setBrowseProvider('flibusta');
        }
    }, [contentType]);
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
        narrator: '',
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
    const browseAbortController = useRef(null);
    const filesFetchAbortController = useRef(null); // Track file fetch abort for when modal closes
    const modalOpenRef = useRef(false); // Track modal state for async operations
    const isSelectingBookRef = useRef(false); // Flag to indicate if modal is being closed due to book selection
    const searchAbortController = useRef(null);
    const prefetchAbortController = useRef(null);

    // Sync ref
    useEffect(() => {
        modalOpenRef.current = showBrowseModal;
    }, [showBrowseModal]);
    const [browseItems, setBrowseItems] = useState([]);
    const [isLoadingBrowse, setIsLoadingBrowse] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [pendingDownload, setPendingDownload] = useState(null);
    const searchTimeoutRef = useRef(null);

    // ... (rest of methods)

    const handleBrowse = async (isRefresh = false) => {
        console.log("handleBrowse called", { isRefresh, genre: formData.genre, provider: browseProvider });

        if (!formData.genre || formData.genre.toLowerCase() === 'общее') {
            alert('Пожалуйста, выберите конкретный жанр');
            return;
        }

        // Clean up previous request if any
        if (browseAbortController.current) {
            browseAbortController.current.abort();
        }

        // Create new AbortController
        browseAbortController.current = new AbortController();
        const signal = browseAbortController.current.signal;

        if (!isRefresh) {
            setShowBrowseModal(true);
        }

        setIsLoadingBrowse(true);
        setBrowseItems([]);

        try {
            let activeGenreName = formData.genre;

            // Validation/Fallback logic
            if (contentType === 'audiobooks') {
                if (!AUDIOBOOK_GENRES.includes(activeGenreName) && !GENRE_OPTIONS["Фантастика"].includes(activeGenreName)) {
                    // If current likely not valid, default to first
                    // But we trust formData.genre if it was selected from dropdown
                }
            } else {
                if (!Object.values(GENRE_OPTIONS).flat().includes(activeGenreName)) {
                    activeGenreName = 'Научная фантастика';
                }
            }

            console.log("Fetching browse items...", { genre: activeGenreName, provider: browseProvider, contentType });

            const targetType = contentType === 'audiobooks' ? 'audiobooks' : 'books';

            const items = await fetchBrowse(targetType, activeGenreName, browseProvider, { signal, refresh: isRefresh });
            console.log("Items fetched:", items);

            if (!modalOpenRef.current) return;

            if (Array.isArray(items)) {
                setBrowseItems(items.map(i => ({ ...i, coverLoaded: false })));
            } else {
                setBrowseItems([]);
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                console.log("Browse request aborted");
                return;
            }
            console.error("Browse failed:", e);
            alert(`Не удалось загрузить список: ${e.message}`);
            if (!isRefresh) setShowBrowseModal(false);
        } finally {
            setIsLoadingBrowse(false);
        }
    };


    useEffect(() => {
        const query = searchQuery.trim();
        console.log("Search effect triggered:", { query, modalOpen: showBrowseModal, browseProvider, contentType });

        if (!query || !showBrowseModal) {
            setIsSearching(false);
            return;
        }

        console.log("Starting search with query:", query);

        // Debounce search
        const timeoutId = setTimeout(async () => {
            if (searchAbortController.current) {
                searchAbortController.current.abort();
            }

            searchAbortController.current = new AbortController();
            const signal = searchAbortController.current.signal;

            try {
                setIsSearching(true);
                console.log("Making search request to API:", { query, browseProvider, contentType });

                let results;
                if (contentType === 'audiobooks' && browseProvider === 'audioboo') {
                    // Use special search for audioboo
                    results = await searchAudioboo(query, { signal });
                } else {
                    // Use regular book search
                    results = await fetchSearch(query, browseProvider, { signal });
                }
                console.log("Search API response:", results);

                if (!signal.aborted) {
                    if (Array.isArray(results) && results.length > 0) {
                        console.log("Setting browse items with results:", results);
                        setBrowseItems(results.map(i => ({ ...i, coverLoaded: false })));
                    } else {
                        console.log("Empty or invalid results");
                        setBrowseItems([]);
                    }
                } else {
                    console.log("Search was aborted");
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.error("Search failed with error:", e);
                }
            } finally {
                setIsSearching(false);
            }
        }, 300); // Reduced debounce time for faster feedback

        return () => clearTimeout(timeoutId);
    }, [searchQuery, browseProvider, showBrowseModal, contentType]);
    useEffect(() => {
        let mounted = true;
        const timeouts = [];

        if (prefetchAbortController.current) {
            prefetchAbortController.current.abort();
        }

        if (browseItems.length > 0 && showBrowseModal) {
            prefetchAbortController.current = new AbortController();
            const signal = prefetchAbortController.current.signal;

            // Check for items needing covers/details
            browseItems.forEach((item, index) => {
                // If we don't have the cover/description loaded yet
                if (!item.coverLoaded) {
                    // Stagger requests to avoid flooding the backend
                    const tid = setTimeout(async () => {
                        if (!mounted || signal.aborted) return;
                        try {
                            const data = await fetchDetails(item.id, browseProvider, { signal });
                            if (mounted && data && !signal.aborted) {
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
    }, [browseItems, showBrowseModal, browseProvider]);

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
                case 'audiobooks':
                    data = await fetchAudiobooks();
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
            // Check for pending download first
            if (contentType === 'audiobooks' && pendingDownload) {
                const downloadPayload = {
                    ...pendingDownload,
                    title: formData.title,
                    author: formData.author,
                    description: formData.description,
                    genre: formData.genre,
                    year: formData.year ? String(formData.year) : null,
                    narrator: formData.narrator
                };

                await downloadFromAudioboo(downloadPayload);
                alert(`Загрузка аудиокниги "${formData.title}" началась!\nОна появится в библиотеке после скачивания.`);
                resetForm();
                loadContent();
                return;
            }
            const data = {
                title: formData.title,
                year: formData.year ? parseInt(formData.year) : null,
                director: formData.director,
                author: formData.author,
                rating: formData.rating ? parseFloat(formData.rating) : 0,
                description: formData.description,
                genre: formData.genre
            };

            // Add narrator for audiobooks
            if (contentType === 'audiobooks') {
                data.narrator = formData.narrator;
            }

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
                    case 'audiobooks':
                        await updateAudiobook(editingId, data);
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
                    case 'audiobooks':
                        created = await createAudiobook(data);
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
                } else if (contentType === 'audiobooks') {
                    await uploadAudiobookFile(itemId, mainFile, (pct) => setUploadProgress(pct));
                }
            }

            // Upload Thumbnail
            if (thumbnail) {
                const formData = new FormData();
                formData.append('file', thumbnail);

                let endpoint;
                if (contentType === 'movies') {
                    endpoint = 'movies';
                } else if (contentType === 'books') {
                    endpoint = 'books';
                } else if (contentType === 'tvshows') {
                    endpoint = 'tvshows';
                } else if (contentType === 'audiobooks') {
                    endpoint = 'audiobooks';
                }

                if (endpoint) {
                    const response = await fetch(`/api/${endpoint}/${itemId}/upload_thumbnail`, {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        console.error('Thumbnail upload failed');
                    }
                }
            }

            alert(editingId ? 'Успешно обновлено!' : 'Успешно добавлено!');
            resetForm();
            loadContent();
            loadStats();
        } catch (e) {
            console.error('Submit error:', e);
            alert('Ошибка при сохранении: ' + e.message);
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
            narrator: item.narrator || '',
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
                case 'audiobooks':
                    await deleteAudiobook(id);
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
            narrator: '',
            rating: '',
            description: '',
            genre: 'Общее'
        });
        setMainFile(null);
        setThumbnail(null);
        setEpisodeFiles([]);
        setEditingId(null);
        setShowForm(false);
        setPendingDownload(null);
    };



    // Re-fetch when provider changes if modal is open
    // Removed showBrowseModal from dependency to avoid double-fetch on opening
    useEffect(() => {
        if (showBrowseModal) {
            handleBrowse(true);
        }
    }, [browseProvider]);

    // Cleanup on unmount or modal close
    useEffect(() => {
        if (!showBrowseModal) {
            // Clear search when modal closes
            setSearchQuery('');
            if (browseAbortController.current) {
                browseAbortController.current.abort();
            }
            if (prefetchAbortController.current) {
                prefetchAbortController.current.abort();
            }
            if (searchAbortController.current) {
                searchAbortController.current.abort();
            }
            // Only abort file fetches if modal was closed NOT due to book selection
            // If selecting a book, isSelectingBookRef will be true and we continue loading
            if (filesFetchAbortController.current && !isSelectingBookRef.current) {
                filesFetchAbortController.current.abort();
            }
            // Reset the flag after handling
            isSelectingBookRef.current = false;
        }
    }, [showBrowseModal]);

    const handleSelectSuggestion = async (item) => {
        // item has { id, title, author, source_url }
        // Mark that we're selecting so cleanup effect doesn't abort
        isSelectingBookRef.current = true;
        setShowBrowseModal(false);
        setIsSuggesting(true);

        // Create new abort controller for file fetches
        filesFetchAbortController.current = new AbortController();
        const signal = filesFetchAbortController.current.signal;

        try {
            let data;

            // Handle different sources
            if (contentType === 'audiobooks' && browseProvider === 'audioboo') {
                // For audioboo, fetch details
                data = await fetchAudiobooDetails(item.link);
                console.log("Audioboo details:", data);

                // Set pending download (DO NOT DOWNLOAD YET)
                setPendingDownload({
                    title: data.title || item.title,
                    author: data.author || item.author,
                    description: data.description,
                    genre: data.genre || 'Общее',
                    year: data.year ? String(data.year) : null,
                    narrator: data.narrator,
                    image_url: data.image || item.image,
                    download_url: data.download_link,
                    source_url: item.link
                });

                // Fill Form
                setFormData({
                    ...formData,
                    title: data.title || item.title,
                    author: data.author || item.author,
                    description: data.description || '',
                    year: data.year ? String(data.year) : '',
                    genre: data.genre || 'Общее',
                    narrator: data.narrator || '',
                    rating: data.rating ? String(data.rating) : ''
                });

                // Fetch Thumbnail to show preview (Inline fetch)
                if (data.image || item.image) {
                    try {
                        const imgUrl = (data.image || item.image);
                        // Use proxy to avoid CORS
                        const res = await fetch(`/api/discovery/proxy?url=${encodeURIComponent(imgUrl)}`, { signal });
                        if (res.ok) {
                            const blob = await res.blob();
                            const file = new File([blob], `cover_${data.title || 'audiobook'}.jpg`, { type: blob.type });
                            setThumbnail(file);
                        }
                    } catch (e) { console.warn("Failed to fetch thumbnail preview", e); }
                }

                // Set Dummy File to pass validation and show visual indicator
                setMainFile({ name: "▶️ Загрузка с сервера Audioboo (будет выполнена при добавлении)", size: 0, type: "audio/server-download" });

                setIsSuggesting(false);
                setShowForm(true); // Ensure form is visible
                return;
            }

            // ... (rest of the function for other types)
            else {
                // Original logic for books
                data = await fetchDetails(item.id, browseProvider);

                setFormData({
                    ...formData,
                    title: data.title,
                    year: data.year || '',
                    director: data.type === 'movie' ? (data.author_director || '') : '',
                    author: data.type === 'book' ? (data.author_director || '') : '',
                    description: data.description || '',
                    rating: data.rating || '',
                });
            }

            // Check if modal was closed - if so, abort
            if (signal.aborted) {
                console.log("Modal closed, aborting file fetch");
                return;
            }

            // Helper to fetch file via proxy and create File object
            const fetchFileViaProxy = async (url, defaultName) => {
                if (!url) return null;
                try {
                    // Pass signal to abort request when modal is closed
                    const res = await fetch(`/api/discovery/proxy?url=${encodeURIComponent(url)}`, { signal });
                    if (!res.ok) throw new Error('Proxy fetch failed');
                    const blob = await res.blob();

                    // Validate content type
                    if (blob.type.includes('text/html') || blob.type.includes('application/json')) {
                        throw new Error('Ссылка ведет на веб-страницу или заблокирована (не файл)');
                    }

                    // Try to get filename from content-disposition if possible, or use default
                    const contentDisp = res.headers.get('Content-Disposition');
                    let filename = defaultName;
                    if (contentDisp) {
                        // Try filename*=UTF-8''... first
                        const utfMatch = contentDisp.match(/filename\*=UTF-8''([^;]+)/i);
                        if (utfMatch) {
                            filename = decodeURIComponent(utfMatch[1]);
                        } else {
                            // Fallback to filename="..."
                            const nameMatch = contentDisp.match(/filename="?([^";]+)"?/i);
                            if (nameMatch) {
                                filename = nameMatch[1];
                            }
                        }
                    }
                    if (!filename.includes('.')) {
                        // guess extension based on blob type
                        if (blob.type.includes('audio')) filename += '.mp3';
                        else if (blob.type.includes('epub')) filename += '.epub';
                        else if (blob.type.includes('fb2')) filename += '.fb2';
                        else if (blob.type.includes('image')) filename += '.jpg';
                    }
                    return new File([blob], filename, { type: blob.type });
                } catch (e) {
                    if (e.name === 'AbortError') {
                        console.log("File fetch aborted (modal closed)");
                        return null;
                    }
                    console.error("Failed to fetch file via proxy:", url, e);
                    return null;
                }
            };

            // 3. Fetch Thumbnail
            let thumbFile = null;
            if (data.image || (contentType === 'audiobooks' && item.image)) {
                const imageUrl = data.image || item.image;
                thumbFile = await fetchFileViaProxy(imageUrl, `cover_${data.title}.jpg`);
            }

            // 4. Fetch Audio/Book File
            let mainFileToSet = null;
            if (contentType === 'audiobooks' && (data.download_link || item.link)) {
                // For audiobook, try to get download link
                mainFileToSet = await fetchFileViaProxy(data.download_link || item.link, `${data.title}.mp3`);
            } else if (data.type === 'book' && data.download_url) {
                mainFileToSet = await fetchFileViaProxy(data.download_url, `${data.title}.epub`);
            }

            // Check if files were successfully attached
            if (contentType === 'audiobooks') {
                if (!mainFileToSet && !thumbFile) {
                    // For audiobooks, we might not have direct download link
                    alert('⚠️ Не удалось загрузить аудиофайл и обложку автоматически.\n\nВы можете добавить их вручную позже.');
                }
            } else if (contentType === 'books') {
                // For books, we need at least the book file
                if (!mainFileToSet && !thumbFile) {
                    // Show dialog to retry or continue
                    const retryChoice = confirm(
                        'Не удалось загрузить файлы книги или обложки.\n\n' +
                        'Нажмите ОК, чтобы повторить попытку загрузки файлов,\n' +
                        'или Отмена, чтобы продолжить без файлов.'
                    );

                    if (retryChoice) {
                        // Retry fetching files
                        if (!thumbFile && data.image) {
                            thumbFile = await fetchFileViaProxy(data.image, `cover_${data.title}.jpg`);
                        }
                        if (!mainFileToSet && data.download_url) {
                            mainFileToSet = await fetchFileViaProxy(data.download_url, `${data.title}.epub`);
                        }
                    }
                }

                // Check again after retry
                if (!mainFileToSet && !thumbFile) {
                    alert('⚠️ Предупреждение: Не удалось загрузить ни файл книги, ни обложку.\n\nВы можете добавить их вручную позже.');
                }
            }

            // Set files even if one or both are null
            if (thumbFile) setThumbnail(thumbFile);
            if (mainFileToSet) setMainFile(mainFileToSet);

            // Show success message with info about attached files
            const filesInfo = [];
            if (mainFileToSet) filesInfo.push(contentType === 'audiobooks' ? '🎧 аудиофайл' : '📖 файл книги');
            if (thumbFile) filesInfo.push('🖼️ обложка');

            const itemType = contentType === 'audiobooks' ? 'Аудиокнига' : 'Книга';
            const message = filesInfo.length > 0
                ? `${itemType} "${data.title}" загружена!\nПрикреплены: ${filesInfo.join(', ')}`
                : `${itemType} "${data.title}" загружена!\n⚠️ Файлы прикреплены не были, добавьте их вручную.`;

            alert(message);

        } catch (err) {
            if (err.name === 'AbortError') {
                console.log("Operation cancelled");
                return;
            }
            console.error("Details fetch failed:", err);
            alert("Не удалось загрузить детали элемента: " + err.message);
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

                    {/* Server Status Link Card */}
                    <div
                        onClick={() => navigate('/server-status')}
                        className="p-6 rounded-lg text-center cursor-pointer hover:scale-105 transition-transform border border-primary/20 hover:border-primary/50 group flex flex-col items-center justify-center gap-3 shadow-lg"
                        style={{ backgroundColor: 'var(--card-bg)' }}
                    >
                        <Activity size={32} className="text-primary group-hover:animate-pulse" />
                        <div>
                            <h3 className="text-gray-400 text-sm mb-1 uppercase tracking-wider">Система</h3>
                            <div className="text-xl font-bold text-primary">Состояние сервера</div>
                        </div>
                    </div>
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
                                    <button
                                        onClick={() => setContentType('audiobooks')}
                                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded text-sm sm:text-base ${contentType === 'audiobooks' ? 'bg-primary' : 'bg-gray-700'
                                            }`}
                                    >
                                        Аудиокниги
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
                            onSuggest={() => handleBrowse(false)}
                            isSuggesting={isSuggesting}
                            browseProvider={browseProvider}
                            setBrowseProvider={setBrowseProvider}
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
                            <h3 className="text-xl font-bold">Выберите {contentType === 'audiobooks' ? 'аудиокнигу' : 'книгу'} ({formData.genre})</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleBrowse(true)}
                                    className="p-2 hover:bg-white/10 rounded-full text-primary"
                                    title="Обновить список"
                                    disabled={isLoadingBrowse}
                                >
                                    <RefreshCw size={24} className={isLoadingBrowse ? "animate-spin" : ""} />
                                </button>

                                <select
                                    value={browseProvider}
                                    onChange={(e) => setBrowseProvider(e.target.value)}
                                    className="bg-gray-800 text-white px-3 py-1.5 rounded border border-gray-600 focus:border-primary outline-none text-sm transition-colors"
                                >
                                    {(contentType === 'audiobooks' ? AUDIOBOOK_PROVIDERS_LIST : PROVIDERS_LIST).map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>

                                <button onClick={() => setShowBrowseModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                            <input
                                type="text"
                                placeholder="🔍 Поиск по названию или автору..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full p-3 bg-gray-800 rounded border border-gray-600 focus:border-primary outline-none text-white transition-colors"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {isLoadingBrowse || isSearching ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Loader2 className="animate-spin mb-4 text-primary" size={48} />
                                    <p className="text-gray-400">
                                        {searchQuery ? `Поиск ${contentType === 'audiobooks' ? 'аудиокниг' : 'книг'}...` :
                                            `Ищем ${contentType === 'audiobooks' ? 'аудиокниги' : 'книги'} на ${(contentType === 'audiobooks' ? AUDIOBOOK_PROVIDERS_LIST : PROVIDERS_LIST).find(p => p.id === browseProvider)?.name || 'источнике'
                                            }...`}
                                    </p>
                                </div>
                            ) : searchQuery.trim() && browseItems.length === 0 ? (
                                <div className="text-center py-20 text-gray-400">
                                    <p>По запросу "{searchQuery}" книги не найдены</p>
                                    <p className="text-sm mt-2">Попробуйте изменить поисковый запрос</p>
                                </div>
                            ) : !searchQuery.trim() && browseItems.length === 0 ? (
                                <div className="text-center py-20 text-gray-400">
                                    <p>Используйте поле поиска выше для поиска книг</p>
                                    <p className="text-sm mt-2">Можно искать по названию или автору</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {browseItems.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleSelectSuggestion(item)}
                                            className="group flex flex-col cursor-pointer bg-gray-800/40 rounded-xl overflow-hidden border border-gray-700 hover:border-primary transition-all hover:translate-y-[-4px] shadow-xl backdrop-blur-md"
                                        >
                                            <div className="p-5 flex flex-col h-full">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="text-xs font-bold text-primary uppercase tracking-wider">{item.author}</div>
                                                    <div className="text-gray-500"><BookOpen size={18} /></div>
                                                </div>

                                                <h4 className="font-bold text-lg text-white mb-3 line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                                                    {item.title}
                                                </h4>

                                                <div className="flex-1">
                                                    {item.description ? (
                                                        <p className="text-sm leading-relaxed text-gray-400 line-clamp-[6] italic">
                                                            {item.description}
                                                        </p>
                                                    ) : (
                                                        <div className="h-24 flex items-center justify-center border border-dashed border-gray-700 rounded-lg text-gray-600 text-xs italic">
                                                            Аннотация будет загружена при выборе
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-5 pt-4 border-t border-gray-700/50 flex items-center justify-between">
                                                    <span className="text-[10px] text-gray-500 font-mono opacity-50">ID: {item.id.toString().substring(0, 15)}</span>
                                                    <div className="bg-primary/20 text-primary px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 group-hover:bg-primary group-hover:text-white transition-all">
                                                        <Plus size={14} /> Выбрать книгу
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
    onSuggest, isSuggesting,
    browseProvider, setBrowseProvider
}) {
    return (
        <form onSubmit={onSubmit} className="p-4 sm:p-6 rounded-lg max-w-2xl" style={{ backgroundColor: 'var(--card-bg)' }}>
            <h2 className="text-2xl mb-6">
                {editingId ? 'Редактирование' : 'Добавить: '}
                <span className="text-primary font-bold ml-2">
                    {contentType === 'audiobooks' ? 'Аудиокнига' :
                        contentType === 'books' ? 'Книга' :
                            contentType === 'movies' ? 'Фильм' : 'Сериал'}
                </span>
            </h2>

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
                placeholder={contentType === 'books' || contentType === 'audiobooks' ? 'Автор' : 'Режиссёр'}
                value={contentType === 'books' || contentType === 'audiobooks' ? formData.author : formData.director}
                onChange={(e) => setFormData({
                    ...formData,
                    [contentType === 'books' || contentType === 'audiobooks' ? 'author' : 'director']: e.target.value
                })}
                className="w-full p-3 mb-4 bg-gray-800 rounded"
            />

            {contentType === 'audiobooks' && (
                <input
                    type="text"
                    placeholder="Чтец (диктор)"
                    value={formData.narrator || ''}
                    onChange={(e) => setFormData({
                        ...formData,
                        narrator: e.target.value
                    })}
                    className="w-full p-3 mb-4 bg-gray-800 rounded"
                />
            )}

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
                    {contentType === 'audiobooks' ? (
                        <optgroup label="Аудиокниги (Audioboo)">
                            {AUDIOBOOK_GENRES.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </optgroup>
                    ) : (
                        Object.entries(GENRE_OPTIONS).map(([label, options]) => (
                            <optgroup key={label} label={label}>
                                {options.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </optgroup>
                        ))
                    )}
                </select>

                {contentType === 'books' && !editingId && (
                    <select
                        value={browseProvider}
                        onChange={(e) => setBrowseProvider(e.target.value)}
                        className="p-3 bg-purple-900/30 border border-purple-500/30 rounded text-purple-100 outline-none focus:border-purple-500 transition-colors"
                        title="Выберите источник для поиска"
                    >
                        {PROVIDERS_LIST.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                )}

                {contentType === 'audiobooks' && !editingId && (
                    <select
                        value={browseProvider}
                        onChange={(e) => setBrowseProvider(e.target.value)}
                        className="p-3 bg-purple-900/30 border border-purple-500/30 rounded text-purple-100 outline-none focus:border-purple-500 transition-colors"
                        title="Выберите источник для поиска аудиокниг"
                    >
                        {AUDIOBOOK_PROVIDERS_LIST.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                )}

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
                        {contentType === 'audiobooks' && '🎧 Аудиофайл (.mp3, .m4b, .flac, .wav)'}
                    </label>
                    {mainFile && (
                        <div className="p-2 mb-2 bg-green-900/30 border border-green-500/50 rounded text-green-200 text-sm flex items-center gap-2">
                            <span>📎 Выбран файл: <b>{mainFile.name}</b></span>
                            <button type="button" onClick={() => setMainFile(null)} className="text-red-400 hover:text-white">✕</button>
                        </div>
                    )}
                    <input
                        type="file"
                        accept={contentType === 'movies' ? 'video/*' : contentType === 'audiobooks' ? 'audio/*' : '.pdf,.epub,.djvu,.fb2,.mobi'}
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
