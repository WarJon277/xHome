import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchBook, fetchBookPage, fetchProgress, saveProgress } from '../api';
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Moon, Sun, Coffee, RotateCcw, Settings, Maximize, Minimize, WifiOff } from 'lucide-react';

export default function Reader() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [book, setBook] = useState(null);
    const [pageContent, setPageContent] = useState('');
    const [currentPage, setCurrentPage] = useState(0); // Start at 0 for description page
    const [totalPages, setTotalPages] = useState(1);
    const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('reader-font-size')) || 20);
    const [theme, setTheme] = useState(() => localStorage.getItem('reader-theme') || 'sepia');
    const [error, setError] = useState(null);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [savedProgress, setSavedProgress] = useState(null);
    const [initialProgressApplied, setInitialProgressApplied] = useState(false);
    const [scrollRatio, setScrollRatio] = useState(0); // Track scroll position on current page
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [immersiveMode, setImmersiveMode] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

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

    // Listen for online/offline events
    useEffect(() => {
        const handleOnline = () => {
            console.log('[Reader] Network online');
            setIsOnline(true);
        };
        const handleOffline = () => {
            console.log('[Reader] Network offline');
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

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
        // Update scroll ratio for progress bar
        if (contentRef.current) {
            const scrollTotal = contentRef.current.scrollHeight - contentRef.current.clientHeight;
            const ratio = scrollTotal > 0 ? contentRef.current.scrollTop / scrollTotal : 0;
            setScrollRatio(ratio);
        }

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

        // Page 0: Show description page
        if (currentPage === 0) {
            const descriptionHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; padding: 20px; text-align: center; min-height: 60vh; justify-content: center;">
                    ${book.thumbnail_path ? `
                        <img 
                            src="${book.thumbnail_path.startsWith('/') ? book.thumbnail_path : '/' + book.thumbnail_path}" 
                            alt="${book.title}"
                            style="max-width: 300px; max-height: 400px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); margin-bottom: 30px;"
                        />
                    ` : ''}
                    <h1 style="font-size: 2em; margin-bottom: 10px; font-weight: bold;">${book.title}</h1>
                    <p style="font-size: 1.2em; opacity: 0.7; margin-bottom: 20px;">${book.author || 'Автор неизвестен'}</p>
                    ${book.year ? `<p style="opacity: 0.6; margin-bottom: 10px;">Год: ${book.year}</p>` : ''}
                    ${book.genre ? `<p style="opacity: 0.6; margin-bottom: 20px;">Жанр: ${book.genre}</p>` : ''}
                    ${book.description ? `
                        <div style="max-width: 600px; margin-top: 20px; text-align: justify; line-height: 1.8; padding: 20px; background: rgba(0,0,0,0.03); border-radius: 8px;">
                            <p style="font-size: 1.1em;">${book.description}</p>
                        </div>
                    ` : ''}
                    <div style="margin-top: 40px; padding: 15px 30px; background: rgba(0,0,0,0.05); border-radius: 8px; font-weight: bold;">
                        Нажмите "Вперед" чтобы начать чтение →
                    </div>
                </div>
            `;
            setPageContent(descriptionHTML);
            if (contentRef.current) {
                contentRef.current.scrollTop = 0;
            }
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
        if (currentPage > 0) {
            console.log(`Previous page: ${currentPage} -> ${currentPage - 1}`);
            setCurrentPage(p => p - 1);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === 'PageDown') handleNext();
            if (e.key === 'ArrowLeft' || e.key === 'PageUp') handlePrev();
            if (e.key === 'Escape') navigate('/books', { replace: true });
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, totalPages]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    const toggleImmersive = () => {
        setImmersiveMode(!immersiveMode);
    };

    const getThemeColors = () => {
        switch (theme) {
            case 'night': return { bg: '#121212', text: '#e0e0e0', header: '#1a1a1a' };
            case 'light': return { bg: '#ffffff', text: '#1a1a1a', header: '#f5f5f5' };
            case 'sepia': default: return { bg: '#f4ece0', text: '#5c4636', header: '#ebe2d5' };
        }
    };

    const [showSettings, setShowSettings] = useState(false);
    const longPressTimer = useRef(null);

    const handleLongPressStart = () => {
        longPressTimer.current = setTimeout(() => {
            setShowSettings(true);
        }, 600); // 600ms for long press
    };

    const handleLongPressEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    const colors = getThemeColors();

    // Calculate total progress: (current page - 1 + scroll ratio) / total pages
    // Page 0 is description, so actual content starts at page 1
    const calculateTotalProgress = () => {
        if (currentPage === 0) return 0; // Description page
        if (totalPages === 0) return 0;
        // Progress = (pages completed + current page scroll) / total pages
        const pagesCompleted = currentPage - 1; // Pages before current
        const currentPageProgress = scrollRatio; // Progress on current page (0-1)
        return ((pagesCompleted + currentPageProgress) / totalPages) * 100;
    };

    if (error && !book) {
        return (
            <div className="h-screen bg-black flex items-center justify-center text-white">
                <div className="text-center max-w-md p-8">
                    <div className="text-2xl mb-4 text-red-500">Ошибка</div>
                    <div className="text-sm opacity-70">{error}</div>
                    <button
                        onClick={() => navigate('/books', { replace: true })}
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
            className="h-screen flex flex-col overflow-hidden"
            style={{ backgroundColor: colors.bg, color: colors.text }}
        >
            {/* Header */}
            {!immersiveMode && (
                <header
                    className="flex items-center justify-between p-2 sm:p-4 border-b shadow-sm flex-shrink-0 gap-2 transition-all duration-300"
                    style={{ backgroundColor: colors.header, borderColor: 'rgba(0,0,0,0.1)' }}
                >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                            onClick={() => navigate('/books', { replace: true })}
                            className="p-1.5 sm:p-2 rounded-full hover:bg-black/10 transition-colors tv-focusable flex-shrink-0"
                            style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                        >
                            <ArrowLeft size={18} className="sm:w-6 sm:h-6" />
                        </button>
                        <div className="min-w-0 pr-2">
                            <h1 className="font-bold text-xs sm:text-lg truncate leading-tight">{book.title}</h1>
                            <p className="text-[9px] sm:text-xs opacity-60 truncate">{book.author || 'Автор неизвестен'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={toggleFullscreen}
                            className="p-2 rounded-lg bg-black/5 hover:bg-black/10 transition-all tv-focusable"
                            title={isFullscreen ? "Выйти из полноэкранного" : "На весь экран"}
                        >
                            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                        </button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 rounded-lg bg-black/5 hover:bg-black/10 transition-all tv-focusable"
                        >
                            <div className="flex items-center gap-1.5">
                                <Sun size={16} className="sm:w-5 sm:h-5" />
                                <span className="text-[10px] sm:text-sm font-bold uppercase">Темы</span>
                            </div>
                        </button>
                    </div>
                </header>
            )}

            {/* Offline Indicator Banner */}
            {!isOnline && (
                <div className="flex-shrink-0 bg-orange-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-semibold">
                    <WifiOff size={16} />
                    <span>Офлайн режим - работает только кэшированное содержимое</span>
                </div>
            )}

            {/* Content */}
            <main
                ref={contentRef}
                onScroll={handleScroll}
                onClick={toggleImmersive} // Tap content to toggle UI
                className="flex-1 overflow-y-auto px-2 sm:px-8 py-2 sm:py-8 select-none"
                style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.6',
                    fontFamily: "'EB Garamond', Georgia, serif",
                    cursor: 'text'
                }}
            >
                {pageContent ? (
                    <div
                        className="max-w-4xl mx-auto pb-10"
                        style={{ textAlign: 'justify' }}
                        dangerouslySetInnerHTML={{ __html: pageContent }}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center opacity-50">
                            <div className="text-lg mb-2">Загрузка страницы...</div>
                            <div className="text-xs">Страница {currentPage} из {totalPages}</div>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            {!immersiveMode && (
                <div className="flex flex-col flex-shrink-0 z-10 transition-all duration-300">
                    {/* Thin Progress line above footer on mobile */}
                    <div className="w-full h-1 bg-black/5 flex-shrink-0">
                        <div
                            className="h-full bg-blue-500/60 transition-all duration-300"
                            style={{ width: `${calculateTotalProgress()}%` }}
                        ></div>
                    </div>

                    <footer
                        className="flex flex-row items-center justify-between p-2 sm:p-4 border-t shadow-lg gap-2 sm:gap-4"
                        style={{ backgroundColor: colors.header, borderColor: 'rgba(0,0,0,0.1)' }}
                    >
                        <button
                            onClick={handlePrev}
                            disabled={currentPage <= 0}
                            className="flex items-center justify-center gap-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg font-bold transition-all active:scale-95 flex-1 sm:flex-none"
                            style={{
                                backgroundColor: currentPage <= 0 ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.06)',
                                opacity: currentPage <= 0 ? 0.3 : 1,
                                cursor: currentPage <= 0 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <ChevronLeft size={18} className="sm:w-6 sm:h-6" />
                            <span className="text-[11px] sm:text-base">{currentPage > 0 ? 'Назад' : ''}</span>
                        </button>

                        <div className="flex flex-col items-center justify-center px-2">
                            <div className="text-[10px] sm:text-sm font-bold whitespace-nowrap">
                                {currentPage === 0 ? 'Описание' : `${currentPage} / ${totalPages}`}
                            </div>
                            <div className="hidden sm:block w-48 h-1.5 bg-black/10 rounded-full overflow-hidden mt-1">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${calculateTotalProgress()}%` }}
                                ></div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowSettings(true)}
                            className="flex items-center justify-center gap-1 px-3 py-2 sm:px-4 sm:py-3 rounded-lg font-bold transition-all active:scale-95 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                            style={{
                                backgroundColor: 'rgba(0,0,0,0.06)'
                            }}
                        >
                            <Settings size={18} className="sm:w-6 sm:h-6" />
                        </button>

                        <button
                            onClick={handleNext}
                            disabled={currentPage >= totalPages}
                            className="flex items-center justify-center gap-1 px-3 py-2 sm:px-6 sm:py-3 rounded-lg font-bold transition-all active:scale-95 flex-1 sm:flex-none"
                            style={{
                                backgroundColor: currentPage >= totalPages ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.06)',
                                opacity: currentPage >= totalPages ? 0.3 : 1,
                                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <span className="text-[11px] sm:text-base">{currentPage < totalPages ? 'Вперед' : ''}</span>
                            <ChevronRight size={18} className="sm:w-6 sm:h-6" />
                        </button>
                    </footer>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-[2px]"
                    onClick={() => setShowSettings(false)}
                >
                    <div
                        className="w-full sm:max-w-md bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 transform transition-transform animate-in fade-in slide-in-from-bottom-10"
                        style={{
                            backgroundColor: theme === 'night' ? '#1a1a1a' : (theme === 'sepia' ? '#f4ece0' : '#ffffff'),
                            color: theme === 'night' ? '#e0e0e0' : '#5c4636'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold">Настройки</h2>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="p-2 hover:bg-black/5 rounded-full"
                            >
                                <RotateCcw size={20} className="rotate-45" />
                            </button>
                        </div>

                        {/* Font Size */}
                        <div className="mb-8">
                            <label className="text-xs font-bold uppercase opacity-50 block mb-3">Размер шрифта</label>
                            <div className="flex items-center justify-between bg-black/5 rounded-xl p-2">
                                <button
                                    onClick={() => setFontSize(s => Math.max(12, s - 2))}
                                    className="w-12 h-12 flex items-center justify-center hover:bg-black/10 rounded-lg transition-colors"
                                >
                                    <ZoomOut size={24} />
                                </button>
                                <span className="text-xl font-bold">{fontSize}</span>
                                <button
                                    onClick={() => setFontSize(s => Math.min(40, s + 2))}
                                    className="w-12 h-12 flex items-center justify-center hover:bg-black/10 rounded-lg transition-colors"
                                >
                                    <ZoomIn size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Themes */}
                        <div className="mb-4">
                            <label className="text-xs font-bold uppercase opacity-50 block mb-3">Цветовая схема</label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-blue-500 bg-white ring-4 ring-blue-500/10' : 'border-transparent bg-gray-100 hover:bg-gray-200'}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-white border shadow-sm flex items-center justify-center">
                                        <Sun size={18} className="text-orange-500" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-900">Светлая</span>
                                </button>
                                <button
                                    onClick={() => setTheme('sepia')}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === 'sepia' ? 'border-orange-400 bg-[#f4ece0] ring-4 ring-orange-400/10' : 'border-transparent bg-[#ebe2d5] hover:bg-[#e2d7c5]'}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-[#f4ece0] border border-orange-200 shadow-sm flex items-center justify-center">
                                        <Coffee size={18} className="text-orange-700" />
                                    </div>
                                    <span className="text-xs font-bold text-[#5c4636]">Сепия</span>
                                </button>
                                <button
                                    onClick={() => setTheme('night')}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === 'night' ? 'border-blue-400 bg-[#121212] ring-4 ring-blue-400/10' : 'border-transparent bg-zinc-800 hover:bg-zinc-700'}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-[#121212] border border-zinc-700 shadow-sm flex items-center justify-center">
                                        <Moon size={18} className="text-blue-300" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-300">Темная</span>
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowSettings(false)}
                            className="w-full mt-6 py-4 bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
                        >
                            Готово
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
