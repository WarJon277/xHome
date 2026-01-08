import { useEffect, useRef } from 'react';

export default function ContextMenu({ x, y, options, onClose }) {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        // Bind to mousedown to catch clicks anywhere
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Adjust position if it flows off screen (basic check)
    const style = {
        top: y,
        left: x,
    };

    return (
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[160px] bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-xl py-2 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
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
