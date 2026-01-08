import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, ChevronLeft, Maximize, Minimize, RotateCcw } from 'lucide-react';
import { fetchProgress, saveProgress } from '../api';

export default function Player({ item, src, onClose, onNext, onPrev }) {
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [savedProgress, setSavedProgress] = useState(0);
    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const controlsTimeoutRef = useRef(null);
    const progressRef = useRef(null);
    const lastSavedTimeRef = useRef(0);

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
    const itemType = item?.tvshow_id ? 'episode' : 'movie';
    const itemId = item?.id;

    useEffect(() => {
        // Load progress
        if (itemId) {
            fetchProgress(itemType, itemId)
                .then(data => {
                    if (data && data.progress_seconds > 10) {
                        setSavedProgress(data.progress_seconds);
                        setShowResumePrompt(true);
                        if (videoRef.current) {
                            videoRef.current.pause();
                            setIsPlaying(false);
                        }
                        // Hide prompt after 10s
                        setTimeout(() => setShowResumePrompt(false), 10000);
                    }
                })
                .catch(console.error);
        }
    }, [itemId, itemType]);

    const handleResume = () => {
        if (videoRef.current) {
            videoRef.current.currentTime = savedProgress;
            videoRef.current.play();
            setIsPlaying(true);
        }
        setShowResumePrompt(false);
    };

    const handleStartOver = () => {
        setShowResumePrompt(false);
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
            setIsPlaying(true);
        }
    };

    const handleSaveProgress = (time) => {
        if (!itemId || Math.abs(time - lastSavedTimeRef.current) < 5) return;

        // If near end (last 30 seconds or > 97%), reset progress to 0
        let timeToSave = time;
        if (duration > 0 && (time > duration - 30 || time / duration > 0.97)) {
            timeToSave = 0;
        }

        saveProgress(itemType, itemId, timeToSave).catch(console.error);
        lastSavedTimeRef.current = time;
    };

    useEffect(() => {
        // Auto-play on mount and focus video for TV remotes
        if (videoRef.current && !showResumePrompt) {
            videoRef.current.play().catch(e => console.error("Autoplay failed:", e));
            videoRef.current.focus();
        }
    }, [showResumePrompt]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Normalize key for some devices
            const key = e.key;
            const keyCode = e.keyCode;

            // If prompt is showing, only allow Back button; others let spatial navigation handle it
            if (showResumePrompt) {
                if (key === 'Escape' || key === 'Backspace' || key === 'GoBack' || keyCode === 461 || keyCode === 10009 || keyCode === 27) {
                    handleSaveProgress(videoRef.current?.currentTime || 0);
                    onClose();
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }

            let handled = false;

            // Support for various TV remote Back buttons (Samsung, LG, etc.)
            const isBack = key === 'Escape' || key === 'Backspace' || key === 'GoBack' ||
                keyCode === 461 || keyCode === 10009 || keyCode === 27 || keyCode === 8;

            if (isBack) {
                handleSaveProgress(videoRef.current?.currentTime || 0);
                onClose();
                handled = true;
            }

            // Support for various TV remote Play/Pause buttons
            const isPlayPause = key === ' ' || key === 'Enter' ||
                key === 'MediaPlayPause' || key === 'PlayPause' ||
                key === 'MediaPlay' || key === 'MediaPause' ||
                keyCode === 179 || keyCode === 19 || keyCode === 415 || keyCode === 32 || keyCode === 13;

            if (isPlayPause) {
                togglePlay();
                handled = true;
            }
            if (key === 'ArrowRight' || keyCode === 39) {
                seek(10);
                handled = true;
            }
            if (key === 'ArrowLeft' || keyCode === 37) {
                seek(-10);
                handled = true;
            }

            if (handled) {
                e.preventDefault();
                e.stopPropagation();
            }
            showControlsTemporarily();
        };

        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        // History API for Back Button
        window.history.pushState({ playerOpen: true }, '', window.location.href);
        const handlePopState = (event) => {
            // Browser back button pressed
            event.preventDefault();
            handleSaveProgress(videoRef.current?.currentTime || 0);
            onClose();
        };

        window.addEventListener('keydown', handleKeyDown, true); // Use capture to priority
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        window.addEventListener('popstate', handlePopState);
        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            window.removeEventListener('popstate', handlePopState);
            document.body.style.overflow = '';
            // If we are unmounting and history state is still ours, go back one step to clean up
            if (window.history.state?.playerOpen) {
                window.history.back();
            }
        };
    }, [duration, isPlaying, showResumePrompt, savedProgress]);

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

    const toggleFullscreen = () => {
        const container = videoRef.current?.parentElement;
        if (!container) return;

        if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
            const requestFS = container.requestFullscreen || container.webkitRequestFullscreen || container.msRequestFullscreen;
            if (requestFS) {
                requestFS.call(container).catch(err => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            }
        } else {
            const exitFS = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
            if (exitFS) exitFS.call(document);
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
                onDoubleClick={toggleFullscreen}
                onTimeUpdate={() => {
                    const time = videoRef.current?.currentTime || 0;
                    setCurrentTime(time);
                    handleSaveProgress(time);
                }}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => {
                    setIsPlaying(false);
                    handleSaveProgress(videoRef.current?.currentTime || 0);
                }}
            />

            {/* Resume Prompt Overlay */}
            {showResumePrompt && (
                <div className="absolute inset-0 z-[10001] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-gray-900 p-6 sm:p-10 rounded-2xl border border-white/10 shadow-2xl max-w-lg w-full text-center">
                        <RotateCcw size={64} className="mx-auto text-red-500 mb-6" />
                        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Продолжить просмотр?</h2>
                        <p className="text-gray-400 mb-8 sm:text-xl">Вы остановились на {formatTime(savedProgress)}</p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={handleResume}
                                className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold text-lg sm:text-xl hover:bg-red-700 transition-all tv-focusable active:scale-95 border-2 border-transparent focus:border-white outline-none"
                                data-tv-clickable="true"
                                autoFocus
                            >
                                Продолжить
                            </button>
                            <button
                                onClick={handleStartOver}
                                className="flex-1 py-4 bg-white/10 text-white rounded-xl font-bold text-lg sm:text-xml hover:bg-white/20 transition-all tv-focusable active:scale-95 border-2 border-transparent focus:border-white outline-none"
                                data-tv-clickable="true"
                            >
                                С начала
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Overlay Controls */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 transition-opacity duration-500 pointer-events-none flex flex-col justify-between p-6 sm:p-10 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>

                {/* Header */}
                <div className="flex items-center justify-between pointer-events-auto">
                    <button
                        onClick={onClose}
                        className="p-3 text-white hover:bg-white/20 rounded-full transition-colors tv-focusable"
                        data-tv-clickable="true"
                        tabIndex={0}
                    >
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
                        <button
                            onClick={togglePlay}
                            className="p-8 bg-red-600 rounded-full text-white hover:bg-red-700 hover:scale-110 transition-all shadow-2xl tv-focusable"
                            data-tv-clickable="true"
                            tabIndex={0}
                        >
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

                        <button
                            onClick={toggleFullscreen}
                            className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors ml-2 tv-focusable"
                            data-tv-clickable="true"
                            tabIndex={0}
                        >
                            {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
