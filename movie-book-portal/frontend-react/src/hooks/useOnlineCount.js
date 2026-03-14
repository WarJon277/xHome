import { useEffect, useState, useRef } from 'react';

export default function useOnlineCount() {
    const [onlineCount, setOnlineCount] = useState(0);
    const [onlineIps, setOnlineIps] = useState([]);
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);
    const retryDelay = useRef(2000);

    useEffect(() => {
        function connect() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/online`;

            try {
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    retryDelay.current = 2000;
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (typeof data.online === 'number') {
                            setOnlineCount(data.online);
                        }
                        if (Array.isArray(data.ips)) {
                            setOnlineIps(data.ips);
                        }
                    } catch (e) {
                        // ignore
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

    return { onlineCount, onlineIps };
}
