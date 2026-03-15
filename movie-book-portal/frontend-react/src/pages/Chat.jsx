import React from 'react';
import ChatWidget from '../components/ChatWidget';

export default function Chat() {
    return (
        <div className="p-2 md:p-6 pb-20 md:pb-6 flex-1 flex flex-col w-full h-[calc(100dvh-70px)] md:h-screen lg:min-h-screen box-border max-w-none">
            <div className="flex-1 w-full h-full min-h-0 flex flex-col">
                <ChatWidget isFullHeight={true} />
            </div>
        </div>
    );
}
