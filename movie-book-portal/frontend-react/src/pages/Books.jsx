import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBooks, fetchLatestProgress } from '../api';
import { MediaCard } from '../components/MediaCard';
import ResumeBanner from '../components/ResumeBanner';
import '../custom-grid.css';
import { Book } from 'lucide-react';
import GenreFilter from '../components/GenreFilter';

export default function BooksPage() {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedGenre, setSelectedGenre] = useState('Все');
    const [latestBook, setLatestBook] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadBooks();
        loadLatestProgress();
    }, []);

    const loadLatestProgress = async () => {
        try {
            const data = await fetchLatestProgress('book');
            setLatestBook(data);
        } catch (e) {
            console.error("Failed to fetch latest book progress", e);
        }
    };

    const loadBooks = async () => {
        try {
            const data = await fetchBooks();
            console.log("Books data fetched:", data);
            setBooks(data);
        } catch (err) {
            console.error("Failed to fetch books:", err);
        } finally {
            setLoading(false);
        }
    };

    const genres = useMemo(() => {
        const allGenres = new Set();
        books.forEach(book => {
            if (book.genre) {
                book.genre.split(',').forEach(g => allGenres.add(g.trim()));
            }
        });
        return Array.from(allGenres).sort();
    }, [books]);

    const filteredBooks = useMemo(() => {
        if (selectedGenre === 'Все') return books;
        return books.filter(book => {
            if (!book.genre) return false;
            const itemGenres = book.genre.split(',').map(g => g.trim());
            return itemGenres.includes(selectedGenre);
        });
    }, [books, selectedGenre]);


    const handleOpenBook = (book) => {
        navigate(`/books/${book.id}`);
    };

    return (
        <div className="p-4 sm:p-6 pb-24">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Book className="text-green-500" /> Книги
                </h1>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {filteredBooks.length} books
                </div>
            </header>

            <GenreFilter
                genres={genres}
                selectedGenre={selectedGenre}
                onSelect={setSelectedGenre}
            />

            <ResumeBanner
                item={latestBook}
                onClose={() => setLatestBook(null)}
                onResume={(item) => navigate(`/books/${item.item_id}`)}
            />



            {loading ? (
                <div className="text-center text-gray-500 mt-10">Загрузка...</div>
            ) : (
                <div className="media-grid">
                    {filteredBooks.map(book => (
                        <MediaCard
                            key={book.id}
                            item={book}
                            type="book"
                            onClick={() => handleOpenBook(book)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
