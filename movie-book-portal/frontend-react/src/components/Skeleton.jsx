/**
 * Skeleton loading components for the portal.
 * Provides shimmer-animated placeholders that match the real content layout.
 */

// Base shimmer block
export function SkeletonBlock({ className = '', style = {} }) {
    return (
        <div
            className={`skeleton-shimmer rounded ${className}`}
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', ...style }}
        />
    );
}

// Skeleton for MediaCard (Movies, Books, TV Shows, Audiobooks)
export function SkeletonMediaCard() {
    return (
        <div
            className="flex flex-col rounded-lg overflow-hidden"
            style={{ backgroundColor: 'var(--card-bg)' }}
        >
            {/* Image placeholder - matches pb-[150%] aspect ratio */}
            <div className="relative w-full pb-[150%]">
                <SkeletonBlock className="absolute inset-0 rounded-none" />
            </div>
            {/* Text content */}
            <div className="p-3 flex flex-col gap-2">
                <SkeletonBlock style={{ height: '14px', width: '85%' }} />
                <SkeletonBlock style={{ height: '12px', width: '60%' }} className="hidden sm:block" />
                <div className="flex gap-2 mt-1">
                    <SkeletonBlock style={{ height: '18px', width: '40px', borderRadius: '4px' }} />
                    <SkeletonBlock style={{ height: '18px', width: '30px', borderRadius: '4px' }} className="ml-auto" />
                </div>
            </div>
        </div>
    );
}

// Grid of MediaCard skeletons
export function SkeletonMediaGrid({ count = 12 }) {
    return (
        <div className="media-grid">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonMediaCard key={i} />
            ))}
        </div>
    );
}

// Skeleton for Gallery / VideoGallery items (square aspect)
export function SkeletonGalleryItem() {
    return (
        <div
            className="relative aspect-square rounded-lg overflow-hidden"
            style={{ backgroundColor: 'var(--card-bg)' }}
        >
            <SkeletonBlock className="absolute inset-0 rounded-none" />
        </div>
    );
}

// Grid of Gallery skeletons
export function SkeletonGalleryGrid({ count = 18 }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2 sm:gap-3">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonGalleryItem key={i} />
            ))}
        </div>
    );
}

// Masonry grid of Gallery skeletons
export function SkeletonMasonryGrid({ count = 15 }) {
    // Generate an array of random heights between 100px and 250px to simulate masonry
    const heights = [150, 200, 120, 250, 180, 140, 220, 160, 190, 130, 210, 170, 240, 110, 230];

    return (
        <div className="masonry-grid">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="masonry-item rounded-lg overflow-hidden"
                    style={{ backgroundColor: 'var(--card-bg)', height: `${heights[i % heights.length]}px` }}
                >
                    <SkeletonBlock className="w-full h-full rounded-none" />
                </div>
            ))}
        </div>
    );
}

// Skeleton for Dashboard page
export function SkeletonDashboard() {
    return (
        <div className="p-4 sm:p-8 pb-24 pt-20 sm:pt-8 max-w-7xl mx-auto space-y-10">
            {/* Header */}
            <header>
                <SkeletonBlock style={{ height: '36px', width: '280px' }} className="mb-3" />
                <SkeletonBlock style={{ height: '20px', width: '360px' }} />
            </header>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Continue watching */}
                <section className="flex-1 lg:w-2/3 min-w-0 space-y-6">
                    <SkeletonBlock style={{ height: '24px', width: '180px' }} className="mb-4" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--card-bg)' }}>
                                <div className="aspect-video">
                                    <SkeletonBlock className="w-full h-full rounded-none" />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Stats sidebar */}
                <section className="lg:w-1/3 min-w-0 space-y-6">
                    <SkeletonBlock style={{ height: '24px', width: '140px' }} className="mb-4" />
                    <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="p-4 rounded-2xl border border-white/10 flex flex-col items-center gap-2" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                                <SkeletonBlock style={{ height: '24px', width: '24px', borderRadius: '50%' }} />
                                <SkeletonBlock style={{ height: '28px', width: '40px' }} />
                                <SkeletonBlock style={{ height: '10px', width: '50px' }} />
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* New arrivals */}
            <section className="space-y-6 pt-4">
                <SkeletonBlock style={{ height: '24px', width: '200px' }} className="mb-4" />
                <div className="flex gap-6 overflow-hidden">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex-none w-40 sm:w-52">
                            <div className="aspect-[2/3] rounded-2xl overflow-hidden mb-3">
                                <SkeletonBlock className="w-full h-full rounded-none" />
                            </div>
                            <SkeletonBlock style={{ height: '14px', width: '80%' }} className="mb-1" />
                            <SkeletonBlock style={{ height: '10px', width: '50%' }} />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
