import React from 'react';
import ChatWidget from '../components/ChatWidget';

export default function Chat() {
    return (
        <div className="flex-1 flex flex-col w-full h-[calc(100dvh-64px-2rem)] md:h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-6rem)] box-border max-w-none">
            <h1 className="text-3xl font-bold mb-4 text-white text-shadow-sm flex-none hidden md:block">
                Общий Чат
            </h1>
            <div className="flex-1 w-full min-h-0 flex flex-col box-border">
                <ChatWidget isFullHeight={true} />
            </div>
        </div>
    );
}
