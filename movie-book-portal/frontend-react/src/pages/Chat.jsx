import React from 'react';
import ChatWidget from '../components/ChatWidget';

export default function Chat() {
    return (
        <div className="fixed inset-x-0 bottom-0 top-[64px] z-40 bg-[#121212] md:static md:top-auto md:z-auto md:flex-1 md:bg-transparent flex flex-col w-full h-[calc(100dvh-64px)] md:h-[calc(100vh-4rem)] lg:h-[calc(100vh-6rem)] box-border">
            <div className="flex-1 w-full min-h-0 flex flex-col md:max-w-4xl mx-auto md:pb-6">
                <h1 className="text-3xl font-bold mb-4 text-white text-shadow-sm flex-none hidden md:block">
                    Общий Чат
                </h1>
                <div className="flex-1 w-full min-h-0 flex flex-col box-border">
                    <ChatWidget isFullHeight={true} />
                </div>
            </div>
        </div>
    );
}
