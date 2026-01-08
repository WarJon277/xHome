import { Play } from 'lucide-react';

export function MediaCard({ item, onClick, onPlay }) {
    // Logic ported from itemDisplay.js to fix missing thumbnails
    const getImageUrl = () => {
        // 1. If explicit pre-processed URL exists
        if (item.thumbnailStr) return item.thumbnailStr;

        // 2. Decide which field to use
        let path = item.thumbnail_path || item.poster_path;
        if (!path) return null;

        // 3. Normalize slashes
        path = path.replace(/\\/g, '/');

        // 4. Handle prefixes
        if (path.startsWith('/')) {
            return path; // Already absolute
        } else if (path.startsWith('uploads/')) {
            return `/${path}`;
        } else {
            return `/uploads/${path}`;
        }
    };

    const imageUrl = getImageUrl();
    const title = item.title || item.name || "Untitled";

    // Helper to truncate text
    const truncate = (str, n) => str && str.length > n ? str.substr(0, n - 1) + "..." : str;

    return (
        <div
            className="media-card tv-focusable flex flex-col bg-card rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] focus-within:ring-2 ring-primary focus:ring-4 focus:ring-blue-500"
            onClick={onClick}
            tabIndex={0}
            data-tv-clickable="true"
            onKeyDown={(e) => {
                if (e.key === 'Enter') onClick && onClick();
            }}
            style={{
                backgroundColor: 'var(--card-bg)',
                cursor: 'pointer',
                height: '100%' // Stretch to fill grid height if needed
            }}
        >
            {/* Image Container */}
            <div className="relative aspect-[2/3] w-full bg-gray-900 group">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                        No Image
                    </div>
                )}

                {/* Play Button Overlay (visible on hover) */}
                {onPlay && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                            className="p-3 bg-red-600 rounded-full text-white hover:bg-red-700 hover:scale-110 transition-all shadow-lg"
                            onClick={(e) => {
                                e.stopPropagation();
                                onPlay(item);
                            }}
                        >
                            <Play fill="currentColor" size={32} />
                        </button>
                    </div>
                )}
            </div>

            {/* Content Section */}
            <div className="p-4 flex flex-col gap-2 flex-grow">
                <h3 className="text-lg font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{title}</h3>

                {/* Info: Director / Year */}
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {item.director && (
                        <div className="mb-1">
                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Режиссёр:</span> {item.director}
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                        {item.year && <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300">{item.year}</span>}
                        {item.genre && <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300">{item.genre}</span>}
                        {item.rating && <span className="text-yellow-500 font-bold">★ {item.rating}</span>}
                    </div>
                </div>

                {/* Description */}
                <p className="text-sm line-clamp-3 mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {truncate(item.description, 120) || "Нет описания"}
                </p>
            </div>
        </div>
    );
}
