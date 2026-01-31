import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBooks, fetchLatestProgress, searchBooks } from '../api';
import { MediaCard } from '../components/MediaCard';
import ResumeBanner from '../components/ResumeBanner';
import OfflineBanner from '../components/OfflineBanner';
import { getCachedBooks } from '../utils/offlineStorage';
import { resetOfflineData } from '../utils/offlineUtils';
import '../custom-grid.css';
import { Book, Search, Download, Trash2, Loader2 } from 'lucide-react';
import GenreFilter from '../components/GenreFilter';

export default function BooksPage() {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedGenre, setSelectedGenre] = useState('Все');
    const [latestBook, setLatestBook] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isOffline, setIsOffline] = useState(false);
    const [showOnlyCached, setShowOnlyCached] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadBooks();
        loadLatestProgress();
    }, []);

    const loadLatestProgress = async () => {
        try {
            const data = await fetchLatestProgress('book');
            setLatestBook(data);
        } catch (e) {
            console.error("Failed to fetch latest book progress", e);
        }
    };

    const loadBooks = async () => {
        try {
            setLoading(true);
            setIsOffline(false);
            const data = await fetchBooks();
            console.log("Books data fetched:", data);
            setBooks(data);
        } catch (err) {
            console.error("Failed to fetch books:", err);

            // Check if it's a network error or timeout
            if (err.isNetworkError || err.isTimeout) {
                console.log('[Books] Network error detected, switching to offline mode');
                setIsOffline(true);

                // Load cached books
                const cachedBooks = await getCachedBooks();
                setBooks(cachedBooks);
                setShowOnlyCached(true);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Don't search in offline mode
        if (isOffline) return;

        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.trim()) {
                try {
                    setLoading(true);
                    const results = await searchBooks(searchQuery);
                    setBooks(results);
                } catch (err) {
                    console.error("Search failed:", err);

                    // If search fails due to network, switch to offline
                    if (err.isNetworkError || err.isTimeout) {
                        setIsOffline(true);
                        const cachedBooks = await getCachedBooks();
                        setBooks(cachedBooks);
                        setShowOnlyCached(true);
                    }
                } finally {
                    setLoading(false);
                }
            } else {
                // Query is empty, reload full list
                loadBooks();
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const genres = useMemo(() => {
        const allGenres = new Set();
        books.forEach(book => {
            if (book.genre) {
                book.genre.split(',').forEach(g => allGenres.add(g.trim()));
            }
        });
        return Array.from(allGenres).sort();
    }, [books]);

    const filteredBooks = useMemo(() => {
        if (selectedGenre === 'Все') return books;
        return books.filter(book => {
            if (!book.genre) return false;
            const itemGenres = book.genre.split(',').map(g => g.trim());
            return itemGenres.includes(selectedGenre);
        });
    }, [books, selectedGenre]);


    const handleOpenBook = (book) => {
        navigate(`/books/${book.id}`);
    };

    const handleResetCache = async () => {
        if (!window.confirm('Вы уверены, что хотите полностью очистить кэш всех книг? Все загруженные данные будут удалены.')) {
            return;
        }

        try {
            setIsResetting(true);
            await resetOfflineData();
            alert('Кэш успешно очищен!');
            window.location.reload();
        } catch (err) {
            console.error('Reset failed:', err);
            alert('Ошибка при очистке кэша: ' + err.message);
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="p-2 sm:p-4 md:p-6 pb-24">{/* Reduced mobile padding from p-4 to p-2 */}
            <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Book className="text-green-500" /> Книги
                </h1>

                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                    <input
                        type="text"
                        placeholder="Поиск книг..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-green-500 transition-colors"
                        style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={handleResetCache}
                        disabled={isResetting}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all text-xs border border-red-500/20 disabled:opacity-50"
                        title="Очистить весь кэш книг"
                    >
                        {isResetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        <span>Очистить кэш</span>
                    </button>

                    <div className="text-xs sm:text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                        {filteredBooks.length} книг
                    </div>
                </div>
            </header>

            {/* Offline Banner */}
            {isOffline && (
                <OfflineBanner
                    cachedBooksCount={books.length}
                    onViewCached={() => setShowOnlyCached(true)}
                />
            )}

            <GenreFilter
                genres={genres}
                selectedGenre={selectedGenre}
                onSelect={setSelectedGenre}
            />

            <ResumeBanner
                item={latestBook}
                onClose={() => setLatestBook(null)}
                onResume={(item) => navigate(`/books/${item.item_id}`)}
            />



            {loading ? (
                <div className="text-center text-gray-500 mt-10">Загрузка...</div>
            ) : (
                <div className="media-grid">
                    {filteredBooks.map(book => (
                        <div key={book.id} className="relative">
                            <MediaCard
                                item={book}
                                type="book"
                                onClick={() => handleOpenBook(book)}
                            />
                            {book.isCached && (
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
                                    <Download size={12} />
                                    <span>Оффлайн</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
