import { useEffect, useState } from 'react';
import { fetchMovies } from '../api';
import { MediaCard } from '../components/MediaCard';
import { Play } from 'lucide-react';
import Player from '../components/Player';

export default function MoviesPage() {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMovie, setSelectedMovie] = useState(null);

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

    const handlePlay = (movie) => {
        setSelectedMovie(movie);
    };

    if (loading) return <div className="p-8 text-center text-gray-400">Loading movies...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="p-6">
            {/* Player Modal */}
            {selectedMovie && (
                <Player
                    item={selectedMovie}
                    onClose={() => setSelectedMovie(null)}
                />
            )}

            <header className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Play className="text-red-500" /> Фильмы
                </h1>
                <div className="text-sm text-gray-400">
                    {movies.length} titles
                </div>
            </header>

            <div className="media-grid">
                {movies.map(movie => (
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
