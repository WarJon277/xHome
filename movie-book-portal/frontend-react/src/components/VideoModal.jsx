import { X, ChevronLeft, ChevronRight, Trash2, Loader2, Share2, PlayCircle } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function VideoModal({ item, onClose, onNext, onPrev, onDelete }) {
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef(null);

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
            // Space to toggle play/pause
            if (e.key === ' ' || e.key === 'Enter') {
                if (videoRef.current) {
                    e.preventDefault();
                    if (videoRef.current.paused) {
                        videoRef.current.play();
                    } else {
                        videoRef.current.pause();
                    }
                }
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
        if (videoRef.current) {
            videoRef.current.load(); // force reload of video source
            videoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
        }
    }, [item?.id, item?.file_path]);

    // Better URL logic matching Player.jsx
    const safeUrl = (path) => {
        if (!path) return null;
        path = path.replace(/\\/g, '/');
        if (path.startsWith('http')) return path;

        // Ensure we have a leading slash for relative paths
        if (!path.startsWith('/') && !path.startsWith('uploads/')) {
            path = `/uploads/${path}`;
        } else if (path.startsWith('uploads/')) {
            path = `/${path}`;
        }

        // If running in Android app, we MUST use absolute URLs
        const isAndroidApp = navigator.userAgent.includes('xWV2-App-Identifier');
        if (isAndroidApp && !path.startsWith('http')) {
            return `${window.location.origin}${path}`;
        }

        return path;
    };

    const handleShare = async () => {
        const url = safeUrl(item.file_path);
        const fullUrl = window.location.origin + url;

        if (window.AndroidApp && typeof window.AndroidApp.shareFile === 'function') {
            window.AndroidApp.shareFile(fullUrl, item.title || item.name);
            return;
        }

        if (navigator.share) {
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                const file = new File([blob], `${item.title || 'video'}.mp4`, { type: blob.type || 'video/mp4' });

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: item.title,
                        files: [file]
                    });
                } else {
                    await navigator.share({
                        title: item.title,
                        url: fullUrl
                    });
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Share failed:', err);
                }
            }
        } else {
            // Fallback
            try {
                await navigator.clipboard.writeText(fullUrl);
                alert("Ссылка скопирована в буфер обмена");
            } catch {
                alert("Ваш браузер не поддерживает функцию 'Поделиться'");
            }
        }
    };

    // Early return if item is not provided
    if (!item) {
        return null;
    }

    const videoUrl = safeUrl(item.file_path);

    return createPortal(
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

            {/* Main Video Container */}
            <div className="relative w-full h-full flex items-center justify-center p-4 pb-24">
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/50">
                        <Loader2 size={48} className="animate-spin text-primary" />
                        <span className="text-sm font-medium animate-pulse">Загрузка видео...</span>
                    </div>
                )}
                {videoUrl && (
                    <video
                        ref={videoRef}
                        src={videoUrl}
                        controls
                        autoPlay
                        playsInline
                        className={`max-h-full max-w-full shadow-2xl transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                        onLoadedData={() => setIsLoading(false)}
                        onLoadedMetadata={() => setIsLoading(false)}
                        onWaiting={() => setIsLoading(true)}
                        onPlaying={() => setIsLoading(false)}
                        onError={() => {
                            setIsLoading(false);
                            console.error('Video load error');
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        Ваш браузер не поддерживает тег video.
                    </video>
                )}
            </div>

            {/* Footer / Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end pointer-events-none">
                <div className="text-white truncate pr-4 pointer-events-auto">
                    <h2 className="text-lg sm:text-xl font-bold truncate">{item.title || item.name}</h2>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1 flex items-center gap-2">
                        <span className="opacity-60">Дата съёмки:</span>
                        <span className="font-medium text-gray-200">
                            {item.modified ? new Date(item.modified * 1000).toLocaleString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            }) : 'Неизвестно'}
                        </span>
                    </p>
                </div>

                <div className="flex gap-2 pointer-events-auto">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleShare();
                        }}
                        className="p-3 bg-green-600/80 hover:bg-green-600 text-white rounded-full transition-colors tv-focusable pointer-events-auto"
                        title="Share"
                        data-tv-clickable="true"
                    >
                        <Share2 size={20} />
                    </button>

                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Удалить это видео?')) onDelete(item);
                            }}
                            className="p-3 bg-red-600/80 hover:bg-red-600 text-white rounded-full transition-colors tv-focusable pointer-events-auto"
                            title="Delete"
                            data-tv-clickable="true"
                        >
                            <Trash2 size={20} />
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
