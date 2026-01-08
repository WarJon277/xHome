import { useEffect, useState, useMemo } from 'react';
import { fetchMovies } from '../api';
import { MediaCard } from '../components/MediaCard';
import { Play } from 'lucide-react';
import Player from '../components/Player';
import GenreFilter from '../components/GenreFilter';

export default function MoviesPage() {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [selectedGenre, setSelectedGenre] = useState('Все');

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const data = await fetchMovies();
                setMovies(data);
            } catch (err) {
                console.error("Failed to load movies:", err);
                setError("Не удалось загрузить фильмы");
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

    const handlePlay = (movie) => {
        setSelectedMovie(movie);
    };

    if (loading) return <div className="p-8 text-center text-gray-400">Loading movies...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="p-4 sm:p-6 pb-24">
            {/* Player Modal */}
            {selectedMovie && (
                <Player
                    item={selectedMovie}
                    onClose={() => setSelectedMovie(null)}
                />
            )}

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

            <div className="media-grid">
                {filteredMovies.map(movie => (
                    <MediaCard
                        key={movie.id}
                        item={movie}
                        onPlay={() => handlePlay(movie)}
                        onClick={() => handlePlay(movie)}
                    />
                ))}
            </div>
        </div>
    );
}
