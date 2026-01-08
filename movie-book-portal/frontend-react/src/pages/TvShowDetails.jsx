import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTvshow, fetchEpisodes } from '../api';
import Player from '../components/Player';
import { ArrowLeft, Play, Calendar, Star } from 'lucide-react';

export default function TvShowDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [show, setShow] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [groupedEpisodes, setGroupedEpisodes] = useState({});
    const [selectedEpisode, setSelectedEpisode] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [showData, episodesData] = await Promise.all([
                    fetchTvshow(id),
                    fetchEpisodes(id)
                ]);
                setShow(showData);
                setEpisodes(episodesData);

                // Group by season
                const groups = {};
                episodesData.forEach(ep => {
                    const season = ep.season_number || 1;
                    if (!groups[season]) groups[season] = [];
                    groups[season].push(ep);
                });
                // Sort seasons and episodes
                Object.keys(groups).forEach(key => {
                    groups[key].sort((a, b) => (a.episode_number - b.episode_number));
                });
                setGroupedEpisodes(groups);

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id]);

    if (loading) return <div className="p-6 text-white">Loading...</div>;
    if (!show) return <div className="p-6 text-white">Show not found</div>;

    const getImageUrl = (path) => {
        if (!path) return null;
        path = path.replace(/\\/g, '/'); // Normalize backslashes
        if (path.startsWith('http')) return path;
        // Fix double uploads logic if needed, but assuming path is clean or simple relative
        if (path.startsWith('/uploads/')) return path;
        if (path.startsWith('uploads/')) return `/${path}`;
        return `/uploads/${path}`;
    };

    return (
        <div
            className="min-h-screen text-white p-4 sm:p-6 pb-24 relative"
            style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        >
            <button
                onClick={() => navigate('/tvshows')}
                className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 p-2 bg-black/50 rounded-full hover:bg-white/20 transition-colors"
                style={{ marginTop: 'env(safe-area-inset-top)' }}
            >
                <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
            </button>

            {/* Hero Section */}
            <div className="relative w-full h-[40vh] sm:h-[50vh] rounded-2xl overflow-hidden mb-6 sm:mb-8 shadow-2xl">
                <img
                    src={getImageUrl(show.backdrop_path || show.poster_path)}
                    className="w-full h-full object-cover"
                    alt={show.title}
                />
                <div
                    className="absolute inset-0 bg-gradient-to-t via-transparent to-transparent"
                    style={{ background: 'linear-gradient(to top, var(--bg-primary), transparent)' }}
                ></div>
                <div className="absolute bottom-0 left-0 p-4 sm:p-8 w-full max-w-4xl">
                    <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold mb-2 sm:mb-4 drop-shadow-lg">{show.title}</h1>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-base mb-2 sm:mb-4" style={{ color: 'var(--text-secondary)' }}>
                        <span className="flex items-center gap-1"><Calendar size={14} className="sm:w-4 sm:h-4" /> {show.release_date?.split('-')[0]}</span>
                        <span className="flex items-center gap-1 text-yellow-500"><Star size={14} fill="currentColor" className="sm:w-4 sm:h-4" /> {show.rating || 'N/A'}</span>
                        <span className="bg-white/10 px-2 py-0.5 rounded" style={{ color: 'var(--text-primary)' }}>{show.genre}</span>
                    </div>
                    <p className="line-clamp-2 sm:line-clamp-3 text-sm sm:text-lg opacity-90" style={{ color: 'var(--text-secondary)' }}>{show.description}</p>
                </div>
            </div>

            {/* Episodes List */}
            <div className="max-w-7xl mx-auto">
                {Object.keys(groupedEpisodes).sort((a, b) => Number(a) - Number(b)).map(season => (
                    <div key={season} className="mb-8">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-200">Season {season}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groupedEpisodes[season].map(ep => (
                                <div
                                    key={ep.id}
                                    className="rounded-lg overflow-hidden transition-colors cursor-pointer group flex focus:ring-4 focus:ring-blue-500 outline-none"
                                    style={{ backgroundColor: 'var(--card-bg)' }}
                                    onClick={() => setSelectedEpisode(ep)}
                                    tabIndex={0}
                                    role="button"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setSelectedEpisode(ep);
                                        }
                                    }}
                                >
                                    {/* Thumbnail */}
                                    <div className="w-24 sm:w-32 h-20 sm:h-24 bg-black flex-shrink-0 relative overflow-hidden">
                                        {ep.thumbnail_path ? (
                                            <img src={getImageUrl(ep.thumbnail_path)} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-600">No Img</div>
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                                            <Play size={20} fill="currentColor" className="sm:w-6 sm:h-6" />
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-2 sm:p-3 flex flex-col justify-center min-w-0">
                                        <h3 className="font-medium text-sm sm:text-base truncate" style={{ color: 'var(--text-primary)' }}>{ep.episode_number}. {ep.title}</h3>
                                        <p className="text-[10px] sm:text-sm line-clamp-1 sm:line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{ep.description || 'No description'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Player Modal */}
            {selectedEpisode && (
                <Player
                    item={selectedEpisode}
                    src={getImageUrl(selectedEpisode.file_path)}
                    poster={getImageUrl(selectedEpisode.thumbnail_path || show.poster_path)}
                    title={`${show.title} - S${selectedEpisode.season_number}E${selectedEpisode.episode_number}`}
                    onClose={() => setSelectedEpisode(null)}
                />
            )}
        </div>
    );
}
