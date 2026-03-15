import React from 'react';
import ChatWidget from '../components/ChatWidget';

export default function Chat() {
    return (
        <div className="p-4 md:p-8 h-[calc(100vh-80px)] md:h-screen flex flex-col">
            <h1 className="text-3xl font-bold mb-4 md:mb-6 text-white text-shadow-sm flex-none">
                Общий Чат
            </h1>
            <div className="flex-1 min-h-0 w-full max-w-4xl mx-auto">
                <ChatWidget isFullHeight={true} />
            </div>
        </div>
    );
}
