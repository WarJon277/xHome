import React, { useState, useEffect } from 'react';
import './ServerStatus.css';

const ServerStatus = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/system/stats');
            if (!response.ok) {
                throw new Error('Failed to fetch system stats');
            }
            const data = await response.json();
            setStats(data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError(err.message);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000); // Update every 5 seconds
        return () => clearInterval(interval);
    }, []);

    if (loading && !stats) return <div className="server-status-container">Загрузка...</div>;
    if (error) return <div className="server-status-container error">Ошибка: {error}</div>;

    if (!stats) return null;

    const formatBytes = (bytes, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const formatUptime = (seconds) => {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        let res = '';
        if (days > 0) res += `${days}д `;
        if (hours > 0) res += `${hours}ч `;
        if (minutes > 0) res += `${minutes}м `;
        if (secs > 0 || res === '') res += `${secs}с`;
        return res;
    };

    return (
        <div className="server-status-page">
            <h1 className="page-title">Данные Сервера</h1>

            {/* System Info Header */}
            <div className="system-info-header">
                <div className="info-item">
                    <span className="label">ОС:</span>
                    <span className="value">{stats.os_info.system} {stats.os_info.release} ({stats.os_info.machine})</span>
                </div>
                <div className="info-item">
                    <span className="label">Имя узла:</span>
                    <span className="value">{stats.os_info.node}</span>
                </div>
                <div className="info-item">
                    <span className="label">Аптайм:</span>
                    <span className="value">{formatUptime(stats.uptime)}</span>
                </div>
            </div>

            <div className="stats-grid">
                {/* CPU Usage */}
                <div className="stat-card">
                    <h2>Процессор (CPU)</h2>
                    <div className="stat-item">
                        <span className="label">Модель:</span>
                        <span className="value" style={{ fontSize: '0.8rem', textAlign: 'right' }}>{stats.os_info.processor}</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Ядра:</span>
                        <span className="value">{stats.cpu_info.physical_cores} физических / {stats.cpu_info.total_cores} логических</span>
                    </div>
                    {stats.cpu_info.frequency && (
                        <div className="stat-item">
                            <span className="label">Частота:</span>
                            <span className="value">{Math.round(stats.cpu_info.frequency.current)} MHz</span>
                        </div>
                    )}
                    <div className="stat-item" style={{ marginTop: '10px' }}>
                        <span className="label">Загрузка:</span>
                        <span className="value">{stats.cpu_percent}%</span>
                    </div>
                    <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${stats.cpu_percent}%`, backgroundColor: stats.cpu_percent > 80 ? '#f44336' : '#ff9800' }}></div>
                    </div>
                </div>

                {/* RAM Usage */}
                <div className="stat-card">
                    <h2>Память (RAM)</h2>
                    <div className="stat-item">
                        <span className="label">Всего:</span>
                        <span className="value">{formatBytes(stats.ram.total)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Использовано:</span>
                        <span className="value">{formatBytes(stats.ram.used)} ({stats.ram.percent}%)</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Свободно:</span>
                        <span className="value">{formatBytes(stats.ram.available)}</span>
                    </div>
                    <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${stats.ram.percent}%`, backgroundColor: stats.ram.percent > 90 ? '#f44336' : '#2196f3' }}></div>
                    </div>

                    <h3>Подкачка (Swap)</h3>
                    <div className="stat-item">
                        <span className="label">Использовано:</span>
                        <span className="value">{formatBytes(stats.swap.used)} ({stats.swap.percent}%)</span>
                    </div>
                    <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${stats.swap.percent}%`, backgroundColor: '#9c27b0', height: '6px' }}></div>
                    </div>
                </div>

                {/* Disk Usage */}
                <div className="stat-card">
                    <h2>Диск ({stats.disk.path})</h2>
                    <div className="stat-item">
                        <span className="label">Всего:</span>
                        <span className="value">{formatBytes(stats.disk.total)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Использовано:</span>
                        <span className="value">{formatBytes(stats.disk.used)} ({stats.disk.percent}%)</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Свободно:</span>
                        <span className="value">{formatBytes(stats.disk.free)}</span>
                    </div>
                    <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${stats.disk.percent}%`, backgroundColor: stats.disk.percent > 90 ? '#f44336' : '#4caf50' }}></div>
                    </div>
                </div>

                {/* Network Stats */}
                <div className="stat-card">
                    <h2>Сеть</h2>
                    <div className="stat-item">
                        <span className="label">Отправлено:</span>
                        <span className="value">{formatBytes(stats.network.bytes_sent)}</span>
                    </div>
                    <div className="stat-item">
                        <span className="label">Получено:</span>
                        <span className="value">{formatBytes(stats.network.bytes_recv)}</span>
                    </div>
                    <div className="stat-item" style={{ marginTop: '10px' }}>
                        <span className="label">Пакетов:</span>
                        <span className="value">↑{stats.network.packets_sent} / ↓{stats.network.packets_recv}</span>
                    </div>
                </div>

                {/* Project Folder */}
                <div className="stat-card">
                    <h2>Папка Проекта</h2>
                    <div className="stat-item">
                        <span className="label">Размер:</span>
                        <span className="value">{formatBytes(stats.project_size)}</span>
                    </div>
                </div>

                {/* Temperature (Optional) */}
                {stats.temperature && Object.keys(stats.temperature).length > 0 && (
                    <div className="stat-card">
                        <h2>Температура</h2>
                        {Object.entries(stats.temperature).map(([name, temp]) => (
                            <div key={name} className="stat-item">
                                <span className="label">{name}:</span>
                                <span className="value">{temp}°C</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ServerStatus;
