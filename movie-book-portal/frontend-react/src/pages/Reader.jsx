import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchBook, fetchBookPage } from '../api';
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Moon, Sun, Coffee } from 'lucide-react';

export default function Reader() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [book, setBook] = useState(null);
    const [pageContent, setPageContent] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [fontSize, setFontSize] = useState(20);
    const [theme, setTheme] = useState('sepia');
    const [error, setError] = useState(null);

    const contentRef = useRef(null);

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                console.log('=== Loading book metadata, ID:', id);
                const data = await fetchBook(id);
                console.log('Book metadata received:', data);
                setBook(data);
                if (data.total_pages) {
                    console.log('Setting total pages:', data.total_pages);
                    setTotalPages(data.total_pages);
                }
            } catch (e) {
                console.error("Failed to load book metadata:", e);
                setError(`Ошибка загрузки книги: ${e.message}`);
            }
        };
        loadMetadata();
    }, [id]);

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
                    contentRef.current.scrollTop = 0;
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

        // Rewrite resource URLs
        processed = processed.replace(/(src|href)="([^"]*?)"/gi, (match, attr, url) => {
            if (url && !url.match(/^(http|data:|#)/)) {
                const encoded = url.split('/').map(s => encodeURIComponent(s)).join('/');
                return `${attr}="/books/${bookId}/file_resource/${encoded}"`;
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
                        className="p-2 rounded-full hover:bg-black/10 transition-colors"
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
                        <button onClick={() => setFontSize(s => Math.max(12, s - 2))} className="p-1 sm:p-2 hover:bg-black/10 rounded">
                            <ZoomOut size={18} className="sm:w-5 sm:h-5" />
                        </button>
                        <span className="text-xs sm:text-sm font-bold w-6 sm:w-10 text-center">{fontSize}</span>
                        <button onClick={() => setFontSize(s => Math.min(40, s + 2))} className="p-1 sm:p-2 hover:bg-black/10 rounded">
                            <ZoomIn size={18} className="sm:w-5 sm:h-5" />
                        </button>
                    </div>

                    {/* Theme Selector */}
                    <div className="flex items-center gap-1 bg-black/5 rounded-lg p-1">
                        <button
                            onClick={() => setTheme('light')}
                            className={`p-1.5 sm:p-2 rounded transition-all ${theme === 'light' ? 'bg-white shadow-sm sm:shadow-md' : 'hover:bg-black/10'}`}
                        >
                            <Sun size={18} className="sm:w-5 sm:h-5" />
                        </button>
                        <button
                            onClick={() => setTheme('sepia')}
                            className={`p-1.5 sm:p-2 rounded transition-all ${theme === 'sepia' ? 'bg-white shadow-sm sm:shadow-md' : 'hover:bg-black/10'}`}
                        >
                            <Coffee size={18} className="sm:w-5 sm:h-5" />
                        </button>
                        <button
                            onClick={() => setTheme('night')}
                            className={`p-1.5 sm:p-2 rounded transition-all ${theme === 'night' ? 'bg-white shadow-sm sm:shadow-md' : 'hover:bg-black/10'}`}
                        >
                            <Moon size={18} className="sm:w-5 sm:h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main
                ref={contentRef}
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
                className="flex flex-col sm:flex-row items-center justify-between p-3 sm:p-4 border-t shadow-lg flex-shrink-0 gap-3"
                style={{ backgroundColor: colors.header, borderColor: 'rgba(0,0,0,0.1)' }}
            >
                <div className="flex items-center justify-between w-full sm:hidden mb-2">
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
                    className="flex items-center justify-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-bold transition-all active:scale-95 w-full sm:w-auto"
                    style={{
                        backgroundColor: currentPage <= 1 ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.1)',
                        opacity: currentPage <= 1 ? 0.3 : 1,
                        cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                    }}
                >
                    <ChevronLeft size={20} className="sm:w-6 sm:h-6" /> <span className="text-sm sm:text-base">Назад</span>
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
                    className="flex items-center justify-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-bold transition-all active:scale-95 w-full sm:w-auto"
                    style={{
                        backgroundColor: currentPage >= totalPages ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.1)',
                        opacity: currentPage >= totalPages ? 0.3 : 1,
                        cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                    }}
                >
                    <span className="text-sm sm:text-base">Вперед</span> <ChevronRight size={20} className="sm:w-6 sm:h-6" />
                </button>
            </footer>
        </div>
    );
}
