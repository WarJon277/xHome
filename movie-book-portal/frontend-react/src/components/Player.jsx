import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, ChevronLeft } from 'lucide-react';

export default function Player({ item, src, onClose, onNext, onPrev }) {
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const controlsTimeoutRef = useRef(null);
    const progressRef = useRef(null);

    // Normalize path
    const getVideoUrl = () => {
        if (src) {
            let path = src;
            path = path.replace(/\\/g, '/');
            return path;
        }

        if (!item) return '';

        let path = item.file_path || item.path;
        if (!path) return '';

        path = path.replace(/\\/g, '/');
        if (path.startsWith('http')) return path;

        if (path.startsWith('/uploads/')) return path;
        if (path.startsWith('uploads/')) return `/${path}`;

        return `/uploads/${path}`;
    };

    const videoUrl = getVideoUrl();

    useEffect(() => {
        // Auto-play on mount and focus video for TV remotes
        if (videoRef.current) {
            videoRef.current.play().catch(e => console.error("Autoplay failed:", e));
            videoRef.current.focus();
        }

        const handleKeyDown = (e) => {
            let handled = false;

            if (e.key === 'Escape') {
                onClose();
                handled = true;
            }
            if (e.key === ' ' || e.key === 'Enter') {
                togglePlay();
                handled = true;
            }
            if (e.key === 'ArrowRight') {
                seek(10);
                handled = true;
            }
            if (e.key === 'ArrowLeft') {
                seek(-10);
                handled = true;
            }

            if (handled) {
                e.preventDefault();
                e.stopPropagation();
            }
            showControlsTemporarily();
        };

        window.addEventListener('keydown', handleKeyDown, true); // Use capture to priority
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            document.body.style.overflow = '';
        };
    }, [duration, isPlaying]);

    const togglePlay = () => {
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play();
                setIsPlaying(true);
            } else {
                videoRef.current.pause();
                setIsPlaying(false);
            }
        }
    };

    const seek = (amount) => {
        if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + amount));
            setCurrentTime(videoRef.current.currentTime);
            showControlsTemporarily();
        }
    };

    const handleProgressClick = (e) => {
        if (progressRef.current && videoRef.current) {
            const rect = progressRef.current.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            videoRef.current.currentTime = pos * videoRef.current.duration;
            showControlsTemporarily();
        }
    };

    const formatTime = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const showControlsTemporarily = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    const handleMouseMove = () => {
        showControlsTemporarily();
    };

    const title = item ? (item.title || item.name) : "Video";

    return (
        <div
            className="fixed inset-0 z-[10000] bg-black flex items-center justify-center font-sans overflow-hidden"
            onMouseMove={handleMouseMove}
        >
            <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain outline-none"
                tabIndex={-1}
                onClick={togglePlay}
                onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

            {/* Overlay Controls */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 transition-opacity duration-500 pointer-events-none flex flex-col justify-between p-6 sm:p-10 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>

                {/* Header */}
                <div className="flex items-center justify-between pointer-events-auto">
                    <button onClick={onClose} className="p-3 text-white hover:bg-white/20 rounded-full transition-colors">
                        <ChevronLeft size={48} />
                    </button>
                    <div className="text-center flex-1 mx-4">
                        <h2 className="text-xl sm:text-3xl font-bold text-white drop-shadow-lg truncate">
                            {title}
                        </h2>
                    </div>
                    <div className="w-16"></div>
                </div>

                {/* Center Play Button (only pulse if paused) */}
                {!isPlaying && (
                    <div className="self-center pointer-events-auto">
                        <button onClick={togglePlay} className="p-8 bg-red-600 rounded-full text-white hover:bg-red-700 hover:scale-110 transition-all shadow-2xl">
                            <Play fill="currentColor" size={64} />
                        </button>
                    </div>
                )}

                {/* Footer Controls */}
                <div className="w-full pointer-events-auto mt-auto flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <span className="text-white text-sm sm:text-lg font-medium min-w-[60px]">{formatTime(currentTime)}</span>
                        <div
                            ref={progressRef}
                            onClick={handleProgressClick}
                            className="flex-1 h-2 sm:h-3 bg-white/20 rounded-full overflow-hidden cursor-pointer relative group"
                        >
                            <div
                                className="bg-red-600 h-full rounded-full transition-all duration-150 relative"
                                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                            >
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full scale-0 group-hover:scale-100 transition-transform shadow-md" />
                            </div>
                        </div>
                        <span className="text-white text-sm sm:text-lg font-medium min-w-[60px] text-right">{formatTime(duration)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
