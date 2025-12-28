// Для книг — открытие читалки в новом окне
export function openBookReader(bookId) {
    if (!bookId) {
        alert("ID книги не определён");
        return;
    }

    const width = Math.min(1200, window.screen.width * 0.9);
    const height = Math.min(900, window.screen.height * 0.9);
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const readerWindow = window.open(
        `/reader.html?bookId=${bookId}`,
        `bookReader_${bookId}`,
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=no,location=no,menubar=no`
    );

    if (!readerWindow) {
        alert("Не удалось открыть окно читалки.\nПроверьте блокировку всплывающих окон в браузере.");
    }
}