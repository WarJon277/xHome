import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, MessageSquare } from 'lucide-react';
import useOnlineCount from '../hooks/useOnlineCount';
import { useUser } from '../contexts/UserContext';

const EMOJIS = ['👍', '😂', '🔥', '❤️', '🎉', '👋', '🎬', '🍿', '💡', '🤔'];

export default function ChatWidget({ isFullHeight = false }) {
    const { chatMessages = [], sendChatMessage } = useOnlineCount();
    const { username } = useUser();
    const [inputValue, setInputValue] = useState('');
    const [showEmojis, setShowEmojis] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;
        
        sendChatMessage(inputValue.trim());
        setInputValue('');
        setShowEmojis(false);
    };

    const addEmoji = (emoji) => {
        setInputValue(prev => prev + emoji);
        setShowEmojis(false);
    };

    // Format time from ISO string
    const formatTime = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className={`flex flex-col ${isFullHeight ? 'h-full' : 'h-[400px]'} bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative`}>
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MessageSquare size={20} className="text-blue-400" />
                    <h3 className="font-bold text-lg">Общий чат</h3>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {chatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
                        <MessageSquare size={32} className="opacity-50" />
                        <p className="text-sm">Нет сообщений. Будьте первым!</p>
                    </div>
                ) : (
                    chatMessages.map((msg, i) => {
                        const isMe = msg.sender_name === username;
                        return (
                            <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-xs font-bold text-gray-400">
                                        {msg.sender_name || 'Аноним'}
                                    </span>
                                    <span className="text-[10px] text-gray-500">
                                        {formatTime(msg.timestamp)}
                                    </span>
                                </div>
                                <div className={`px-4 py-2 rounded-2xl max-w-[85%] break-words ${
                                    isMe 
                                        ? 'bg-blue-600/80 text-white rounded-tr-sm border border-blue-500/30' 
                                        : 'bg-white/10 text-gray-100 rounded-tl-sm border border-white/5'
                                }`}>
                                    {msg.message}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-black/40 border-t border-white/10 relative">
                {/* Emoji Picker Popup */}
                {showEmojis && (
                    <div className="absolute bottom-full left-3 mb-2 bg-[#2a2a2a] border border-white/10 rounded-xl p-2 shadow-xl grid grid-cols-5 gap-2 animate-fade-in-up">
                        {EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                type="button"
                                onClick={() => addEmoji(emoji)}
                                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/10 rounded-lg transition-colors"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
                
                <form onSubmit={handleSend} className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowEmojis(!showEmojis)}
                        className="p-2 text-gray-400 hover:text-yellow-400 transition-colors bg-white/5 rounded-full hover:bg-white/10 shrink-0"
                    >
                        <Smile size={20} />
                    </button>
                    
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Сообщение..."
                        maxLength={200}
                        className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500"
                    />
                    
                    <button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-gray-600 text-white rounded-full transition-colors flex items-center justify-center gap-2 font-medium shrink-0 flex-none"
                    >
                        <span className="hidden sm:inline">Отправить</span>
                        <Send size={16} className="translate-x-[-1px] translate-y-[1px]" />
                    </button>
                </form>
            </div>
        </div>
    );
}
