import { X, ChevronLeft, ChevronRight, Trash2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function PhotoModal({ item, onClose, onNext, onPrev, onDelete }) {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Prevent background TV navigation
        document.body.classList.add('modal-open');

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 10009 || e.keyCode === 461) {
                e.preventDefault();
                onClose();
            }
            if (e.key === 'ArrowLeft' && onPrev) {
                e.preventDefault();
                setIsLoading(true);
                onPrev();
            }
            if (e.key === 'ArrowRight' && onNext) {
                e.preventDefault();
                setIsLoading(true);
                onNext();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            document.body.classList.remove('modal-open');
        };
    }, [onClose, onNext, onPrev]);

    // Reset loading when item changes
    useEffect(() => {
        setIsLoading(true);
    }, [item?.id, item?.file_path]);

    const getImageUrl = (path) => {
        if (!path) return '';
        path = path.replace(/\\/g, '/');
        if (path.startsWith('http')) return path;
        if (path.startsWith('/uploads/')) return path;
        if (path.startsWith('uploads/')) return `/${path}`;
        if (path.startsWith('/')) return `/uploads${path}`; // avoid double /uploads if path is absolute but missing prefix? No, careful here.
        // If path start with /, assume it is ok if no uploads prefix? 
        // Let's stick to safe logic:
        return `/uploads/${path}`;
    };

    // Better URL logic matching Gallery.jsx
    const safeUrl = (path) => {
        if (!path) return '';
        path = path.replace(/\\/g, '/');
        if (path.startsWith('/uploads/')) return path;
        if (path.startsWith('uploads/')) return `/${path}`;
        return `/uploads/${path}`;
    };

    // Early return if item is not provided
    if (!item) {
        return null;
    }

    const imageUrl = safeUrl(item.file_path);

    return (
        <div className="fixed inset-0 z-[11000] bg-black/95 flex items-center justify-center backdrop-blur-sm">
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/70 hover:text-white z-50 p-2 rounded-full hover:bg-white/10 transition-colors tv-focusable"
                data-tv-clickable="true"
                tabIndex={0}
            >
                <X size={32} />
            </button>

            {/* Navigation Buttons */}
            {onPrev && (
                <button
                    onClick={(e) => { e.stopPropagation(); onPrev(); }}
                    className="absolute left-2 sm:left-4 text-white/50 hover:text-white z-40 p-2 sm:p-4 rounded-full hover:bg-white/5 transition-all tv-focusable"
                    data-tv-clickable="true"
                    tabIndex={0}
                >
                    <ChevronLeft size={32} className="sm:w-12 sm:h-12" />
                </button>
            )}

            {onNext && (
                <button
                    onClick={(e) => { e.stopPropagation(); onNext(); }}
                    className="absolute right-2 sm:right-4 text-white/50 hover:text-white z-40 p-2 sm:p-4 rounded-full hover:bg-white/5 transition-all tv-focusable"
                    data-tv-clickable="true"
                    tabIndex={0}
                >
                    <ChevronRight size={32} className="sm:w-12 sm:h-12" />
                </button>
            )}

            {/* Main Image Container */}
            <div className="relative w-full h-full flex items-center justify-center p-4">
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/50">
                        <Loader2 size={48} className="animate-spin text-primary" />
                        <span className="text-sm font-medium animate-pulse">Загрузка...</span>
                    </div>
                )}
                <img
                    src={imageUrl}
                    alt={item.title}
                    className={`max-h-full max-w-full object-contain shadow-2xl transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                    onLoad={() => setIsLoading(false)}
                    onError={() => setIsLoading(false)}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>

            {/* Footer / Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end">
                <div className="text-white truncate pr-4">
                    <h2 className="text-lg sm:text-xl font-bold truncate">{item.title || item.name}</h2>
                    <p className="text-xs sm:text-sm text-gray-400">
                        {new Date(item.modified * 1000).toLocaleString()}
                    </p>
                </div>

                {onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Delete this photo?')) onDelete(item);
                        }}
                        className="p-3 bg-red-600/80 hover:bg-red-600 text-white rounded-full transition-colors"
                        title="Delete"
                    >
                        <Trash2 size={20} />
                    </button>
                )}
            </div>
        </div>
    );
}
