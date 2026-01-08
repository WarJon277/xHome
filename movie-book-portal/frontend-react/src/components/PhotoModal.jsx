import { X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useEffect } from 'react';

export default function PhotoModal({ item, onClose, onNext, onPrev, onDelete }) {
    if (!item) return null;

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && onPrev) onPrev();
            if (e.key === 'ArrowRight' && onNext) onNext();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onNext, onPrev]);

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

    const imageUrl = safeUrl(item.file_path);

    return (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center backdrop-blur-sm">
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/70 hover:text-white z-50 p-2 rounded-full hover:bg-white/10 transition-colors"
            >
                <X size={32} />
            </button>

            {/* Navigation Buttons */}
            {onPrev && (
                <button
                    onClick={(e) => { e.stopPropagation(); onPrev(); }}
                    className="absolute left-4 text-white/50 hover:text-white z-40 p-4 rounded-full hover:bg-white/5 transition-all"
                >
                    <ChevronLeft size={48} />
                </button>
            )}

            {onNext && (
                <button
                    onClick={(e) => { e.stopPropagation(); onNext(); }}
                    className="absolute right-4 text-white/50 hover:text-white z-40 p-4 rounded-full hover:bg-white/5 transition-all"
                >
                    <ChevronRight size={48} />
                </button>
            )}

            {/* Main Image */}
            <div className="relative w-full h-full flex items-center justify-center p-4">
                <img
                    src={imageUrl}
                    alt={item.title}
                    className="max-h-full max-w-full object-contain shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>

            {/* Footer / Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end">
                <div className="text-white">
                    <h2 className="text-xl font-bold">{item.title || item.name}</h2>
                    <p className="text-sm text-gray-400">
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
