import React, { useState, useEffect } from 'react';
import './ServerStatus.css';

const ServerStatus = () => {
    const [stats, setStats] = useState(null);
    const [discoveryStatus, setDiscoveryStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('system'); // 'system' or 'discovery'

    // State for editing interval
    const [editingType, setEditingType] = useState(null);
    const [editValue, setEditValue] = useState('');

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

    const fetchDiscoveryStatus = async () => {
        try {
            const response = await fetch('/api/system/discovery-status');
            if (!response.ok) {
                throw new Error('Failed to fetch discovery status');
            }
            const data = await response.json();
            setDiscoveryStatus(data);
        } catch (err) {
            console.error('Error fetching discovery status:', err);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchDiscoveryStatus();
        const interval = setInterval(() => {
            fetchStats();
            fetchDiscoveryStatus();
        }, 5000); // Update every 5 seconds
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

    const formatRelativeTime = (timestamp) => {
        if (!timestamp) return 'Никогда';
        try {
            const date = new Date(timestamp.replace(' ', 'T'));
            const now = new Date();
            const diff = Math.floor((now - date) / 1000); // seconds

            if (diff < 60) return `${diff} сек назад`;
            if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
            if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
            return `${Math.floor(diff / 86400)} дн назад`;
        } catch {
            return timestamp;
        }
    };

    const formatTimeUntil = (timestamp) => {
        if (!timestamp) return 'Не запланировано';
        try {
            const date = new Date(timestamp.replace(' ', 'T'));
            const now = new Date();
            const diff = Math.floor((date - now) / 1000); // seconds

            if (diff < 0) return 'Скоро (менее минуты)';

            // Format precise time
            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const secs = diff % 60;

            let res = 'через ';
            if (hours > 0) res += `${hours} ч `;
            if (minutes > 0) res += `${minutes} мин `;
            if (hours === 0 && minutes === 0) res += `${secs} сек`;

            return res.trim();
        } catch {
            return timestamp;
        }
    };

    const calculateProgress = (lastRun, intervalMinutes) => {
        if (!lastRun || !intervalMinutes) return 0;
        try {
            const last = new Date(lastRun.replace(' ', 'T'));
            const now = new Date();
            const diffSeconds = (now - last) / 1000;
            const intervalSeconds = intervalMinutes * 60;

            let percent = (diffSeconds / intervalSeconds) * 100;
            percent = Math.max(0, Math.min(100, percent));
            return percent;
        } catch {
            return 0;
        }
    };

    const startEditing = (type, currentInterval) => {
        setEditingType(type);
        setEditValue(currentInterval);
    };

    const cancelEditing = () => {
        setEditingType(null);
        setEditValue('');
    };

    const saveInterval = async (title) => {
        const newValue = parseInt(editValue);
        if (!newValue || newValue < 1) {
            alert('Пожалуйста, введите корректное положительное число');
            return;
        }

        try {
            const apiType = title.includes('Аудиокниги') ? 'audiobooks' :
                title.includes('Книги') ? 'books' :
                    'movies';

            const response = await fetch('/api/system/discovery-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: apiType,
                    interval_minutes: newValue
                })
            });

            if (!response.ok) throw new Error('Failed to save settings');

            fetchDiscoveryStatus();
            setEditingType(null);
        } catch (err) {
            console.error(err);
            alert('Ошибка при сохранении: ' + err.message);
        }
    };

    const handleRestart = async (type) => {
        if (!confirm(`Вы уверены, что хотите запустить поиск для: ${type}?`)) return;

        try {
            const apiType = type.includes('Аудиокниги') ? 'audiobooks' :
                type.includes('Книги') ? 'books' :
                    'movies';

            const response = await fetch(`/api/system/discovery-restart/${apiType}`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Failed to trigger restart');

            // Show success feedback if needed, although logs will update soon
            fetchDiscoveryStatus();
            alert('Запуск инициирован! Статус обновится в течение минуты.');
        } catch (err) {
            console.error(err);
            alert('Ошибка при запуске: ' + err.message);
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            'running': { text: 'Работает', color: '#2196f3', icon: '🔵' },
            'idle': { text: 'Ожидание', color: '#4caf50', icon: '🟢' },
            'error': { text: 'Ошибка', color: '#f44336', icon: '🔴' }
        };
        const badge = badges[status] || badges['idle'];
        return (
            <span className="status-badge" style={{ backgroundColor: badge.color }}>
                {badge.icon} {badge.text}
            </span>
        );
    };

    const renderDiscoveryCard = (title, data) => {
        if (!data) return null;

        const progress = calculateProgress(data.last_run, data.interval_minutes);
        const isEditing = editingType === title;

        return (
            <div className="stat-card discovery-card">
                <div className="discovery-header">
                    <h2>{title}</h2>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {getStatusBadge(data.status)}
                        <button
                            className="restart-button"
                            onClick={() => handleRestart(title)}
                            title="Запустить сейчас"
                            disabled={data.status === 'running'}
                        >
                            🔄
                        </button>
                    </div>
                </div>

                <div className="stat-item">
                    <span className="label">Статус:</span>
                    <span className="value">{data.enabled ? '✅ Включено' : '❌ Выключено'}</span>
                </div>

                <div className="stat-item">
                    <span className="label">Интервал:</span>
                    {isEditing ? (
                        <div className="interval-edit-controls">
                            <input
                                type="number"
                                className="interval-input"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                min="1"
                            />
                            <span className="unit">мин</span>
                            <button className="icon-btn save-btn" onClick={() => saveInterval(title)}>💾</button>
                            <button className="icon-btn cancel-btn" onClick={cancelEditing}>❌</button>
                        </div>
                    ) : (
                        <div className="interval-display">
                            <span className="value">Каждые {data.interval_minutes} мин</span>
                            <button
                                className="icon-btn edit-btn"
                                onClick={() => startEditing(title, data.interval_minutes)}
                                title="Изменить интервал"
                            >
                                ✏️
                            </button>
                        </div>
                    )}
                </div>

                <div className="stat-item">
                    <span className="label">Последний запуск:</span>
                    <span className="value">{formatRelativeTime(data.last_run)}</span>
                </div>

                <div className="stat-item">
                    <span className="label">Следующий запуск:</span>
                    <span className="value">{formatTimeUntil(data.next_run)}</span>
                </div>

                {/* Progress Bar */}
                <div className="discovery-progress-container" title={`${Math.round(progress)}% до следующего запуска`}>
                    <div
                        className="discovery-progress-bar"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>

                {data.last_success && (
                    <div className="stat-item">
                        <span className="label">Последнее скачивание:</span>
                        <span className="value" style={{ fontSize: '0.85rem' }}>{data.last_success}</span>
                    </div>
                )}

                {data.recent_activity && data.recent_activity.length > 0 && (
                    <div className="activity-log">
                        <h3>Последняя активность:</h3>
                        <div className="log-entries">
                            {data.recent_activity.slice(-5).reverse().map((entry, idx) => (
                                <div key={idx} className="log-entry">{entry}</div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="server-status-page">
            <h1 className="page-title">Данные Сервера</h1>

            {/* Tab Navigation */}
            <div className="tab-navigation">
                <button
                    className={`tab-button ${activeTab === 'system' ? 'active' : ''}`}
                    onClick={() => setActiveTab('system')}
                >
                    📊 Система
                </button>
                <button
                    className={`tab-button ${activeTab === 'discovery' ? 'active' : ''}`}
                    onClick={() => setActiveTab('discovery')}
                >
                    📥 Автоскачивание
                </button>
            </div>

            {/* System Stats Tab */}
            {activeTab === 'system' && (
                <>
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
                </>
            )}

            {/* Auto-Downloader Status Tab */}
            {activeTab === 'discovery' && discoveryStatus && (
                <div className="stats-grid">
                    {renderDiscoveryCard('📚 Книги', discoveryStatus.books)}
                    {renderDiscoveryCard('🎧 Аудиокниги', discoveryStatus.audiobooks)}
                    {renderDiscoveryCard('🎬 Фильмы', discoveryStatus.movies)}
                </div>
            )}
        </div>
    );
};

export default ServerStatus;
