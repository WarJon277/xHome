import { X, AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';

export default function ConfirmationModal({ title, message, onClose, onConfirm, confirmLabel = "Удалить", isDanger = false }) {
    const confirmButtonRef = useRef(null);

    useEffect(() => {
        // Focus cancel or confirm button on mount? usually cancel for safety, but let's do confirm for speed if standard
        if (confirmButtonRef.current) {
            confirmButtonRef.current.focus();
        }
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-scale-in">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="flex flex-col items-center text-center mb-6">
                    {isDanger && (
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500">
                            <AlertTriangle size={24} />
                        </div>
                    )}
                    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{message}</p>
                </div>

                <div className="flex gap-3 justify-center">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-colors font-medium border border-transparent hover:border-white/10"
                    >
                        Отмена
                    </button>
                    <button
                        ref={confirmButtonRef}
                        onClick={onConfirm}
                        className={`flex-1 px-4 py-3 rounded-xl text-white font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 ${isDanger
                                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
