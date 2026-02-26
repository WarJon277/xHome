import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBooks, fetchLatestProgress, searchBooks, saveProgress, updateBook, deleteBook } from '../api';
import { MediaCard } from '../components/MediaCard';
import ResumeBanner from '../components/ResumeBanner';
import OfflineBanner from '../components/OfflineBanner';
import ContextMenu from '../components/ContextMenu';
import EditMediaModal from '../components/EditMediaModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { getCachedBooks, getLocalProgress } from '../utils/offlineStorage';
import { resetOfflineData } from '../utils/offlineUtils';
import '../custom-grid.css';
import { Book, Search, Download, Trash2, Loader2, Edit, Trash } from 'lucide-react';
import GenreFilter from '../components/GenreFilter';

// In-memory cache to persist between navigations
let cachedBooksData = null;
let cachedScrollPosition = 0;

export default function BooksPage() {
    const [books, setBooks] = useState(cachedBooksData || []);
    const [loading, setLoading] = useState(!cachedBooksData);
    const [selectedGenre, setSelectedGenre] = useState('Все');
    const [latestBook, setLatestBook] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isOffline, setIsOffline] = useState(false);
    const [showOnlyCached, setShowOnlyCached] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, item: null });
    // Edit Modal State
    const [editModal, setEditModal] = useState({ visible: false, item: null });
    // Confirmation Modal State
    const [deleteConfirm, setDeleteConfirm] = useState({ visible: false, item: null });

    const navigate = useNavigate();

    // Restore scroll position
    useEffect(() => {
        if (cachedScrollPosition > 0) {
            // Small delay to ensure content is rendered
            const timer = setTimeout(() => {
                window.scrollTo({ top: cachedScrollPosition, behavior: 'instant' });
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [books]);

    useEffect(() => {
        loadBooks();
        loadLatestProgress();
    }, []);

    const loadLatestProgress = async () => {
        try {
            // Check both Remote and Local
            const [remoteProg, localBooks] = await Promise.all([
                fetchLatestProgress('book').catch(() => null),
                getCachedBooks()
            ]);

            // For each cached book, try to get its local progress
            const localProgresses = await Promise.all(
                localBooks.map(async (b) => {
                    const lp = await getLocalProgress(b.id);
                    if (!lp) return null;
                    return {
                        ...lp,
                        item_id: b.id,
                        item_type: 'book',
                        title: b.title,
                        thumbnail: b.thumbnail_path,
                        total_pages: b.total_pages || b.totalPages,
                        // Convert Date.now() style timestamp to same format as server for comparison
                        last_updated: new Date(lp.updatedAt).toISOString()
                    };
                })
            );

            const latestLocal = localProgresses
                .filter(p => p !== null)
                .sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))[0];

            console.log('[Books] Latest Remote:', remoteProg, 'Latest Local:', latestLocal);

            let winner = remoteProg;
            if (latestLocal && (!remoteProg || new Date(latestLocal.last_updated) > new Date(remoteProg.last_updated))) {
                winner = latestLocal;
                // Normalize for display
                winner.progress = latestLocal.page;

                // Proactive Sync: Push newest local progress to server if online
                if (navigator.onLine) {
                    saveProgress('book', parseInt(latestLocal.item_id), latestLocal.page, latestLocal.scrollRatio).catch(() => { });
                }
            }

            setLatestBook(winner);
        } catch (e) {
            console.error("Failed to fetch latest book progress", e);
        }
    };

    const loadBooks = async () => {
        try {
            setLoading(true);
            setIsOffline(false);

            // Fast check for offline state
            if (!navigator.onLine) {
                console.log('[Books] Initializing in offline mode (navigator.onLine is false)');
                setIsOffline(true);
                const cachedBooks = await getCachedBooks();
                setBooks(cachedBooks);
                setShowOnlyCached(true);
                setLoading(false);
                return;
            }

            const data = await fetchBooks();
            console.log("Books data fetched:", data);
            setBooks(data);
            cachedBooksData = data;
        } catch (err) {
            console.error("Failed to fetch books, falling back to cache:", err);

            // ANY error here (Network, Timeout, or even Server Error 500)
            // should trigger offline fallback if we have cached books
            setIsOffline(true);
            const cachedBooks = await getCachedBooks();
            if (cachedBooks && cachedBooks.length > 0) {
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
        cachedScrollPosition = window.scrollY;
        navigate(`/books/${book.id}`);
    };

    const handleContextMenu = (item, x, y) => {
        setContextMenu({ visible: true, x, y, item });
    };

    const handleEditClick = () => {
        if (contextMenu.item) {
            setEditModal({ visible: true, item: contextMenu.item });
        }
    };

    const handleDeleteClick = () => {
        if (contextMenu.item) {
            setDeleteConfirm({ visible: true, item: contextMenu.item });
        }
    };

    const handleSaveEdit = async (updatedData) => {
        try {
            await updateBook(editModal.item.id, updatedData);
            setEditModal({ visible: false, item: null });
            loadBooks(); // Refresh list
        } catch (err) {
            console.error('Failed to update book:', err);
            alert('Ошибка при обновлении книги: ' + err.message);
        }
    };

    const handleDeleteConfirm = async () => {
        try {
            await deleteBook(deleteConfirm.item.id);
            setDeleteConfirm({ visible: false, item: null });
            loadBooks(); // Refresh list
        } catch (err) {
            console.error('Failed to delete book:', err);
            alert('Ошибка при удалении книги: ' + err.message);
        }
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
                                onContextMenu={handleContextMenu}
                            />
                            {book.isCached && (
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 pointer-events-none">
                                    <Download size={12} />
                                    <span>Оффлайн</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Context Menu */}
            {contextMenu.visible && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu({ ...contextMenu, visible: false })}
                    options={[
                        { label: 'Редактировать', icon: <Edit size={16} />, onClick: handleEditClick },
                        { label: 'Удалить', icon: <Trash size={16} />, onClick: handleDeleteClick, className: 'text-red-500 hover:bg-red-500 hover:text-white' },
                    ]}
                />
            )}

            {/* Edit Modal */}
            {editModal.visible && (
                <EditMediaModal
                    item={editModal.item}
                    type="book"
                    onClose={() => setEditModal({ visible: false, item: null })}
                    onSave={handleSaveEdit}
                />
            )}

            {/* Delete Confirmation */}
            {deleteConfirm.visible && (
                <ConfirmationModal
                    title="Удалить книгу?"
                    message={`Вы уверены, что хотите удалить книгу "${deleteConfirm.item.title}"? Это действие нельзя отменить.`}
                    confirmLabel="Удалить"
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setDeleteConfirm({ visible: false, item: null })}
                    isDestructive={true}
                />
            )}
        </div>
    );
}
