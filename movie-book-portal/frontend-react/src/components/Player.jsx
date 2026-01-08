import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, ChevronLeft } from 'lucide-react';

export default function Player({ item, src, onClose, onNext, onPrev }) {
    const videoRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef(null);

    // Normalize path
    const getVideoUrl = () => {
        // Priority 1: Direct src prop
        if (src) {
            let path = src;
            path = path.replace(/\\/g, '/');
            return path;
        }

        // Priority 2: Extract from item
        if (!item) return '';

        let path = item.file_path || item.path;
        if (!path) return '';

        path = path.replace(/\\/g, '/');
        if (path.startsWith('http')) return path;

        // Ensure strictly one /uploads prefix
        if (path.startsWith('/uploads/')) return path;
        if (path.startsWith('uploads/')) return `/${path}`;

        return `/uploads/${path}`;
    };

    const videoUrl = getVideoUrl();

    useEffect(() => {
        // Auto-play on mount
        if (videoRef.current) {
            videoRef.current.play().catch(e => console.error("Autoplay failed:", e));
        }

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === ' ' || e.key === 'Enter') {
                togglePlay();
            }
            showControlsTemporarily();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            onMouseMove={handleMouseMove}
        >
            <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                onClick={togglePlay}
            />

            {/* Overlay Controls */}
            <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 pointer-events-none flex flex-col justify-between p-8 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>

                {/* Header */}
                <div className="flex items-center justify-between pointer-events-auto">
                    <button onClick={onClose} className="p-2 text-white hover:bg-white/20 rounded-full">
                        <ChevronLeft size={40} />
                    </button>
                    <h2 className="text-2xl font-bold text-white shadow-black drop-shadow-md">
                        {title}
                    </h2>
                    <div className="w-12"></div>
                </div>

                {/* Center Play Button */}
                {!isPlaying && (
                    <div className="self-center pointer-events-auto">
                        <button onClick={togglePlay} className="p-6 bg-red-600 rounded-full text-white hover:bg-red-700 hover:scale-110 transition-transform">
                            <Play fill="currentColor" size={48} />
                        </button>
                    </div>
                )}

                {/* Footer Controls (Scrubber placeholder) */}
                <div className="w-full bg-white/10 h-2 rounded-full mt-auto mb-8 pointer-events-auto relative cursor-pointer">
                    <div
                        className="bg-red-600 h-full rounded-full"
                        style={{ width: '0%' }} // TODO: bind to currentTime
                    ></div>
                </div>
            </div>
        </div>
    );
}
