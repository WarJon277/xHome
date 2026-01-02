class BookReader {
    constructor() {
        this.bookId = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.fontSize = 18;
        this.bookTitle = 'Загрузка...';

        this.initElements();
        this.bindEvents();
        this.loadBookInfo();
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

    async loadBookInfo() {
        const urlParams = new URLSearchParams(window.location.search);
        this.bookId = parseInt(urlParams.get('bookId'));

        if (!this.bookId) {
            alert('Книга не найдена');
            window.close();
            return;
        }

        try {
            const response = await fetch(`/books/${this.bookId}`);
            const book = await response.json();
            this.bookTitle = book.title || 'Книга';
            this.titleEl.textContent = this.bookTitle;

            // Загружаем первую страницу
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

        // Прокрутка вверх
        this.contentArea.scrollTop = 0;
    }

    goToPrevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderPage();
        }
    }

    goToNextPage() {
        if (this.currentPage < this.totalPages) {
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
    }

    changeTheme() {
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
    }

exitReader() {
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
}
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
    new BookReader();

    // Полноэкранный режим
    document.documentElement.requestFullscreen?.();
});