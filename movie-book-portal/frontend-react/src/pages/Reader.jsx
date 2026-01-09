import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchBook, fetchBookPage, fetchProgress, saveProgress } from '../api';
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Moon, Sun, Coffee, RotateCcw } from 'lucide-react';

export default function Reader() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [book, setBook] = useState(null);
    const [pageContent, setPageContent] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('reader-font-size')) || 20);
    const [theme, setTheme] = useState(() => localStorage.getItem('reader-theme') || 'sepia');
    const [error, setError] = useState(null);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [savedProgress, setSavedProgress] = useState(null);
    const [initialProgressApplied, setInitialProgressApplied] = useState(false);

    const contentRef = useRef(null);

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const data = await fetchBook(id);
                setBook(data);
                if (data.total_pages) {
                    setTotalPages(data.total_pages);
                }

                // Load Progress
                try {
                    const prog = await fetchProgress('book', id);
                    if (prog && prog.progress_seconds > 0) {
                        const savedPage = Math.floor(prog.progress_seconds);
                        if (savedPage > 0 && savedPage <= (data.total_pages || 9999)) {
                            setCurrentPage(savedPage);
                            setSavedProgress({
                                page: savedPage,
                                scrollRatio: prog.scroll_ratio || 0
                            });
                        }
                    }
                } catch (e) { console.warn("Could not load progress", e); }
                setIsInitialLoad(false);
            } catch (e) {
                setError(`Ошибка загрузки книги: ${e.message}`);
            }
        };
        loadMetadata();
    }, [id]);

    const handleSaveProgress = async () => {
        if (!id || !contentRef.current) return;
        const scrollTotal = contentRef.current.scrollHeight - contentRef.current.clientHeight;
        const scrollRatio = scrollTotal > 0 ? contentRef.current.scrollTop / scrollTotal : 0;
        try {
            await saveProgress('book', id, currentPage, scrollRatio);
        } catch (e) {
            console.error("Save progress failed", e);
        }
    };

    useEffect(() => {
        if (!isInitialLoad && id) {
            handleSaveProgress();
        }
    }, [currentPage, id, isInitialLoad]);

    useEffect(() => {
        const interval = setInterval(handleSaveProgress, 30000); // Less frequent periodic save

        const onUnload = () => {
            handleSaveProgress();
        };
        window.addEventListener('beforeunload', onUnload);

        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', onUnload);
            handleSaveProgress(); // Final save on unmount
        };
    }, [id, currentPage]);

    // Debounced scroll listener
    const scrollTimeoutRef = useRef(null);
    const handleScroll = () => {
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
            handleSaveProgress();
        }, 1500); // Save 1.5s after scrolling stops
    };

    useEffect(() => {
        localStorage.setItem('reader-font-size', fontSize);
        localStorage.setItem('reader-theme', theme);
    }, [fontSize, theme]);

    useEffect(() => {
        if (!book) {
            console.log('Skipping page load - book not loaded yet');
            return;
        }

        const loadPage = async () => {
            try {
                setPageContent('');
                setError(null);
                console.log(`\n=== Loading page ${currentPage} of book ${id} ===`);

                const data = await fetchBookPage(id, currentPage);
                console.log('Raw API response:', data);
                console.log('Response type:', typeof data);
                console.log('Has content property:', 'content' in data);

                if (data && data.content) {
                    console.log('✓ Content found, length:', data.content.length);
                    console.log('Content preview (first 300 chars):', data.content.substring(0, 300));

                    const processed = processContent(data.content, id);
                    console.log('✓ Content processed, length:', processed.length);

                    setPageContent(processed);

                    if (data.total) {
                        console.log('✓ Updating total pages:', data.total);
                        setTotalPages(data.total);
                    }
                } else {
                    console.warn('✗ No content in response');
                    setError('Нет контента для отображения');
                    setPageContent('<div style="text-align:center; padding:40px; color:#999;">Нет контента</div>');
                }

                if (contentRef.current) {
                    if (!initialProgressApplied && savedProgress && savedProgress.page === currentPage) {
                        console.log(`[READER] Restore scroll: page ${currentPage}, ratio ${savedProgress.scrollRatio}`);

                        let attempts = 0;
                        const restore = () => {
                            if (!contentRef.current) return;
                            const scrollTotal = contentRef.current.scrollHeight - contentRef.current.clientHeight;
                            const target = savedProgress.scrollRatio * scrollTotal;

                            // Check if content is actually there (scrollbar appeared or it's a small page)
                            if (scrollTotal > 0 || attempts > 10) {
                                contentRef.current.scrollTop = target;
                                console.log(`[READER] Scrolled to ${target} after ${attempts} attempts`);
                                setInitialProgressApplied(true);
                            } else {
                                attempts++;
                                setTimeout(restore, 100);
                            }
                        };
                        setTimeout(restore, 200);
                    } else {
                        contentRef.current.scrollTop = 0;
                    }
                }
            } catch (e) {
                console.error("✗ Page load error:", e);
                console.error("Error stack:", e.stack);
                setError(`Ошибка: ${e.message}`);
                setPageContent(`<div style="text-align:center; padding:40px; color:#ef4444;">
                    <h3>Ошибка загрузки страницы</h3>
                    <p>${e.message}</p>
                </div>`);
            }
        };

        loadPage();
    }, [id, currentPage, book]);

    // Global error handler for broken images (capture phase)
    useEffect(() => {
        const handleError = (e) => {
            const tag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
            // Handle broken images (img, image)
            if (tag === 'img' || tag === 'image') {
                const target = e.target;

                // Try fallback to book thumbnail if available and not yet tried
                if (book && book.thumbnail_path && target.getAttribute('data-has-fallback') !== 'true') {
                    console.log('Attempting thumbnail fallback for:', target.src || target.href);
                    target.setAttribute('data-has-fallback', 'true');

                    let thumb = book.thumbnail_path.replace(/\\/g, '/');
                    if (!thumb.startsWith('/')) {
                        if (thumb.startsWith('uploads/')) thumb = '/' + thumb;
                        else thumb = '/uploads/' + thumb;
                    }

                    if (tag === 'image') {
                        target.setAttribute('xlink:href', thumb);
                        target.setAttribute('href', thumb);
                    } else {
                        target.src = thumb;
                    }
                    // Prevent hiding, give fallback a chance to load
                    return;
                }

                console.log(`Hiding broken image (final): ${target.src || target.href || 'unknown'}`);
                target.style.display = 'none';

                // Also try to hide parent frame if it looks like a wrapper
                if (target.parentElement) {
                    const parentTag = target.parentElement.tagName.toLowerCase();
                    if (parentTag === 'svg') {
                        target.parentElement.style.display = 'none';
                    }
                    // Temporarily disabling div hiding to ensure text is not hidden
                    // else if (parentTag === 'div' && target.parentElement.classList.contains('cover-container')) { 
                    //    target.parentElement.style.display = 'none';
                    // }
                }
            }
        };

        // Capture phase to catch non-bubbling load errors
        window.addEventListener('error', handleError, true);
        return () => window.removeEventListener('error', handleError, true);
    }, [book]);

    const processContent = (html, bookId) => {
        console.log('Processing content for book:', bookId);
        let processed = html;

        // Extract body content if present
        const bodyMatch = processed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            console.log('✓ Extracted body content');
            processed = bodyMatch[1];
        } else {
            console.log('⚠ No body tag found, using full content');
        }

        // Rewrite resource URLs (src, xlink:href)
        // EXCLUDING generic 'href' to avoid breaking CSS links or anchors which might cause issues
        // Also updated regex to handle both single and double quotes
        processed = processed.replace(/(src|xlink:href)=(['"])(.*?)\2/gi, (match, attr, quote, url) => {
            if (url && !url.match(/^(http|data:|#)/)) {
                // If it's seemingly a relative path, prefix it
                const encoded = url.split('/').map(s => encodeURIComponent(s)).join('/');
                return `${attr}=${quote}/api/books/${bookId}/file_resource/${encoded}${quote}`;
            }
            return match;
        });

        console.log('Content processed successfully, final length:', processed.length);
        return processed;
    };

    const handleNext = () => {
        if (currentPage < totalPages) {
            console.log(`Next page: ${currentPage} -> ${currentPage + 1}`);
            setCurrentPage(p => p + 1);
        }
    };

    const handlePrev = () => {
        if (currentPage > 1) {
            console.log(`Previous page: ${currentPage} -> ${currentPage - 1}`);
            setCurrentPage(p => p - 1);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === 'PageDown') handleNext();
            if (e.key === 'ArrowLeft' || e.key === 'PageUp') handlePrev();
            if (e.key === 'Escape') navigate('/books');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, totalPages]);

    const getThemeColors = () => {
        switch (theme) {
            case 'night': return { bg: '#121212', text: '#e0e0e0', header: '#1a1a1a' };
            case 'light': return { bg: '#ffffff', text: '#1a1a1a', header: '#f5f5f5' };
            case 'sepia': default: return { bg: '#f4ece0', text: '#5c4636', header: '#ebe2d5' };
        }
    };

    const colors = getThemeColors();

    if (error && !book) {
        return (
            <div className="h-screen bg-black flex items-center justify-center text-white">
                <div className="text-center max-w-md p-8">
                    <div className="text-2xl mb-4 text-red-500">Ошибка</div>
                    <div className="text-sm opacity-70">{error}</div>
                    <button
                        onClick={() => navigate('/books')}
                        className="mt-6 px-6 py-2 bg-white/10 rounded-lg hover:bg-white/20"
                    >
                        Вернуться к списку
                    </button>
                </div>
            </div>
        );
    }

    if (!book) {
        return (
            <div className="h-screen bg-black flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="text-2xl mb-4">Загрузка книги...</div>
                    <div className="text-sm opacity-50">ID: {id}</div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="h-screen flex flex-col"
            style={{ backgroundColor: colors.bg, color: colors.text }}
        >
            {/* Header */}
            <header
                className="flex flex-col sm:flex-row items-center justify-between p-3 sm:p-4 border-b shadow-md flex-shrink-0 gap-3"
                style={{ backgroundColor: colors.header, borderColor: 'rgba(0,0,0,0.1)' }}
            >
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => navigate('/books')}
                        className="p-2 rounded-full hover:bg-black/10 transition-colors tv-focusable"
                        style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                    >
                        <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
                    </button>
                    <div className="truncate">
                        <h1 className="font-bold text-sm sm:text-lg truncate">{book.title}</h1>
                        <p className="text-[10px] sm:text-xs opacity-60 truncate">{book.author || 'Автор неизвестен'}</p>
                    </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 w-full sm:w-auto">
                    {/* Font Size */}
                    <div className="flex items-center gap-1 bg-black/5 rounded-lg p-1">
                        <button onClick={() => setFontSize(s => Math.max(12, s - 2))} className="p-1 sm:p-2 hover:bg-black/10 rounded tv-focusable">
                            <ZoomOut size={18} className="sm:w-5 sm:h-5" />
                        </button>
                        <span className="text-xs sm:text-sm font-bold w-6 sm:w-10 text-center">{fontSize}</span>
                        <button onClick={() => setFontSize(s => Math.min(40, s + 2))} className="p-1 sm:p-2 hover:bg-black/10 rounded tv-focusable">
                            <ZoomIn size={18} className="sm:w-5 sm:h-5" />
                        </button>
                    </div>

                    {/* Theme Selector */}
                    <div className="flex items-center gap-1 bg-black/5 rounded-lg p-1">
                        <button
                            onClick={() => setTheme('light')}
                            className={`p-1.5 sm:p-2 rounded transition-all tv-focusable ${theme === 'light' ? 'bg-white shadow-sm sm:shadow-md' : 'hover:bg-black/10'}`}
                        >
                            <Sun size={18} className="sm:w-5 sm:h-5" />
                        </button>
                        <button
                            onClick={() => setTheme('sepia')}
                            className={`p-1.5 sm:p-2 rounded transition-all tv-focusable ${theme === 'sepia' ? 'bg-white shadow-sm sm:shadow-md' : 'hover:bg-black/10'}`}
                        >
                            <Coffee size={18} className="sm:w-5 sm:h-5" />
                        </button>
                        <button
                            onClick={() => setTheme('night')}
                            className={`p-1.5 sm:p-2 rounded transition-all tv-focusable ${theme === 'night' ? 'bg-white shadow-sm sm:shadow-md' : 'hover:bg-black/10'}`}
                        >
                            <Moon size={18} className="sm:w-5 sm:h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main
                ref={contentRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-8"
                style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.7',
                    fontFamily: "'EB Garamond', Georgia, serif"
                }}
            >
                {pageContent ? (
                    <div
                        className="max-w-4xl mx-auto"
                        style={{ textAlign: 'justify' }}
                        dangerouslySetInnerHTML={{ __html: pageContent }}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center opacity-50">
                            <div className="text-xl mb-2">Загрузка страницы...</div>
                            <div className="text-sm">Страница {currentPage} из {totalPages}</div>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer
                className="flex flex-row items-center justify-between p-2 sm:p-4 border-t shadow-lg flex-shrink-0 gap-2 sm:gap-4"
                style={{ backgroundColor: colors.header, borderColor: 'rgba(0,0,0,0.1)' }}
            >
                <div className="hidden sm:block flex items-center justify-between w-full sm:hidden mb-2">
                    <div className="text-xs font-bold">
                        {currentPage} / {totalPages}
                    </div>
                    <div className="flex-1 mx-4 h-1 bg-black/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500"
                            style={{ width: `${(currentPage / totalPages) * 100}%` }}
                        ></div>
                    </div>
                </div>

                <button
                    onClick={handlePrev}
                    disabled={currentPage <= 1}
                    className="flex items-center justify-center gap-1 sm:gap-2 px-3 py-1.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl font-bold transition-all active:scale-95 flex-1 sm:flex-none sm:w-auto"
                    style={{
                        backgroundColor: currentPage <= 1 ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.1)',
                        opacity: currentPage <= 1 ? 0.3 : 1,
                        cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                    }}
                >
                    <ChevronLeft size={18} className="sm:w-6 sm:h-6" /> <span className="text-xs sm:text-base">Назад</span>
                </button>

                <div className="hidden sm:flex flex-col items-center">
                    <div className="text-sm font-bold mb-2">
                        Страница {currentPage} из {totalPages}
                    </div>
                    <div className="w-64 h-2 bg-black/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${(currentPage / totalPages) * 100}%` }}
                        ></div>
                    </div>
                </div>

                <button
                    onClick={handleNext}
                    disabled={currentPage >= totalPages}
                    className="flex items-center justify-center gap-1 sm:gap-2 px-3 py-1.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl font-bold transition-all active:scale-95 flex-1 sm:flex-none sm:w-auto"
                    style={{
                        backgroundColor: currentPage >= totalPages ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.1)',
                        opacity: currentPage >= totalPages ? 0.3 : 1,
                        cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                    }}
                >
                    <span className="text-xs sm:text-base">Вперед</span> <ChevronRight size={18} className="sm:w-6 sm:h-6" />
                </button>
            </footer>
        </div>
    );
}
