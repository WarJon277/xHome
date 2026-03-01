import React, { useState, useEffect } from 'react';

export default function MasonryLayout({ children, gap = 4 }) {
    const [cols, setCols] = useState(getColumnsCount(window.innerWidth));

    useEffect(() => {
        const handleResize = () => setCols(getColumnsCount(window.innerWidth));
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    function getColumnsCount(width) {
        if (width >= 1920) return 10; // 3xl
        if (width >= 1536) return 8;  // 2xl
        if (width >= 1280) return 6;  // xl
        if (width >= 1024) return 5;  // lg
        if (width >= 768) return 4;   // md
        if (width >= 640) return 3;   // sm
        return 2;                     // default
    }

    const columns = Array.from({ length: cols }, () => []);

    // Distribute children sequentially (left-to-right reading order)
    React.Children.toArray(children).forEach((child, index) => {
        columns[index % cols].push(child);
    });

    return (
        <div className="flex w-full" style={{ gap: `${gap}px` }}>
            {columns.map((col, i) => (
                <div key={i} className="flex-1 flex flex-col min-w-0" style={{ gap: `${gap}px` }}>
                    {col}
                </div>
            ))}
        </div>
    );
}
