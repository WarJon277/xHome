import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, ChevronLeft, Maximize, Minimize, RotateCcw, Volume2, VolumeX, FastForward, Rewind, PictureInPicture, Gauge } from 'lucide-react';
import { fetchProgress, saveProgress } from '../api';

export default function Player({ item, src, onClose, onNext, onPrev }) {
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [savedProgress, setSavedProgress] = useState(0);
    const [volume, setVolume] = useState(() => Number(localStorage.getItem('player-volume')) || 1);
    const [isMuted, setIsMuted] = useState(false);
    // showResumePrompt is replaced by the Start Screen UI logic
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showDoubleTapIndicator, setShowDoubleTapIndicator] = useState(null); // 'left' or 'right'
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
                    }
                })
                .catch(console.error);
        }
    }, [itemId, itemType]);



    const handleResume = () => {
        // Check for Android native player
        if (window.AndroidApp && typeof window.AndroidApp.playVideo === 'function') {
            console.log('Resuming with Android native player');
            try {
                const fullVideoUrl = videoUrl.startsWith('http')
                    ? videoUrl
                    : `${window.location.origin}${videoUrl}`;

                window.AndroidApp.playVideo(
                    fullVideoUrl,
                    title,
                    itemId || 0,
                    itemType,
                    savedProgress || 0
                );

                setTimeout(() => {
                    onClose();
                }, 500);

                return;
            } catch (error) {
                console.error('Failed to launch native player:', error);
            }
        }

        // Fallback to HTML5
        if (videoRef.current) {
            videoRef.current.currentTime = savedProgress;
            videoRef.current.play();
            setIsPlaying(true);
            setHasStarted(true);
        }
    };

    const handleStartOver = () => {
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
            setIsPlaying(true);
            setHasStarted(true);
        }
    };

    const handlePlayStart = () => {
        // Check if running in Android app with native player support
        if (window.AndroidApp && typeof window.AndroidApp.playVideo === 'function') {
            console.log('Using Android native player');
            try {
                const fullVideoUrl = videoUrl.startsWith('http')
                    ? videoUrl
                    : `${window.location.origin}${videoUrl}`;

                window.AndroidApp.playVideo(
                    fullVideoUrl,
                    title,
                    itemId || 0,
                    itemType,
                    savedProgress || 0
                );

                // Close the web player since native player will take over
                setTimeout(() => {
                    onClose();
                }, 500);

                return;
            } catch (error) {
                console.error('Failed to launch native player:', error);
                // Fall through to HTML5 player
            }
        }

        // Fallback to HTML5 video player
        if (videoRef.current) {
            videoRef.current.play();
            setIsPlaying(true);
            setHasStarted(true);
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
        // Auto-play only when hasStarted is true
        if (videoRef.current && hasStarted) {
            videoRef.current.play().catch(e => console.error("Autoplay failed:", e));
            videoRef.current.focus();
        }
    }, [hasStarted]);

    // Media Session API
    useEffect(() => {
        if ('mediaSession' in navigator && item) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: item.tvshow_title || 'Фильм',
                album: item.tvshow_title || '',
                artwork: [
                    { src: item.image || '', sizes: '512x512', type: 'image/jpeg' }
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => {
                videoRef.current?.play();
                setIsPlaying(true);
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                videoRef.current?.pause();
                setIsPlaying(false);
            });
            navigator.mediaSession.setActionHandler('seekbackward', () => seek(-10));
            navigator.mediaSession.setActionHandler('seekforward', () => seek(10));
            navigator.mediaSession.setActionHandler('previoustrack', onPrev ? onPrev : null);
            navigator.mediaSession.setActionHandler('nexttrack', onNext ? onNext : null);

            return () => {
                navigator.mediaSession.setActionHandler('play', null);
                navigator.mediaSession.setActionHandler('pause', null);
                navigator.mediaSession.setActionHandler('seekbackward', null);
                navigator.mediaSession.setActionHandler('seekforward', null);
                navigator.mediaSession.setActionHandler('previoustrack', null);
                navigator.mediaSession.setActionHandler('nexttrack', null);
            };
        }
    }, [item, onNext, onPrev]);

    // Update Media Session Position State
    useEffect(() => {
        if ('mediaSession' in navigator && videoRef.current) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: duration || 0,
                    playbackRate: playbackRate,
                    position: currentTime || 0
                });
            } catch (e) {
                // Some browsers might fail if time is not finite
            }
        }
    }, [currentTime, duration, playbackRate]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Normalize key for some devices
            const key = e.key;
            const keyCode = e.keyCode;

            // If prompt is showing, only allow Back button; others let spatial navigation handle it
            // If prompt is showing, only allow Back button; others let spatial navigation handle it
            // (Prompt logic removed, handled by Start Screen overlay now)

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
                // IMPORTANT: If user is pressing Enter/Space on a focused button, let the button handle it.
                // Do not hijack it for Play/Pause.
                const active = document.activeElement;
                const isInteractive = active && (
                    active.tagName === 'BUTTON' ||
                    active.tagName === 'A' ||
                    active.tagName === 'INPUT' ||
                    active.getAttribute('role') === 'button'
                );
                const isGenericKey = key === ' ' || key === 'Enter' || keyCode === 32 || keyCode === 13;

                if (isInteractive && isGenericKey) {
                    // Let default browser behavior (click) happen
                    return;
                }

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

        // Delay adding listener to avoid catching our own history.back() from strict mode cleanup
        const timer = setTimeout(() => {
            window.addEventListener('popstate', handlePopState);
        }, 100);

        document.body.style.overflow = 'hidden';

        return () => {
            clearTimeout(timer);
            window.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            window.removeEventListener('popstate', handlePopState);
            document.body.style.overflow = '';
            // If we are unmounting and history state is still ours, go back one step to clean up
            if (window.history.state?.playerOpen) {
                window.history.back();
            }
        };
    }, [duration, isPlaying, savedProgress]);

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

    const togglePiP = async () => {
        if (videoRef.current && document.pictureInPictureEnabled) {
            try {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else {
                    await videoRef.current.requestPictureInPicture();
                }
            } catch (error) {
                console.error('PiP failed:', error);
            }
        }
    };

    const cyclePlaybackRate = () => {
        const rates = [1, 1.25, 1.5, 2];
        const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
        const newRate = rates[nextIndex];
        setPlaybackRate(newRate);
        if (videoRef.current) {
            videoRef.current.playbackRate = newRate;
        }
    };

    const seek = (amount) => {
        if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + amount));
            setCurrentTime(videoRef.current.currentTime);
            showControlsTemporarily();

            // Show indicator
            setShowDoubleTapIndicator(amount > 0 ? 'right' : 'left');
            setTimeout(() => setShowDoubleTapIndicator(null), 500);
        }
    };

    const handleDoubleTap = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const isRight = x > rect.width / 2;
        seek(isRight ? 10 : -10);
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

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
        }
        localStorage.setItem('player-volume', newVolume);
    };

    const toggleMute = () => {
        if (videoRef.current) {
            const newMuted = !isMuted;
            setIsMuted(newMuted);
            videoRef.current.muted = newMuted;
        }
    };

    // Apply volume on video load
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
        }
    }, [volume, isMuted]);

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

            {/* Double Tap Seek Zones (Mobile-first) */}
            {hasStarted && (
                <div className="absolute inset-0 z-[10001] flex pointer-events-none sm:pointer-events-auto">
                    <div
                        className="flex-1 pointer-events-auto h-full"
                        onDoubleClick={(e) => {
                            e.preventDefault();
                            seek(-10);
                        }}
                    />
                    <div
                        className="flex-1 pointer-events-auto h-full"
                        onDoubleClick={(e) => {
                            e.preventDefault();
                            seek(10);
                        }}
                    />
                </div>
            )}

            {/* Double Tap Indicators */}
            {showDoubleTapIndicator && (
                <div className={`absolute z-[10005] top-1/2 -translate-y-1/2 ${showDoubleTapIndicator === 'left' ? 'left-[15%]' : 'right-[15%]'} flex flex-col items-center gap-2 text-white bg-black/40 p-6 rounded-full animate-ping-once`}>
                    {showDoubleTapIndicator === 'left' ? <Rewind size={48} fill="currentColor" /> : <FastForward size={48} fill="currentColor" />}
                    <span className="font-bold text-xl">{showDoubleTapIndicator === 'left' ? '-10с' : '+10с'}</span>
                </div>
            )}

            {/* Start Screen Overlay */}
            {!hasStarted && (
                <div className="absolute inset-0 z-[10002] bg-black/90 flex flex-col items-center justify-center p-6 text-white text-center">
                    {/* Background Image (Blurred if available) */}
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-30 blur-xl"
                        style={{ backgroundImage: item?.image ? `url(${item.image})` : 'none' }}
                    />

                    <div className="relative z-10 max-w-4xl w-full flex flex-col items-center gap-6">
                        <h1 className="text-4xl sm:text-6xl font-extrabold mb-2 drop-shadow-2xl">{title}</h1>

                        <div className="flex gap-6 text-lg sm:text-xl text-gray-300 font-medium">
                            {item?.year && <span>{item.year}</span>}
                            {item?.rating && (
                                <span className="flex items-center gap-1 text-yellow-400">
                                    ★ {item.rating}
                                </span>
                            )}
                            {item?.duration && <span>{item.duration}</span>}
                        </div>

                        {item?.description && (
                            <p className="text-gray-400 text-lg sm:text-xl max-w-2xl leading-relaxed mb-4 overflow-y-auto max-h-[30vh] pr-2 custom-scrollbar">
                                {item.description}
                            </p>
                        )}

                        <div className="flex flex-col sm:flex-row gap-6 mt-8 w-full justify-center">
                            {savedProgress > 10 ? (
                                <>
                                    <button
                                        onClick={handleResume}
                                        className="py-4 px-10 bg-red-600 rounded-xl font-bold text-xl hover:bg-red-700 hover:scale-105 transition-all outline-none focus:ring-4 ring-white/50 flex items-center justify-center gap-3 tv-focusable"
                                        autoFocus
                                    >
                                        <Play fill="currentColor" size={24} />
                                        Продолжить с {formatTime(savedProgress)}
                                    </button>
                                    <button
                                        onClick={handleStartOver}
                                        className="py-4 px-10 bg-white/10 rounded-xl font-bold text-xl hover:bg-white/20 hover:scale-105 transition-all outline-none focus:ring-4 ring-white/50 flex items-center justify-center gap-3 tv-focusable"
                                    >
                                        <RotateCcw size={24} />
                                        С начала
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={handlePlayStart}
                                    className="py-5 px-16 bg-white text-black rounded-full font-bold text-2xl hover:bg-gray-200 hover:scale-110 transition-all outline-none focus:ring-4 ring-red-600 flex items-center justify-center gap-3 tv-focusable"
                                    autoFocus
                                >
                                    <Play fill="currentColor" size={32} />
                                    Смотреть
                                </button>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            className="absolute top-0 right-0 p-4 text-white/50 hover:text-white transition-colors"
                        >
                            <X size={32} />
                        </button>
                    </div>
                </div>
            )}

            {/* Overlay Controls */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 transition-opacity duration-500 flex flex-col justify-between p-6 sm:p-10 ${showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>

                {/* Header */}
                <div className="flex items-center justify-between">
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

                {/* Center Play Button - ALWAYS focusable even when controls hidden */}
                {!isPlaying && hasStarted && (
                    <div className="self-center pointer-events-auto">
                        <button
                            onClick={togglePlay}
                            className="p-8 bg-red-600 rounded-full text-white hover:bg-red-700 hover:scale-110 transition-all shadow-2xl tv-focusable"
                            data-tv-clickable="true"
                            tabIndex={0}
                            autoFocus
                        >
                            <Play fill="currentColor" size={64} />
                        </button>
                    </div>
                )}

                {/* Footer Controls */}
                <div className="w-full pointer-events-auto mt-auto">
                    {/* Gradient background for better visibility */}
                    <div className="bg-gradient-to-t from-black via-black/80 to-transparent pt-8 pb-4 px-4 sm:px-6">

                        {/* Container: Flex wrap to handle mobile (2 rows) vs desktop (1 row) */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-y-2 gap-x-3 sm:gap-x-4">

                            {/* PROGRESS BAR: Order 1 on Mobile (Top), Order 3 on Desktop (Middle) */}
                            <div className="order-1 sm:order-3 w-full sm:flex-1 flex items-center">
                                <div
                                    ref={progressRef}
                                    onClick={handleProgressClick}
                                    className="flex-1 h-3 sm:h-1.5 bg-white/40 rounded-full overflow-visible cursor-pointer relative group"
                                >
                                    <div
                                        className="bg-red-600 h-full rounded-full transition-all duration-150 relative"
                                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                    >
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-3 sm:h-3 bg-white rounded-full shadow-lg group-hover:scale-125 transition-transform border border-black/10" />
                                    </div>
                                </div>
                            </div>

                            {/* PLAY BUTTON: Order 2 on Mobile, Order 1 on Desktop */}
                            <button
                                onClick={togglePlay}
                                className="order-2 sm:order-1 p-2 text-white hover:bg-white/20 rounded-lg transition-colors tv-focusable"
                                data-tv-clickable="true"
                                tabIndex={0}
                            >
                                {isPlaying ? <Pause size={28} /> : <Play fill="currentColor" size={28} />}
                            </button>

                            {/* CURRENT TIME: Order 3 on Mobile, Order 2 on Desktop */}
                            <span className="order-3 sm:order-2 text-white text-sm sm:text-base font-medium min-w-[45px] sm:min-w-[50px]">{formatTime(currentTime)}</span>

                            {/* SPACER for Mobile to push right controls */}
                            <div className="order-4 sm:hidden flex-1"></div>

                            {/* DURATION: Order 5 on Mobile (right side), Order 4 on Desktop */}
                            <span className="order-5 sm:order-4 text-white text-sm sm:text-base font-medium min-w-[45px] sm:min-w-[50px] text-right">{formatTime(duration)}</span>

                            {/* VOLUME: Order 5 on Desktop, Hidden on Mobile */}
                            <div className="order-5 sm:order-5 flex max-sm:hidden items-center gap-2 ml-2">
                                <button
                                    onClick={toggleMute}
                                    className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors tv-focusable"
                                    data-tv-clickable="true"
                                    tabIndex={0}
                                >
                                    {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={volume}
                                    onChange={handleVolumeChange}
                                    className="w-20 sm:w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%, rgba(255,255,255,0.2) 100%)`
                                    }}
                                />
                            </div>

                            {/* PLAYBACK SPEED: Order 5.5 */}
                            <button
                                onClick={cyclePlaybackRate}
                                className="order-5 sm:order-6 p-2 text-white hover:bg-white/20 rounded-lg transition-colors tv-focusable flex items-center gap-1"
                                data-tv-clickable="true"
                                tabIndex={0}
                            >
                                <Gauge size={24} />
                                <span className="text-sm font-bold min-w-[2.5rem]">{playbackRate}x</span>
                            </button>

                            {/* PICTURE IN PICTURE: Order 5.6 */}
                            {document.pictureInPictureEnabled && (
                                <button
                                    onClick={togglePiP}
                                    className="order-5 sm:order-7 p-2 text-white hover:bg-white/20 rounded-lg transition-colors tv-focusable"
                                    data-tv-clickable="true"
                                    tabIndex={0}
                                >
                                    <PictureInPicture size={24} />
                                </button>
                            )}

                            {/* FULLSCREEN: Order 6 */}
                            <button
                                onClick={toggleFullscreen}
                                className="order-6 sm:order-8 p-2 text-white hover:bg-white/20 rounded-lg transition-colors tv-focusable"
                                data-tv-clickable="true"
                                tabIndex={0}
                            >
                                {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
