import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBooks } from '../api';
import { MediaCard } from '../components/MediaCard';
import '../custom-grid.css';
import { Book } from 'lucide-react';

export default function BooksPage() {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadBooks();
    }, []);

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

    const handleOpenBook = (book) => {
        navigate(`/books/${book.id}`);
    };

    return (
        <div className="p-4 sm:p-6 pb-24">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Book className="text-green-500" /> Книги
                </h1>
                <div className="text-gray-400 text-sm">
                    {books.length} books
                </div>
            </header>

            {loading ? (
                <div className="text-center text-gray-500 mt-10">Загрузка...</div>
            ) : (
                <div className="media-grid">
                    {books.map(book => (
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
