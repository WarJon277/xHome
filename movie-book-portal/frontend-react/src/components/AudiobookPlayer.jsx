import { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, Volume2, Download, Music, RotateCcw } from 'lucide-react';
import { fetchProgress, saveProgress } from '../api';
import './AudiobookPlayer.css';

export default function AudiobookPlayer({ audiobook, onClose }) {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [savedProgress, setSavedProgress] = useState(0);
    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const lastSavedTimeRef = useRef(0);

    useEffect(() => {
        // Fetch progress on mount
        if (audiobook?.id) {
            fetchProgress('audiobook', audiobook.id)
                .then(data => {
                    // Backend might return progress_seconds (get_progress) or progress (get_latest_progress)
                    const progress = data?.progress_seconds || data?.progress || 0;
                    if (progress > 0) {
                        setSavedProgress(progress);
                        setShowResumePrompt(true);
                    }
                })
                .catch(console.error);
        }
    }, [audiobook]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);

            // Save progress every 5 seconds
            if (Math.abs(audio.currentTime - lastSavedTimeRef.current) > 5) {
                saveProgress('audiobook', audiobook.id, audio.currentTime);
                lastSavedTimeRef.current = audio.currentTime;
            }
        };
        const handleLoadedMetadata = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            // Save on unmount
            if (audioRef.current) {
                saveProgress('audiobook', audiobook.id, audioRef.current.currentTime);
            }
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audiobook]);

    const handleResume = () => {
        if (audioRef.current) {
            const audio = audioRef.current;
            const applyProgress = () => {
                audio.currentTime = savedProgress;
                setCurrentTime(savedProgress);
                audio.play();
                setIsPlaying(true);
                setShowResumePrompt(false);
            };

            if (audio.readyState >= 1) { // HAVE_METADATA or higher
                applyProgress();
            } else {
                const onMetadata = () => {
                    applyProgress();
                    audio.removeEventListener('loadedmetadata', onMetadata);
                };
                audio.addEventListener('loadedmetadata', onMetadata);
            }
        }
    };

    const handleStartOver = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            setCurrentTime(0);
            audioRef.current.play();
            setIsPlaying(true);
        }
        setShowResumePrompt(false);
    };

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleProgressChange = (e) => {
        if (audioRef.current) {
            audioRef.current.currentTime = parseFloat(e.target.value);
            setCurrentTime(parseFloat(e.target.value));
        }
    };

    const handleVolumeChange = (e) => {
        const vol = parseFloat(e.target.value);
        setVolume(vol);
        if (audioRef.current) {
            audioRef.current.volume = vol;
        }
    };

    const formatTime = (time) => {
        if (!time || isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    return (
        <div className="audiobook-player-container">
            <div className="player-overlay" onClick={onClose} />

            <div className="player-modal">
                <button className="close-btn" onClick={() => {
                    // Force save on close
                    if (audioRef.current && audiobook?.id) {
                        saveProgress('audiobook', audiobook.id, audioRef.current.currentTime);
                    }
                    onClose();
                }}>
                    <X size={24} />
                </button>

                {showResumePrompt && (
                    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center rounded-2xl p-6 text-center">
                        <RotateCcw size={48} className="text-blue-500 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Продолжить прослушивание?</h3>
                        <p className="text-gray-400 mb-6">Вы остановились на {formatTime(savedProgress)}</p>
                        <div className="flex gap-4 w-full">
                            <button
                                onClick={handleResume}
                                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                            >
                                Продолжить
                            </button>
                            <button
                                onClick={handleStartOver}
                                className="flex-1 py-3 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition-colors"
                            >
                                С начала
                            </button>
                        </div>
                    </div>
                )}

                <div className="player-content">
                    <div className="cover-section">
                        {audiobook.thumbnail_path ? (
                            <img
                                src={audiobook.thumbnail_path.startsWith('uploads') || audiobook.thumbnail_path.startsWith('/uploads')
                                    ? (audiobook.thumbnail_path.startsWith('/') ? audiobook.thumbnail_path : `/${audiobook.thumbnail_path}`)
                                    : `/uploads/${audiobook.thumbnail_path}`}
                                alt={audiobook.title}
                                className="cover-image"
                            />
                        ) : (
                            <div className="cover-placeholder">
                                <Music size={80} />
                            </div>
                        )}
                    </div>

                    <div className="info-section">
                        <h2>{audiobook.title}</h2>
                        <p className="author">{audiobook.author}</p>
                        {audiobook.narrator && (
                            <p className="narrator">Диктор: {audiobook.narrator}</p>
                        )}
                        {audiobook.genre && (
                            <p className="genre">{audiobook.genre}</p>
                        )}
                        {audiobook.description && (
                            <p className="description">{audiobook.description}</p>
                        )}
                    </div>
                </div>

                {audiobook.file_path && (
                    <div className="player-controls">
                        <audio
                            ref={audioRef}
                            src={audiobook.file_path.startsWith('uploads') || audiobook.file_path.startsWith('/uploads')
                                ? (audiobook.file_path.startsWith('/') ? audiobook.file_path : `/${audiobook.file_path}`)
                                : `/uploads/${audiobook.file_path}`}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                        />

                        <div className="play-button-wrapper">
                            <button
                                className="play-btn"
                                onClick={togglePlay}
                            >
                                {isPlaying ? <Pause size={32} /> : <Play size={32} />}
                            </button>
                        </div>

                        <div className="progress-section">
                            <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={currentTime}
                                onChange={handleProgressChange}
                                className="progress-bar"
                            />
                            <div className="time-display">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>

                        <div className="volume-section">
                            <Volume2 size={20} />
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={volume}
                                onChange={handleVolumeChange}
                                className="volume-slider"
                            />
                        </div>

                        <a
                            href={audiobook.file_path.startsWith('uploads') || audiobook.file_path.startsWith('/uploads')
                                ? (audiobook.file_path.startsWith('/') ? audiobook.file_path : `/${audiobook.file_path}`)
                                : `/uploads/${audiobook.file_path}`}
                            download
                            className="download-btn"
                            title="Скачать"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Download size={24} />
                        </a>
                    </div>
                )}

                {!audiobook.file_path && (
                    <div className="no-file-message">
                        <p>Файл аудиокниги не загружен</p>
                    </div>
                )}
            </div>
        </div>
    );
}
