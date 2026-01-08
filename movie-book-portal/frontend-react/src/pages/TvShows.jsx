import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTvshows } from '../api';
import { MediaCard } from '../components/MediaCard';
import '../custom-grid.css';
import { Tv } from 'lucide-react';
import GenreFilter from '../components/GenreFilter';

export default function TvShowsPage() {
    const [shows, setShows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedGenre, setSelectedGenre] = useState('Все');
    const navigate = useNavigate();

    useEffect(() => {
        loadShows();
    }, []);

    const loadShows = async () => {
        try {
            const data = await fetchTvshows();
            setShows(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const genres = useMemo(() => {
        const allGenres = new Set();
        shows.forEach(show => {
            if (show.genre) {
                show.genre.split(',').forEach(g => allGenres.add(g.trim()));
            }
        });
        return Array.from(allGenres).sort();
    }, [shows]);

    const filteredShows = useMemo(() => {
        if (selectedGenre === 'Все') return shows;
        return shows.filter(show => {
            if (!show.genre) return false;
            const itemGenres = show.genre.split(',').map(g => g.trim());
            return itemGenres.includes(selectedGenre);
        });
    }, [shows, selectedGenre]);


    return (
        <div className="p-4 sm:p-6 pb-24">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Tv className="text-purple-500" /> Сериалы
                </h1>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {filteredShows.length} shows
                </div>
            </header>

            <GenreFilter
                genres={genres}
                selectedGenre={selectedGenre}
                onSelect={setSelectedGenre}
            />

            {loading ? (
                <div className="text-center text-gray-500 mt-10">Загрузка...</div>
            ) : (
                <div className="media-grid">
                    {filteredShows.map(show => (
                        <MediaCard
                            key={show.id}
                            item={show}
                            type="tvshow"
                            onClick={() => navigate(`/tvshows/${show.id}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
