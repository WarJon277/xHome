import { useEffect, useState, useMemo } from 'react';
import { fetchMovies, fetchLatestProgress, fetchMovie, updateMovie, deleteMovie } from '../api';
import ResumeBanner from '../components/ResumeBanner';
import { MediaCard } from '../components/MediaCard';
import { Play, Edit, Trash } from 'lucide-react';
import Player from '../components/Player';
import GenreFilter from '../components/GenreFilter';
import ContextMenu from '../components/ContextMenu';
import EditMediaModal from '../components/EditMediaModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { SkeletonMediaGrid } from '../components/Skeleton';

// In-memory cache to persist between navigations
let cachedMoviesData = null;
let cachedScrollPosition = 0;

export default function MoviesPage() {
    const [movies, setMovies] = useState(cachedMoviesData || []);
    const [loading, setLoading] = useState(!cachedMoviesData);
    const [error, setError] = useState(null);
    const [selectedGenre, setSelectedGenre] = useState('Все');
    const [latestMovie, setLatestMovie] = useState(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, item: null });
    // Edit Modal State
    const [editModal, setEditModal] = useState({ visible: false, item: null });
    // Confirmation Modal State
    const [deleteConfirm, setDeleteConfirm] = useState({ visible: false, item: null });

    // Restore scroll position
    useEffect(() => {
        if (cachedScrollPosition > 0) {
            const timer = setTimeout(() => {
                window.scrollTo({ top: cachedScrollPosition, behavior: 'instant' });
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [movies]);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [moviesResult, latestResult] = await Promise.allSettled([
                    fetchMovies(),
                    fetchLatestProgress('movie')
                ]);

                if (moviesResult.status === 'fulfilled') {
                    setMovies(moviesResult.value);
                    cachedMoviesData = moviesResult.value;
                } else {
                    console.error("Failed to load movies:", moviesResult.reason);
                    setError("Не удалось загрузить фильмы");
                }

                if (latestResult.status === 'fulfilled') {
                    setLatestMovie(latestResult.value);
                } else {
                    console.warn("Failed to load latest progress:", latestResult.reason);
                    // Do not set error, just log warning
                }
            } catch (err) {
                console.error("Unexpected error loading data:", err);
                setError("Не удалось загрузить данные");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const genres = useMemo(() => {
        const allGenres = new Set();
        movies.forEach(movie => {
            if (movie.genre) {
                // Handle comma separated genres if any "Action, Scifi"
                movie.genre.split(',').forEach(g => allGenres.add(g.trim()));
            }
        });
        return Array.from(allGenres).sort();
    }, [movies]);

    const filteredMovies = useMemo(() => {
        if (selectedGenre === 'Все') return movies;
        return movies.filter(movie => {
            if (!movie.genre) return false;
            const movieGenres = movie.genre.split(',').map(g => g.trim());
            return movieGenres.includes(selectedGenre);
        });
    }, [movies, selectedGenre]);

    const loadMovies = async () => {
        try {
            const data = await fetchMovies();
            setMovies(data);
            cachedMoviesData = data;
        } catch (err) {
            console.error("Failed to load movies:", err);
            setError("Не удалось загрузить фильмы");
        }
    };

    const handlePlay = (movie) => {
        cachedScrollPosition = window.scrollY;
        window.dispatchEvent(new CustomEvent('app:play', { detail: movie }));
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
            await updateMovie(editModal.item.id, updatedData);
            setEditModal({ visible: false, item: null });
            loadMovies(); // Refresh list
        } catch (err) {
            console.error('Failed to update movie:', err);
            alert('Ошибка при обновлении фильма: ' + err.message);
        }
    };

    const handleDeleteConfirm = async () => {
        try {
            await deleteMovie(deleteConfirm.item.id);
            setDeleteConfirm({ visible: false, item: null });
            loadMovies(); // Refresh list
        } catch (err) {
            console.error('Failed to delete movie:', err);
            alert('Ошибка при удалении фильма: ' + err.message);
        }
    };

    if (loading) return (
        <div className="p-4 sm:p-6 pb-24">
            <header className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Play className="text-red-500" /> Фильмы
                </h1>
            </header>
            <SkeletonMediaGrid />
        </div>
    );
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="p-4 sm:p-6 pb-24">

            <header className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Play className="text-red-500" /> Фильмы
                </h1>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {filteredMovies.length} titles
                </div>
            </header>

            <GenreFilter
                genres={genres}
                selectedGenre={selectedGenre}
                onSelect={setSelectedGenre}
            />

            <ResumeBanner
                item={latestMovie}
                onClose={() => setLatestMovie(null)}
                onResume={(item) => {
                    const found = movies.find(m => m.id === item.item_id);
                    if (found) handlePlay(found);
                    else fetchMovie(item.item_id).then(handlePlay);
                }}
            />

            <div className="media-grid">
                {filteredMovies.map(movie => (
                    <MediaCard
                        key={movie.id}
                        item={movie}
                        onPlay={() => handlePlay(movie)}
                        onClick={() => handlePlay(movie)}
                        onContextMenu={handleContextMenu}
                    />
                ))}
            </div>

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
                    type="movie"
                    onClose={() => setEditModal({ visible: false, item: null })}
                    onSave={handleSaveEdit}
                />
            )}

            {/* Delete Confirmation */}
            {deleteConfirm.visible && (
                <ConfirmationModal
                    title="Удалить фильм?"
                    message={`Вы уверены, что хотите удалить фильм "${deleteConfirm.item.title}"? Это действие нельзя отменить.`}
                    confirmLabel="Удалить"
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setDeleteConfirm({ visible: false, item: null })}
                    isDestructive={true}
                />
            )}
        </div>
    );
}
