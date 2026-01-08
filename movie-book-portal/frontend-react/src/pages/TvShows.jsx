import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTvshows } from '../api';
import { MediaCard } from '../components/MediaCard';
import '../custom-grid.css';
import { Tv } from 'lucide-react';

export default function TvShowsPage() {
    const [shows, setShows] = useState([]);
    const [loading, setLoading] = useState(true);
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

    return (
        <div className="p-4 sm:p-6 pb-24">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Tv className="text-purple-500" /> Сериалы
                </h1>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {shows.length} shows
                </div>
            </header>

            {loading ? (
                <div className="text-center text-gray-500 mt-10">Загрузка...</div>
            ) : (
                <div className="media-grid">
                    {shows.map(show => (
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
