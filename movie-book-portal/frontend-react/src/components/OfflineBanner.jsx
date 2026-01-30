import { WifiOff, Book } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OfflineBanner({ cachedBooksCount, onViewCached }) {
    const navigate = useNavigate();

    return (
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-lg shadow-lg mb-6 overflow-hidden">
            <div className="p-4 sm:p-6">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 p-3 bg-white/20 rounded-full">
                        <WifiOff size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold mb-1">Оффлайн режим</h3>
                        <p className="text-sm opacity-90 mb-3">
                            Сервер недоступен. Вы можете читать ранее открытые книги из кэша.
                        </p>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Book size={16} />
                            <span>
                                {cachedBooksCount > 0
                                    ? `Доступно ${cachedBooksCount} ${cachedBooksCount === 1 ? 'книга' : cachedBooksCount < 5 ? 'книги' : 'книг'} оффлайн`
                                    : 'Нет кэшированных книг'}
                            </span>
                        </div>
                    </div>
                </div>

                {cachedBooksCount > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/20">
                        <button
                            onClick={onViewCached}
                            className="w-full sm:w-auto px-6 py-2.5 bg-white text-orange-600 font-bold rounded-lg hover:bg-orange-50 transition-colors active:scale-95 transform"
                        >
                            Показать кэшированные книги
                        </button>
                    </div>
                )}

                {cachedBooksCount === 0 && (
                    <div className="mt-4 pt-4 border-t border-white/20 text-sm opacity-75">
                        💡 Откройте книги когда есть интернет, чтобы читать их оффлайн позже
                    </div>
                )}
            </div>
        </div>
    );
}
