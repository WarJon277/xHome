// videoPlayer.js
import { fetchTvshows, fetchEpisodes } from './api.js';
import { showEpisodesList } from './episodesList.js';

/**
 * Открывает полноэкранный видеоплеер в модальном окне
 * @param {string} filePath - путь к видеофайлу
 * @param {string} title - заголовок видео (используется для определения эпизода)
 */
export function openVideoPlayer(filePath, title = '') {
    if (!filePath) {
        alert('Путь к видеофайлу не указан');
        return;
    }

    // Нормализация пути
    let videoSrc = filePath;
    if (!videoSrc.startsWith('/')) {
        videoSrc = videoSrc.startsWith('uploads/') 
            ? `/${videoSrc}` 
            : `/uploads/${videoSrc}`;
    }

    const modal = document.createElement('div');
    Object.assign(modal.style, {
        position: 'fixed',
        inset: '0',
        background: '#000',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    });

    // ─── ВИДЕО ───────────────────────────────────────
    const video = document.createElement('video');
    Object.assign(video.style, {
        width: '100%',
        height: '100%',
        objectFit: 'contain',           // ← начни с contain, потом можно cover
        background: '#111'
    });

    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    video.muted = false;  // ← важно для автозапуска на некоторых устройствах

    // ─── КОНТЕЙНЕР ДЛЯ КНОПОК (поверх видео) ────────
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none'           // пропускает клики к видео
    });

    // Кнопка закрытия
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: '10010',
        width: '48px',
        height: '48px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        fontSize: '24px',
        cursor: 'pointer',
        pointerEvents: 'auto'
    });

    closeBtn.onclick = () => modal.remove();

    // Добавляем элементы
    overlay.appendChild(closeBtn);
    modal.append(video, overlay);

    document.body.appendChild(modal);

    // ─── Загрузка видео + Plyr ───────────────────────
    fetch(videoSrc, { method: 'HEAD' })
        .then(res => {
            if (!res.ok) throw new Error(`Видео не найдено: ${res.status}`);
            
            video.src = videoSrc;
            video.load();

            // Ждём, пока видео сможет играть
            video.addEventListener('loadedmetadata', () => {
                // Инициализация Plyr
                if (window.Plyr) {
                    new Plyr(video, {
                        controls: [
                            'play-large', 'play', 'progress', 'current-time',
                            'duration', 'mute', 'volume', 'fullscreen'
                        ],
                        fullscreen: { enabled: true, iosNative: true }
                    });
                } else {
                    video.controls = true;
                }
            }, { once: true });
        })
        .catch(err => {
            console.error(err);
            alert('Ошибка загрузки видео\n' + err.message);
            modal.remove();
        });

    // Esc для закрытия
    const escHandler = e => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// ────────────────────────────────────────────────────────────────
// Вспомогательные функции
// ────────────────────────────────────────────────────────────────

function createCloseButton() {
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.title = 'Закрыть (Esc)';
    btn.style.cssText = `
        position: absolute;
        top: 16px;
        right: 16px;
        z-index: 10010;
        width: 48px;
        height: 48px;
        background: rgba(0,0,0,0.7);
        color: #fff;
        border: none;
        border-radius: 50%;
        font-size: 24px;
        cursor: pointer;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        transition: all 0.18s ease;
    `;
    
    btn.onmouseenter = () => (btn.style.background = 'rgba(220,20,60,0.85)');
    btn.onmouseleave = () => (btn.style.background = 'rgba(0,0,0,0.7)');
    
    return btn;
}

function createEpisodeControls(title, modal) {
    const container = document.createElement('div');
    container.style.cssText = `
        position: absolute;
        top: 16px;
        left: 16px;
        z-index: 10010;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    `;

    const btnStyle = `
        background: rgba(0,0,0,0.7);
        color: white;
        border: none;
        border-radius: 6px;
        padding: 9px 16px;
        font-size: 14px;
        cursor: pointer;
        backdrop-filter: blur(6px);
        transition: background 0.2s;
    `;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀ Предыдущий';
    prevBtn.style.cssText = btnStyle;

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Следующий ▶';
    nextBtn.style.cssText = btnStyle;

    const listBtn = document.createElement('button');
    listBtn.textContent = 'Список эпизодов';
    listBtn.style.cssText = btnStyle;

    // Здесь должна быть ваша логика перехода к другим эпизодам
    // (оставлена заглушка — вставьте вашу реализацию)
    prevBtn.onclick = () => alert('Предыдущий эпизод (логика не реализована в примере)');
    nextBtn.onclick  = () => alert('Следующий эпизод (логика не реализована в примере)');
    listBtn.onclick  = async () => {
        const tvshowId = await extractTvshowIdFromTitle(title);
        if (tvshowId) {
            modal.remove();
            showEpisodesList(tvshowId, extractShowName(title));
        }
    };

    container.append(prevBtn, nextBtn, listBtn);
    return container;
}

function createVideoElement(filePath) {
    const video = document.createElement('video');
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    video.style.cssText = `
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;           /* ← самое важное изменение! */
        background: #111;
        /* object-fit: contain; */   /* ← закомментируй или удали */
    `;

    // Нормализация пути
    let src = filePath;
    if (!src.startsWith('/')) {
        src = src.startsWith('uploads/') ? `/${src}` : `/uploads/${src}`;
    }

    // Проверка доступности файла + загрузка
    fetch(src, { method: 'HEAD' })
        .then(res => {
            if (!res.ok) throw new Error('Video not found');
            video.src = src;
            initializePlayer(video);
        })
        .catch(() => {
            alert('Не удалось загрузить видео\nФайл не найден или недоступен');
            document.getElementById('video-modal')?.remove();
        });

    return video;
}

function initializePlayer(video) {
    setTimeout(() => {
        if (window.Plyr) {
            new Plyr(video, {
                controls: [
                    'play-large', 'play', 'progress', 'current-time', 'duration',
                    'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
                ],
                fullscreen: { enabled: true, iosNative: true },
                i18n: {
                    play: 'Воспроизвести',
                    pause: 'Пауза',
                    seek: 'Перемотка',
                    played: 'Просмотрено',
                    buffered: 'Буферизация',
                    currentTime: 'Текущее время',
                    duration: 'Длительность',
                    volume: 'Громкость',
                    toggleMute: 'Без звука',
                    toggleFullscreen: 'Полный экран'
                }
            });
        } else {
            video.controls = true;
        }
    }, 50);
}

function createTitleElement(title) {
    if (!title) return document.createElement('div'); // пустой

    const el = document.createElement('div');
    el.textContent = title;
    el.style.cssText = `
        position: absolute;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        color: rgba(255,255,255,0.9);
        font-size: 1.05rem;
        padding: 8px 24px;
        background: rgba(0,0,0,0.65);
        border-radius: 10px;
        max-width: 92%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        pointer-events: none;
        backdrop-filter: blur(8px);
    `;
    return el;
}

function setupCloseHandlers(modal, closeBtn) {
    closeBtn.onclick = closeModal;
    modal.onclick = e => {
        if (e.target === modal) closeModal();
    };

    const escHandler = e => {
        if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler, { once: true });

    function closeModal() {
        document.removeEventListener('keydown', escHandler);
        modal.remove();
    }
}

function setupVideoResumeFix(video) {
    let needReload = false;

    video.addEventListener('pause', () => {
        needReload = true;
    });

    video.addEventListener('play', async () => {
        if (!needReload) return;
        needReload = false;

        const currentTime = video.currentTime;

        try {
            video.pause();
            video.load();
            await new Promise(resolve => {
                video.oncanplay = resolve;
            });
            video.currentTime = currentTime;
            video.play().catch(console.warn);
        } catch (e) {
            console.warn('Не удалось восстановить воспроизведение', e);
        }
    });
}

// ────────────────────────────────────────────────────────────────
// Утилиты для работы с сериалами (пример)
// ────────────────────────────────────────────────────────────────

function extractShowName(title) {
    const match = title.match(/^(.*?)(?:\s*-?\s*S\d+E\d+)/i);
    return match ? match[1].trim() : title;
}

async function extractTvshowIdFromTitle(title) {
    const showName = extractShowName(title);
    try {
        const shows = await fetchTvshows();
        const show = shows.find(s => s.title.toLowerCase() === showName.toLowerCase());
        return show?.id || null;
    } catch (e) {
        console.error('Не удалось получить ID сериала:', e);
        return null;
    }
}