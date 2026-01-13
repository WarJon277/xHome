import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function InputModal({ title, initialValue = "", placeholder = "", onClose, onConfirm, confirmLabel = "Подтвердить" }) {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(value);
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-scale-in">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <h3 className="text-xl font-bold text-white mb-6">{title}</h3>

                <form onSubmit={handleSubmit}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 mb-6 transition-all"
                    />

                    <div className="flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            disabled={!value.trim()}
                            className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow-lg hover:shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
