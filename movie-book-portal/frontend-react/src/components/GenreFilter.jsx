import { useRef, useEffect } from 'react';

export default function GenreFilter({ genres, selectedGenre, onSelect }) {
    const scrollRef = useRef(null);

    // Auto-scroll to selected item if needed, simplistic implementation
    useEffect(() => {
        if (selectedGenre === 'Все' && scrollRef.current) {
            scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
    }, [selectedGenre]);

    return (
        <div
            className="flex gap-2 overflow-x-auto pb-4 mb-4 no-scrollbar [-ms-overflow-style:none] [scrollbar-width:none]"
            ref={scrollRef}
        >
            <button
                onClick={() => onSelect('Все')}
                className={`
                    px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all
                    ${selectedGenre === 'Все'
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}
                    tv-focusable
                `}
                data-tv-clickable="true"
            >
                Все
            </button>
            {genres.map(genre => (
                <button
                    key={genre}
                    onClick={() => onSelect(genre)}
                    className={`
                        px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all
                        ${selectedGenre === genre
                            ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}
                        tv-focusable
                    `}
                    data-tv-clickable="true"
                >
                    {genre}
                </button>
            ))}
        </div>
    );
}
