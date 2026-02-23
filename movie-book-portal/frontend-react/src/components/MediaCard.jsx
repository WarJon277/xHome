import { useState, useEffect, useRef } from 'react';
import { Play, Download, Check, Loader2 } from 'lucide-react';
import { downloadBookForOffline, checkIfDownloaded } from '../utils/offlineUtils';
import { fetchBook } from '../api';

export function MediaCard({ item, onClick, onPlay, onContextMenu, type }) {
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const longPressTimer = useRef(null);

    // Context Menu logic: Right click or Long Press
    const handleContextMenu = (e) => {
        if (onContextMenu) {
            e.preventDefault();
            e.stopPropagation();
            onContextMenu(item, e.clientX || e.touches?.[0]?.clientX, e.clientY || e.touches?.[0]?.clientY);
        }
    };

    const handleTouchStart = (e) => {
        // Start timer for long press
        longPressTimer.current = setTimeout(() => {
            handleContextMenu(e);
        }, 700); // 700ms for long press
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    // Check if book is already downloaded (for books only)
    useEffect(() => {
        if (type === 'book') {
            checkIfDownloaded(item.id).then(setIsDownloaded);
        }
    }, [item.id, type]);

    const handleDownload = async (e) => {
        e.stopPropagation();
        if (isDownloaded || isDownloading) return;

        setIsDownloading(true);
        setDownloadProgress(0);
        try {
            // Fetch full metadata
            const metadata = await fetchBook(item.id);
            await downloadBookForOffline(item.id, metadata, (p) => {
                setDownloadProgress(p.progress);
            });
            setIsDownloaded(true);
        } catch (error) {
            console.error('Failed to download book:', error);
            alert('Ошибка при скачивании книги: ' + error.message);
        } finally {
            setIsDownloading(false);
            setDownloadProgress(0);
        }
    };

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
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
            tabIndex={0}
            data-tv-clickable="true"
            onKeyDown={(e) => {
                if (e.key === 'Enter') onClick && onClick();
            }}
            style={{
                backgroundColor: 'var(--card-bg)',
                cursor: 'pointer',
                height: '100%', // Stretch to fill grid height if needed
                maxWidth: '100%', // Prevent overflow
                overflow: 'hidden' // Hide any overflow
            }}
        >
            {/* Image Container */}
            {/* Image Container */}
            <div className="relative w-full pb-[150%] bg-gray-900 group overflow-hidden">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
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

                {/* Download Button for Books (top-right corner) */}
                {type === 'book' && (
                    <button
                        onClick={handleDownload}
                        disabled={isDownloaded || isDownloading}
                        className={`absolute top-2 right-2 p-2 rounded-full transition-all shadow-lg z-10 ${isDownloaded
                            ? 'bg-green-600 text-white cursor-default'
                            : isDownloading
                                ? 'bg-blue-600 text-white cursor-wait'
                                : 'bg-black/60 text-white hover:bg-black/80 hover:scale-110'
                            }`}
                        title={isDownloaded ? 'Скачано' : isDownloading ? 'Скачивание...' : 'Скачать для офлайн'}
                    >
                        {isDownloading ? (
                            <div className="relative flex items-center justify-center">
                                <Loader2 size={20} className="animate-spin" />
                                <span className="absolute text-[8px] font-bold">{downloadProgress}%</span>
                            </div>
                        ) : isDownloaded ? (
                            <Check size={20} />
                        ) : (
                            <Download size={20} />
                        )}
                    </button>
                )}
            </div>

            {/* Content Section */}
            <div className="p-3 flex flex-col gap-1 flex-grow">
                <h3 className="text-sm sm:text-base font-bold leading-tight line-clamp-2 h-10 sm:h-12 overflow-hidden" style={{ color: 'var(--text-primary)' }}>{title}</h3>

                {/* Info: Director / Year */}
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {item.director && (
                        <div className="mb-1 truncate">
                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Режиссёр:</span> {item.director}
                        </div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                        {item.year && <span className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">{item.year}</span>}
                        {item.total_pages && <span className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">{item.total_pages} стр.</span>}
                        {item.rating && <span className="text-yellow-500 font-bold ml-auto">★ {item.rating}</span>}
                    </div>
                </div>

                {/* Description - Hidden on small mobile to save space */}
                <p className="text-xs sm:text-sm line-clamp-2 sm:line-clamp-3 mt-1 hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
                    {truncate(item.description, 120) || "Нет описания"}
                </p>
            </div>
        </div>
    );
}
