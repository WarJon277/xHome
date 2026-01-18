import { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, Volume2, Download, Music, RotateCcw, ListMusic } from 'lucide-react';
import { fetchProgress, saveProgress, fetchAudiobookTracks } from '../api';
import './AudiobookPlayer.css';

export default function AudiobookPlayer({ audiobook, onClose }) {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [savedProgress, setSavedProgress] = useState(0);
    const [savedTrackIndex, setSavedTrackIndex] = useState(0);
    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const [tracks, setTracks] = useState([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [showPlaylist, setShowPlaylist] = useState(false);
    const lastSavedTimeRef = useRef(0);
    const isResumingRef = useRef(false);

    // Fetch tracks and progress on mount
    useEffect(() => {
        if (audiobook?.id) {
            // Fetch tracks
            fetchAudiobookTracks(audiobook.id)
                .then(data => {
                    setTracks(data || []);
                })
                .catch(console.error);

            // Fetch progress
            fetchProgress('audiobook', audiobook.id)
                .then(data => {
                    const progress = data?.progress_seconds || data?.progress || 0;
                    const trackIdx = data?.track_index || 0;
                    if (progress > 5 || trackIdx > 0) {
                        setSavedProgress(progress);
                        setSavedTrackIndex(trackIdx);
                        setShowResumePrompt(true);
                    }
                })
                .catch(console.error);
        }
    }, [audiobook]);

    // Handle track changes and playback events
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);

            // Save progress every 5 seconds
            if (Math.abs(audio.currentTime - lastSavedTimeRef.current) > 5) {
                saveProgress('audiobook', audiobook.id, audio.currentTime, 0, currentTrackIndex);
                lastSavedTimeRef.current = audio.currentTime;
            }
        };

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
            // If we are resuming, this is where we'd ideally apply the time
            // but handleResume handles it by waiting for this event once.
        };

        const handleEnded = () => {
            if (currentTrackIndex < tracks.length - 1) {
                // Play next track
                setCurrentTrackIndex(prev => prev + 1);
                setIsPlaying(true);
            } else {
                setIsPlaying(false);
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            // Save on unmount
            if (audioRef.current) {
                saveProgress('audiobook', audiobook.id, audioRef.current.currentTime, 0, currentTrackIndex);
            }
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audiobook, currentTrackIndex, tracks.length]);

    // Auto-play on track change if it was already playing
    useEffect(() => {
        if (isPlaying && audioRef.current) {
            audioRef.current.play().catch(e => console.warn("Auto-play blocked:", e));
        }
    }, [currentTrackIndex]);

    const handleResume = () => {
        isResumingRef.current = true;
        setCurrentTrackIndex(savedTrackIndex);
        setShowResumePrompt(false);

        // Wait for next tick to ensure src is updated if track index changed
        setTimeout(() => {
            if (audioRef.current) {
                const audio = audioRef.current;
                const applyProgress = () => {
                    audio.currentTime = savedProgress;
                    setCurrentTime(savedProgress);
                    audio.play();
                    setIsPlaying(true);
                    isResumingRef.current = false;
                };

                if (audio.readyState >= 1) {
                    applyProgress();
                } else {
                    const onMetadata = () => {
                        applyProgress();
                        audio.removeEventListener('loadedmetadata', onMetadata);
                    };
                    audio.addEventListener('loadedmetadata', onMetadata);
                }
            }
        }, 50);
    };

    const handleStartOver = () => {
        setCurrentTrackIndex(0);
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
            const val = parseFloat(e.target.value);
            audioRef.current.currentTime = val;
            setCurrentTime(val);
        }
    };

    const handleVolumeChange = (e) => {
        const vol = parseFloat(e.target.value);
        setVolume(vol);
        if (audioRef.current) {
            audioRef.current.volume = vol;
        }
    };

    const selectTrack = (index) => {
        setCurrentTrackIndex(index);
        setIsPlaying(true);
        setShowPlaylist(false);
        // Progress will be reset by src change automatically unless we are resuming
    };

    const formatTime = (time) => {
        if (!time || isNaN(time)) return '0:00';
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const seconds = Math.floor(time % 60);
        if (hours > 0) {
            return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const currentTrack = tracks[currentTrackIndex] || { url: audiobook.file_path, title: audiobook.title };

    return (
        <div className="audiobook-player-container">
            <div className="player-overlay" onClick={onClose} />

            <div className="player-modal">
                <button className="close-btn" onClick={() => {
                    if (audioRef.current && audiobook?.id) {
                        saveProgress('audiobook', audiobook.id, audioRef.current.currentTime, 0, currentTrackIndex);
                    }
                    onClose();
                }}>
                    <X size={24} />
                </button>

                {showResumePrompt && (
                    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center rounded-2xl p-6 text-center">
                        <RotateCcw size={48} className="text-blue-500 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Продолжить прослушивание?</h3>
                        <p className="text-gray-400 mb-6">
                            {tracks.length > 1 ? `Глава ${savedTrackIndex + 1}, ` : ''}
                            время {formatTime(savedProgress)}
                        </p>
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
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <h2>{audiobook.title}</h2>
                                <p className="author">{audiobook.author}</p>
                            </div>
                            {tracks.length > 1 && (
                                <button
                                    className={`playlist-toggle ${showPlaylist ? 'active' : ''}`}
                                    onClick={() => setShowPlaylist(!showPlaylist)}
                                    title="Список файлов"
                                >
                                    <ListMusic size={24} />
                                </button>
                            )}
                        </div>

                        {tracks.length > 1 && !showPlaylist && (
                            <p className="current-track-name">
                                {currentTrackIndex + 1}. {currentTrack.title}
                            </p>
                        )}

                        {showPlaylist ? (
                            <div className="playlist-container">
                                {tracks.map((track, index) => (
                                    <div
                                        key={index}
                                        className={`playlist-item ${index === currentTrackIndex ? 'active' : ''}`}
                                        onClick={() => selectTrack(index)}
                                    >
                                        <span className="track-number">{index + 1}</span>
                                        <span className="track-title">{track.title}</span>
                                        {index === currentTrackIndex && isPlaying && <div className="playing-indicator" />}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                {audiobook.narrator && <p className="narrator">Диктор: {audiobook.narrator}</p>}
                                {audiobook.genre && <p className="genre">{audiobook.genre}</p>}
                                {audiobook.description && <p className="description">{audiobook.description}</p>}
                            </>
                        )}
                    </div>
                </div>

                {audiobook.file_path && (
                    <div className="player-controls">
                        <audio
                            ref={audioRef}
                            src={currentTrack.url.startsWith('uploads') || currentTrack.url.startsWith('/uploads')
                                ? (currentTrack.url.startsWith('/') ? currentTrack.url : `/${currentTrack.url}`)
                                : `/uploads/${currentTrack.url}`}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            volume={volume}
                        />

                        <div className="play-button-wrapper">
                            <button className="play-btn" onClick={togglePlay}>
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
                            href={currentTrack.url.startsWith('uploads') || currentTrack.url.startsWith('/uploads')
                                ? (currentTrack.url.startsWith('/') ? currentTrack.url : `/${currentTrack.url}`)
                                : `/uploads/${currentTrack.url}`}
                            download
                            className="download-btn"
                            title="Скачать текущий файл"
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
