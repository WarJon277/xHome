class BookReader {
    constructor() {
        this.bookId = null;
        this.currentPage = 1;
        this.totalPages = 1;
        // Load settings from localStorage or defaults
        this.fontSize = parseInt(localStorage.getItem('reader_fontSize')) || 18;
        this.bookTitle = 'Загрузка...';

        this.initialProgressLoaded = false;
        this.savedProgress = null;

        this.init();
    }

    async init() {
        this.initElements();
        this.bindEvents();
        this.applySettings();

        const urlParams = new URLSearchParams(window.location.search);
        this.bookId = parseInt(urlParams.get('bookId'));

        if (!this.bookId) {
            alert('Книга не найдена');
            window.close();
            return;
        }

        console.log(`[READER] Initializing book ${this.bookId}`);
        await this.loadProgress();
        await this.loadBookInfo();

        // Periodic save every 10 seconds
        setInterval(() => this.saveProgress(), 10000);
    }

    initElements() {
        this.titleEl = document.getElementById('title');
        this.prevPageBtn = document.getElementById('prev-page');
        this.nextPageBtn = document.getElementById('next-page');
        this.pageInfo = document.getElementById('page-info');
        this.progressBar = document.getElementById('progress-bar');
        this.pdfPageImg = document.getElementById('pdf-page');
        this.textContent = document.getElementById('text-content');
        this.fontSmallerBtn = document.getElementById('font-smaller');
        this.fontLargerBtn = document.getElementById('font-larger');
        this.themeSelector = document.getElementById('theme-selector');
        this.exitReaderBtn = document.getElementById('exit-reader');
        this.readerContainer = document.getElementById('reader-container');
        this.contentArea = document.getElementById('content-area');

        // Scroll event for logging or immediate saving if needed
        this.contentArea.addEventListener('scroll', () => {
            this.lastScrollTime = Date.now();
        });
    }

    bindEvents() {
        this.prevPageBtn.addEventListener('click', () => this.goToPrevPage());
        this.nextPageBtn.addEventListener('click', () => this.goToNextPage());
        this.fontSmallerBtn.addEventListener('click', () => this.changeFontSize(-1));
        this.fontLargerBtn.addEventListener('click', () => this.changeFontSize(1));
        this.themeSelector.addEventListener('change', () => this.changeTheme());
        this.exitReaderBtn.addEventListener('click', () => this.exitReader());

        // Клавиатурная навигация
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.goToPrevPage();
            if (e.key === 'ArrowRight') this.goToNextPage();
            if (e.key === 'Escape') this.exitReader();
        });
    }

    applySettings() {
        // Apply font size
        this.contentArea.style.fontSize = this.fontSize + 'px';

        // Apply theme
        const savedTheme = localStorage.getItem('reader_theme') || 'sepia';

        // Ensure the selector matches the saved theme
        if (this.themeSelector) {
            this.themeSelector.value = savedTheme;
        }

        this.changeTheme(false); // false = don't save again
    }

    async loadBookInfo() {
        try {
            const response = await fetch(`/books/${this.bookId}`);
            const book = await response.json();
            this.bookTitle = book.title || 'Книга';
            this.titleEl.textContent = this.bookTitle;

            // Загружаем текущую страницу (уже установленную в loadProgress)
            await this.renderPage();
        } catch (err) {
            console.error(err);
            this.titleEl.textContent = 'Ошибка загрузки';
        }
    }

    async renderPage() {
        try {
            const response = await fetch(`/books/${this.bookId}/page/${this.currentPage}`);
            const data = await response.json();

            if (response.ok) {
                if (data.content) {
                    // EPUB — текст
                    this.showTextContent(data.content);
                    this.totalPages = data.total || this.totalPages;
                } else {
                    // PDF и др. — изображение
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    this.pdfPageImg.src = url;
                    this.pdfPageImg.style.display = 'block';
                    this.textContent.style.display = 'none';
                }
                this.updatePageInfo();

                // Restore scroll if it's the first load
                if (!this.initialProgressLoaded && this.savedProgress) {
                    console.log(`[READER] Attempting to restore scroll to ratio ${this.savedProgress.scrollRatio}`);

                    // Giving extra time for layout/images to finish
                    const restoreScroll = () => {
                        const maxScroll = this.contentArea.scrollHeight - this.contentArea.clientHeight;
                        const targetScroll = this.savedProgress.scrollRatio * maxScroll;

                        // For images, we might need to wait for onload, but maxScroll > 0 is a good hint content is there
                        if (maxScroll > 0 || this.pdfPageImg.style.display !== 'none') {
                            this.contentArea.scrollTop = targetScroll;
                            console.log(`[READER] Scrolled to ${targetScroll} (max: ${maxScroll})`);
                            this.initialProgressLoaded = true;
                        } else {
                            // Content might not be fully ready, try again once
                            setTimeout(restoreScroll, 200);
                        }
                    };

                    setTimeout(restoreScroll, 150);
                }
            } else {
                throw new Error(data.detail || 'Ошибка');
            }
        } catch (err) {
            this.textContent.innerHTML = `<p style="text-align:center; color:red;">Ошибка загрузки страницы: ${err.message}</p>`;
            this.textContent.style.display = 'block';
            this.pdfPageImg.style.display = 'none';
        }
    }

    showTextContent(content) {
        // Извлекаем body
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        let processedContent = bodyMatch ? bodyMatch[1] : content;

        // Нормализация путей
        function normalizePath(url) {
            url = url.trim();
            if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('#')) return null;

            let parts = url.split('/');
            let stack = [];

            for (let part of parts) {
                if (part === '' || part === '.') continue;
                if (part === '..') {
                    if (stack.length > 0) stack.pop();
                } else {
                    stack.push(part);
                }
            }
            return stack.join('/');
        }

        // Замена src/href
        processedContent = processedContent.replace(/(src|href)="([^"]*?)"/gi, (match, attr, url) => {
            const normalized = normalizePath(url);
            if (normalized === null) return match;
            const encoded = normalized.split('/').map(seg => encodeURIComponent(seg)).join('/');
            return `${attr}="/books/${this.bookId}/file_resource/${encoded}"`;
        });

        // Замена url() в CSS
        processedContent = processedContent.replace(/url\(['"]?([^'"\)]+)['"]?\)/gi, (match, url) => {
            const normalized = normalizePath(url);
            if (normalized === null) return match;
            const encoded = normalized.split('/').map(seg => encodeURIComponent(seg)).join('/');
            return `url("/books/${this.bookId}/file_resource/${encoded}")`;
        });

        this.textContent.innerHTML = processedContent;
        this.textContent.style.display = 'block';
        this.pdfPageImg.style.display = 'none';

        // Scroll to top only if it's NOT the initial load of a saved page
        if (this.initialProgressLoaded) {
            this.contentArea.scrollTop = 0;
        }
    }

    goToPrevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderPage();
        }
    }

    goToNextPage() {
        if (this.currentPage < this.totalPages) {
            this.saveProgress(); // Save before leaving page
            this.currentPage++;
            this.renderPage();
        }
    }

    updatePageInfo() {
        this.pageInfo.textContent = `Стр. ${this.currentPage} из ${this.totalPages}`;
        const progress = (this.currentPage / this.totalPages) * 100;
        this.progressBar.style.width = progress + '%';

        this.prevPageBtn.disabled = this.currentPage <= 1;
        this.nextPageBtn.disabled = this.currentPage >= this.totalPages;
    }

    changeFontSize(delta) {
        this.fontSize = Math.max(14, Math.min(32, this.fontSize + delta));
        this.contentArea.style.fontSize = this.fontSize + 'px';
        localStorage.setItem('reader_fontSize', this.fontSize);
    }

    changeTheme(save = true) {
        const container = this.readerContainer;
        container.classList.remove('theme-light', 'theme-sepia', 'theme-night');

        const theme = this.themeSelector.value;
        if (theme === 'night') {
            container.classList.add('theme-night');
        } else if (theme === 'sepia') {
            container.classList.add('theme-sepia');
        } else {
            container.classList.add('theme-light');
        }

        if (save) {
            localStorage.setItem('reader_theme', theme);
        }
    }

    exitReader() {
        this.saveProgress().then(() => {
            if (window.history.length > 1) {
                window.history.back();
                return;
            }

            // Если истории по какой-то причине нет
            try {
                window.location.replace(document.referrer || '/');
            } catch {
                window.location.replace('/');
            }

            // Дополнительная защита — через 300 мс (иногда помогает на iOS/Android)
            setTimeout(() => {
                if (document.referrer) {
                    window.location.replace(document.referrer);
                }
            }, 300);
        });
    }

    async loadProgress() {
        try {
            console.log(`[READER] Loading progress for book ${this.bookId}`);
            const response = await fetch(`/progress/book/${this.bookId}`);
            if (response.ok) {
                const data = await response.json();
                console.log(`[READER] Found progress:`, data);
                if (data.progress_seconds > 0) {
                    this.currentPage = Math.floor(data.progress_seconds);
                    this.savedProgress = {
                        page: this.currentPage,
                        scrollRatio: data.scroll_ratio || 0
                    };
                }
            }
        } catch (e) {
            console.error('Failed to load progress', e);
        }
    }

    async saveProgress() {
        if (!this.bookId || !this.contentArea) return;

        const scrollTotal = this.contentArea.scrollHeight - this.contentArea.clientHeight;
        const scrollRatio = scrollTotal > 0 ? this.contentArea.scrollTop / scrollTotal : 0;

        try {
            await fetch('/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_type: 'book',
                    item_id: this.bookId,
                    progress_seconds: this.currentPage,
                    scroll_ratio: scrollRatio
                })
            });
        } catch (e) {
            console.error('Failed to save progress', e);
        }
    }
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
    new BookReader();

    // Полноэкранный режим
    document.documentElement.requestFullscreen?.();
});