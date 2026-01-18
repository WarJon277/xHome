import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchAudiobooks, fetchLatestProgress } from '../api';
import { MediaCard } from '../components/MediaCard';
import ResumeBanner from '../components/ResumeBanner';
import AudiobookPlayer from '../components/AudiobookPlayer';
import '../custom-grid.css';
import { Music } from 'lucide-react';
import GenreFilter from '../components/GenreFilter';

export default function AudiobooksPage() {
    const [audiobooks, setAudiobooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedGenre, setSelectedGenre] = useState('Все');
    const [selectedAudiobook, setSelectedAudiobook] = useState(null);
    const [latestAudiobook, setLatestAudiobook] = useState(null);
    const navigate = useNavigate();

    const location = useLocation();

    useEffect(() => {
        loadAudiobooks();
        loadLatestProgress();
    }, []);

    useEffect(() => {
        if (location.state?.openBookId && audiobooks.length > 0) {
            const book = audiobooks.find(b => b.id === parseInt(location.state.openBookId));
            if (book) {
                console.log("Auto-opening audiobook:", book.title);
                setSelectedAudiobook(book);
                // Optional: clear state to prevent reopening if needed, but risky
            }
        }
    }, [location.state, audiobooks]);

    const loadLatestProgress = async () => {
        try {
            const data = await fetchLatestProgress('audiobook');
            setLatestAudiobook(data);
        } catch (e) {
            console.error("Failed to fetch latest audiobook progress", e);
        }
    };

    const loadAudiobooks = async () => {
        try {
            const data = await fetchAudiobooks();
            console.log("Audiobooks data fetched:", data);
            setAudiobooks(data);
        } catch (err) {
            console.error("Failed to fetch audiobooks:", err);
        } finally {
            setLoading(false);
        }
    };

    const genres = useMemo(() => {
        const allGenres = new Set();
        audiobooks.forEach(book => {
            if (book.genre) {
                book.genre.split(',').forEach(g => allGenres.add(g.trim()));
            }
        });
        return Array.from(allGenres).sort();
    }, [audiobooks]);

    const filteredAudiobooks = useMemo(() => {
        if (selectedGenre === 'Все') return audiobooks;
        return audiobooks.filter(book => {
            if (!book.genre) return false;
            const itemGenres = book.genre.split(',').map(g => g.trim());
            return itemGenres.includes(selectedGenre);
        });
    }, [audiobooks, selectedGenre]);

    const handleSelectAudiobook = (audiobook) => {
        setSelectedAudiobook(audiobook);
    };

    const handleClosePlayer = () => {
        setSelectedAudiobook(null);
    };

    if (selectedAudiobook) {
        return <AudiobookPlayer audiobook={selectedAudiobook} onClose={handleClosePlayer} />;
    }

    return (
        <div className="p-4 sm:p-6 pb-24">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Music className="text-blue-500" /> Аудиокниги
                </h1>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {filteredAudiobooks.length} audiobooks
                </div>
            </header>

            <GenreFilter
                genres={genres}
                selectedGenre={selectedGenre}
                onSelect={setSelectedGenre}
            />

            {latestAudiobook && (
                <ResumeBanner
                    item={latestAudiobook}
                    onResume={() => {
                        const fullBook = audiobooks.find(b => b.id === latestAudiobook.item_id);
                        if (fullBook) {
                            handleSelectAudiobook(fullBook);
                        } else {
                            // Fallback if not in current local list
                            handleSelectAudiobook({
                                ...latestAudiobook,
                                id: latestAudiobook.item_id,
                                thumbnail_path: latestAudiobook.thumbnail // Align field names
                            });
                        }
                    }}
                    onClose={() => setLatestAudiobook(null)}
                />
            )}

            {loading ? (
                <div className="text-center text-gray-500 mt-10">Загрузка аудиокниг...</div>
            ) : filteredAudiobooks.length === 0 ? (
                <div className="no-items text-center text-gray-400 mt-10">
                    <p>Аудиокниг не найдено</p>
                </div>
            ) : (
                <div className="media-grid">
                    {filteredAudiobooks.map(audiobook => (
                        <MediaCard
                            key={audiobook.id}
                            item={audiobook}
                            type="audiobook"
                            onPlay={() => handleSelectAudiobook(audiobook)}
                            // Navigate to details if needed, or just play
                            onNavigate={() => handleSelectAudiobook(audiobook)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
