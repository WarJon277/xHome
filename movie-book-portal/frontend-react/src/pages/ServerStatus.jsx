import React, { useState, useEffect } from 'react';
import './ServerStatus.css';

const ServerStatus = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchStats = async () => {
        try {
            // Assuming the frontend routes /api requests to backend
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

    if (loading && !stats) return <div className="server-status-container">Loading...</div>;
    if (error) return <div className="server-status-container error">Error: {error}</div>;

    if (!stats) return null;

    const formatBytes = (bytes, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    return (
        <div className="server-status-page">
            <h1 className="page-title">Статус Сервера</h1>

            <div className="stats-grid">
                {/* Disk Usage */}
                <div className="stat-card">
                    <h2>Жесткий Диск</h2>
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
                        <div className="progress-bar" style={{ width: `${stats.disk.percent}%`, backgroundColor: stats.disk.percent > 90 ? 'red' : '#4caf50' }}></div>
                    </div>
                </div>

                {/* RAM Usage */}
                <div className="stat-card">
                    <h2>ОЗУ (RAM)</h2>
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
                        <div className="progress-bar" style={{ width: `${stats.ram.percent}%`, backgroundColor: stats.ram.percent > 90 ? 'red' : '#2196f3' }}></div>
                    </div>
                </div>

                {/* CPU Usage */}
                <div className="stat-card">
                    <h2>Процессор (CPU)</h2>
                    <div className="stat-item">
                        <span className="label">Загрузка:</span>
                        <span className="value">{stats.cpu_percent}%</span>
                    </div>
                    <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${stats.cpu_percent}%`, backgroundColor: stats.cpu_percent > 90 ? 'red' : '#ff9800' }}></div>
                    </div>

                    {stats.temperature && Object.keys(stats.temperature).length > 0 && (
                        <div className="temperatures">
                            <h3>Температура</h3>
                            {Object.entries(stats.temperature).map(([name, temp]) => (
                                <div key={name} className="stat-item">
                                    <span className="label">{name}:</span>
                                    <span className="value">{temp}°C</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Project Folder */}
                <div className="stat-card">
                    <h2>Папка Проекта</h2>
                    <div className="stat-item">
                        <span className="label">Размер:</span>
                        <span className="value">{formatBytes(stats.project_size)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServerStatus;
