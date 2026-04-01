import { useEffect, useState, useRef } from 'react';

export default function useOnlineCount() {
    const [onlineCount, setOnlineCount] = useState(0);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [wsStatus, setWsStatus] = useState('Init');
    const [debugUrl, setDebugUrl] = useState('');
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);
    const retryDelay = useRef(2000);

    const sendChatMessage = (message) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'chat', message }));
        }
    };

    const [username, setUsernameState] = useState(localStorage.getItem('portal_username'));

    useEffect(() => {
        const handleStorageChange = () => {
            setUsernameState(localStorage.getItem('portal_username'));
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    useEffect(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && username) {
            wsRef.current.send(JSON.stringify({ type: 'register', name: username }));
        }
    }, [username]);

    useEffect(() => {
        function connect() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/online`;

            try {
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;
                setDebugUrl(wsUrl);
                setWsStatus('Connecting...');

                ws.onopen = () => {
                    setWsStatus('Connected');
                    retryDelay.current = 2000;
                    // Send user name upon connection if available
                    const username = localStorage.getItem('portal_username');
                    if (username) {
                        ws.send(JSON.stringify({ type: 'register', name: username }));
                    }
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (typeof data.online === 'number') {
                            setOnlineCount(data.online);
                        }
                        if (Array.isArray(data.users)) {
                            setOnlineUsers(data.users);
                        } else if (Array.isArray(data.ips)) {
                            setOnlineUsers(data.ips.map(ip => ({ ip, name: null })));
                        }
                        
                        // Handle chat messages
                        if (data.type === 'chat_history') {
                            setChatMessages(data.messages || []);
                        } else if (data.type === 'new_chat_message') {
                            if (data.message) {
                                setChatMessages(prev => {
                                    const safePrev = Array.isArray(prev) ? prev : [];
                                    // Prevent duplicate messages by checking ID
                                    if (safePrev.some(m => m.id === data.message.id)) {
                                        return safePrev;
                                    }
                                    const newMsgs = [...safePrev, data.message];
                                    // Keep only last 20 messages
                                    return newMsgs.length > 20 ? newMsgs.slice(-20) : newMsgs;
                                });
                            }
                        }
                    } catch (e) {
                        // ignore
                    }
                };

                ws.onclose = (e) => {
                    setWsStatus(`Closed: ${e.code}`);
                    scheduleReconnect();
                };

                ws.onerror = (e) => {
                    setWsStatus('Error');
                    ws.close();
                };
            } catch (e) {
                setWsStatus(`Exception: ${e.message}`);
                scheduleReconnect();
            }
        }

        function scheduleReconnect() {
            if (reconnectTimer.current) return;
            reconnectTimer.current = setTimeout(() => {
                reconnectTimer.current = null;
                retryDelay.current = Math.min(retryDelay.current * 1.5, 30000);
                connect();
            }, retryDelay.current);
        }

        connect();

        return () => {
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current);
                reconnectTimer.current = null;
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []);

    return { onlineCount, onlineUsers, chatMessages, sendChatMessage, wsStatus, debugUrl };
}
