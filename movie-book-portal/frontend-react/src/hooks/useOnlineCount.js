import { useEffect, useState, useRef } from 'react';

export default function useOnlineCount() {
    const [onlineCount, setOnlineCount] = useState(0);
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);
    const retryDelay = useRef(2000);

    useEffect(() => {
        function connect() {
            // Build WS URL from current page location
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/online`;

            try {
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    retryDelay.current = 2000; // reset on success
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (typeof data.online === 'number') {
                            setOnlineCount(data.online);
                        }
                    } catch (e) {
                        // ignore parse errors
                    }
                };

                ws.onclose = () => {
                    scheduleReconnect();
                };

                ws.onerror = () => {
                    ws.close();
                };
            } catch (e) {
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

    return onlineCount;
}
