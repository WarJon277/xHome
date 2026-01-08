import React, { useState, useEffect, useRef } from 'react';
import { fetchKaleidoscopes, fetchKaleidoscope } from '../api';
import { Play, X, Music, Maximize2 } from 'lucide-react';
import './KaleidoscopeTransitions.css'; // We will create this

export default function KaleidoscopeViewer() {
    const [kaleidoscopes, setKaleidoscopes] = useState([]);
    const [activeKaleidoscope, setActiveKaleidoscope] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadList();
    }, []);

    const loadList = async () => {
        setLoading(true);
        try {
            const data = await fetchKaleidoscopes();
            setKaleidoscopes(data);
        } catch (e) {
            console.error("Failed to load kaleidoscopes", e);
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = async (id) => {
        try {
            const details = await fetchKaleidoscope(id);
            if (details && details.items && details.items.length > 0) {
                setActiveKaleidoscope(details);
                setIsPlaying(true);
            } else {
                alert("Этот калейдоскоп пуст!");
            }
        } catch (e) {
            alert("Ошибка загрузки калейдоскопа");
        }
    };

    const closePlayer = () => {
        setIsPlaying(false);
        setActiveKaleidoscope(null);
    };

    if (isPlaying && activeKaleidoscope) {
        return <KaleidoscopePlayer kaleidoscope={activeKaleidoscope} onClose={closePlayer} />;
    }

    return (
        <div className="p-4">
            {loading ? (
                <div className="text-gray-400 text-center">Загрузка...</div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 sm:gap-2">
                    {kaleidoscopes.length === 0 && <div className="col-span-full text-center text-gray-500">Нет калейдоскопов</div>}
                    {kaleidoscopes.map(k => {
                        const cover = k.cover_path || (k.items && k.items[0] ? k.items[0].photo_path : null);

                        return (
                            <div
                                key={k.id}
                                onClick={() => handlePlay(k.id)}
                                className="relative aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform border border-gray-700 hover:border-green-500 group shadow-lg tv-focusable"
                                tabIndex={0}
                                data-tv-clickable="true"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handlePlay(k.id);
                                }}
                            >
                                {cover ? (
                                    <img src={cover} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                        <Play size={48} className="text-gray-700" />
                                    </div>
                                )}

                                <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/80 to-transparent">
                                    <h3 className="font-bold text-white truncate text-shadow">{k.title}</h3>
                                    {k.music_path && (
                                        <div className="flex items-center gap-1 text-xs text-green-400">
                                            <Music size={12} />
                                            <span>Есть музыка</span>
                                        </div>
                                    )}
                                </div>

                                {/* Play Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <div className="bg-green-600/90 rounded-full p-3 shadow-[0_0_20px_rgba(22,163,74,0.5)]">
                                        <Play size={32} className="text-white fill-white ml-1" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function KaleidoscopePlayer({ kaleidoscope, onClose }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const audioRef = useRef(null);
    const timeoutRef = useRef(null);
    const items = kaleidoscope.items;

    // Double buffering state
    const [activeItem, setActiveItem] = useState(items[0]);
    const [nextItem, setNextItem] = useState(items[1] || items[0]);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [effect, setEffect] = useState('fade');

    // Hide sidebar for fullscreen TV experience
    useEffect(() => {
        const sidebar = document.querySelector('nav');
        if (sidebar) {
            sidebar.style.display = 'none';
        }

        // Handle keyboard for TV remote
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 10009 || e.keyCode === 461) {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            if (sidebar) {
                sidebar.style.display = '';
            }
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    useEffect(() => {
        if (kaleidoscope.music_path) {
            audioRef.current = new Audio(kaleidoscope.music_path);
            audioRef.current.loop = true;
            audioRef.current.volume = 0.7;
            audioRef.current.play().catch(e => console.warn("Auto-play prevented", e));
        }

        // Start the loop
        startSequence(0);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    const startSequence = (index) => {
        const item = items[index];
        setActiveItem(item);

        // Prepare next
        const nextIdx = (index + 1) % items.length;
        setNextItem(items[nextIdx]);

        // Set effect for EXITING item (current item) or ENTERING (next)? 
        // Usually transitions are defined on the incoming slide.
        // Let's use the current item's defined transition for how it enters, 
        // or just random if not set.
        const transition = item.transition_effect || 'fade';
        setEffect(transition);

        setIsTransitioning(false); // Valid state

        const duration = (item.duration || 5) * 1000;

        timeoutRef.current = setTimeout(() => {
            // Trigger transition
            setIsTransitioning(true);

            // Wait for transition to finish (e.g. 1s), then swap real data
            setTimeout(() => {
                startSequence(nextIdx);
            }, 1000); // Transition duration must match CSS

        }, duration);
    };

    return (
        <div className="fixed inset-0 bg-black z-[100] overflow-hidden">
            {/* Controls */}
            <div className="absolute top-0 left-0 w-full z-50 p-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
                <div className="text-white/80">
                    <h2 className="text-xl font-bold">{kaleidoscope.title}</h2>
                    {activeItem && <p className="text-sm opacity-60">Фото {currentIndex + 1} из {items.length}</p>}
                </div>
                <button
                    onClick={onClose}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Slides Container */}
            <div className="w-full h-full relative">
                {/* Outgoing Slide */}
                <div
                    key={`out-${activeItem?.id || activeItem?.photo_path}`}
                    className={`absolute inset-0 w-full h-full flex items-center justify-center transition-container ${isTransitioning ? 'slide-exit' : 'slide-active'}`}
                    style={{ zIndex: 1 }}
                >
                    <img
                        src={activeItem?.photo_path}
                        className="max-w-full max-h-full object-contain shadow-2xl kaleidoscope-zoom-animation"
                    />
                </div>

                {/* Incoming Slide */}
                <div
                    key={`in-${nextItem?.id || nextItem?.photo_path}`}
                    className={`absolute inset-0 w-full h-full flex items-center justify-center transition-container ${isTransitioning ? 'slide-enter-active' : 'slide-hidden'}`}
                    style={{ zIndex: 2 }}
                >
                    <SlideRenderer item={nextItem} effect={effect} isTransitioning={isTransitioning} />
                </div>
            </div>

            {/* Background blur... */}
            <div className="absolute inset-0 -z-10 bg-black">
                {/* ... (keep background logic same or simplified) ... */}
                <div
                    className="absolute inset-0 opacity-30 blur-3xl scale-110 transition-all duration-[2000ms]"
                    style={{
                        backgroundImage: `url(${activeItem?.photo_path})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                />
                <div
                    className={`absolute inset-0 opacity-30 blur-3xl scale-110 transition-opacity duration-1000 ${isTransitioning ? 'opacity-100' : 'opacity-0'}`}
                    style={{
                        backgroundImage: `url(${nextItem?.photo_path})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                />
            </div>
        </div>
    );
}

function SlideRenderer({ item, effect, isTransitioning }) {
    if (!item) return null;

    const src = item.photo_path;

    if (effect === 'converge') {
        // 4 Quadrants flying in
        return (
            <div className="relative w-full h-full max-w-full max-h-full aspect-square md:aspect-video mx-auto flex flex-wrap content-center justify-center">
                {/* Imagine the image as 2x2 grid. We us clip-paths to show parts. 
                     Note: "object-contain" makes this hard because dimensions vary. 
                     We will use background-image for consistency in fragments. 
                 */}
                <div className="w-full h-full relative flex flex-wrap">
                    {[0, 1, 2, 3].map(i => {
                        const x = i % 2;
                        const y = Math.floor(i / 2);
                        // Clip path for each quadrant: 
                        // 0 (TL): 0 0, 50% 0, 50% 50%, 0 50%
                        const top = y * 50;
                        const left = x * 50;
                        const clip = `polygon(${left}% ${top}%, ${left + 50}% ${top}%, ${left + 50}% ${top + 50}%, ${left}% ${top + 50}%)`;

                        // Initial offset for animation
                        const startX = x === 0 ? '-50%' : '50%';
                        const startY = y === 0 ? '-50%' : '50%';
                        const transform = isTransitioning ? 'translate(0,0)' : `translate(${startX}, ${startY})`;
                        const opacity = isTransitioning ? 1 : 0;

                        return (
                            <div
                                key={i}
                                className="absolute inset-0 w-full h-full bg-no-repeat bg-contain bg-center transition-all duration-1000 ease-out"
                                style={{
                                    backgroundImage: `url(${src})`,
                                    clipPath: clip,
                                    transform: transform,
                                    opacity: opacity
                                }}
                            />
                        );
                    })}
                </div>
            </div>
        );
    }

    if (effect === 'mosaic') {
        // 3x3 Grid fading in randomly
        // We need stable randomness or just fixed pattern. Let's do fixed checkerboard-ish pattern.
        return (
            <div className="w-full h-full relative">
                {Array.from({ length: 9 }).map((_, i) => {
                    const cols = 3;
                    const x = (i % cols) * (100 / cols);
                    const y = Math.floor(i / cols) * (100 / cols);
                    const size = 100 / cols;

                    const clip = `polygon(${x}% ${y}%, ${x + size}% ${y}%, ${x + size}% ${y + size}%, ${x}% ${y + size}%)`;

                    // Delay based on index
                    const delay = (i * 100) + 'ms';

                    return (
                        <div
                            key={i}
                            className={`absolute inset-0 w-full h-full bg-no-repeat bg-contain bg-center transition-all duration-500`}
                            style={{
                                backgroundImage: `url(${src})`,
                                clipPath: clip,
                                opacity: isTransitioning ? 1 : 0,
                                transform: isTransitioning ? 'scale(1)' : 'scale(0.8)',
                                transitionDelay: delay
                            }}
                        />
                    );
                })}
            </div>
        );
    }

    // Default: Simple IMG with CSS class transition
    // Need to handle the class inside here or wrapper? 
    // Wrapper passed `slide-enter-active` but that's just a placeholder if we do custom stuff.
    // Actually the wrapper has `slide-enter-${effect}`.
    // If we use standard effects, we return img.
    return (
        <img
            src={src}
            className={`max-w-full max-h-full object-contain shadow-2xl ${isTransitioning ? `slide-enter-${effect}` : 'opacity-0'}`}
        />
    );
}


