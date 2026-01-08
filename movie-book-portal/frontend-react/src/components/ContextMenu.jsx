import { useEffect, useRef } from 'react';

export default function ContextMenu({ x, y, options, onClose }) {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        // Delay attaching listener to avoid immediate close from the event that opened it
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [onClose]);

    // Adjust position if it flows off screen
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const menuWidth = 200; // Estimated max width
    const menuHeight = 150; // Estimated max height

    let finalX = x;
    let finalY = y;

    if (x + menuWidth > windowWidth) finalX = windowWidth - menuWidth - 10;
    if (y + menuHeight > windowHeight) finalY = windowHeight - menuHeight - 10;

    const style = {
        top: Math.max(0, finalY),
        left: Math.max(0, finalX),
    };

    return (
        <div
            ref={menuRef}
            className="fixed z-[999999] min-w-[160px] bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-xl py-2 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={style}
        >
            {options.map((option, index) => (
                <button
                    key={index}
                    className={`
            text-left px-4 py-2 text-sm text-gray-200 hover:bg-primary hover:text-white transition-colors flex items-center gap-2
            ${option.className || ''}
          `}
                    onClick={() => {
                        option.onClick();
                        onClose();
                    }}
                >
                    {option.icon && <span className="opacity-70">{option.icon}</span>}
                    {option.label}
                </button>
            ))}
        </div>
    );
}
