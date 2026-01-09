import React from 'react';
import { Play, BookOpen, X } from 'lucide-react';

export default function ResumeBanner({ item, onResume, onClose }) {
    if (!item) return null;

    const isBook = item.item_type === 'book';
    const Icon = isBook ? BookOpen : Play;

    // Formatting progress
    let progressText = "";
    if (isBook) {
        progressText = `Страница ${Math.floor(item.progress)}`;
    } else {
        const mins = Math.floor(item.progress / 60);
        const secs = Math.floor(item.progress % 60);
        progressText = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    return (
        <div className="mb-4 animate-in fade-in slide-in-from-top duration-500">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600/90 to-purple-600/90 p-[1px] shadow-lg shadow-blue-500/20">
                <div className="relative flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl bg-[#121212]/90 backdrop-blur-xl p-3 sm:p-4">

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                            <Icon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-medium text-blue-400 uppercase tracking-wider">Продолжить {isBook ? 'чтение' : 'просмотр'}</h3>
                            <p className="text-base font-bold text-white truncate">{item.title}</p>
                            <p className="text-[10px] sm:text-xs text-white/50">{progressText}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                        <button
                            onClick={() => onResume(item)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 font-bold text-white transition-all hover:bg-blue-400 focus:bg-blue-400 focus:scale-105 active:scale-95 shadow-md shadow-blue-500/25 tv-focusable text-sm"
                        >
                            <Icon size={16} />
                            <span>Вернуться</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/70 transition-all hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white active:scale-95 tv-focusable"
                            title="Скрыть"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Background Glow */}
                    <div className="absolute -left-20 -top-20 -z-10 h-40 w-40 rounded-full bg-blue-500/10 blur-[80px]" />
                    <div className="absolute -right-20 -bottom-20 -z-10 h-40 w-40 rounded-full bg-purple-500/10 blur-[80px]" />
                </div>
            </div>
        </div>
    );
}
