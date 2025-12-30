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

    // ─── ВИДЕО ───────────────────────────────
    const video = document.createElement('video');
    Object.assign(video.style, {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        background: '#111',
        maxWidth: '100vw',
        maxHeight: '100vh'
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

    // Добавляем элементы управления эпизодами (они должны быть кликабельными)
    const episodeControls = createEpisodeControls(title, modal, video);
    episodeControls.style.pointerEvents = 'auto';  // делаем элементы управления кликабельными
    overlay.appendChild(episodeControls);

    // Кнопка закрытия также должна быть кликабельной
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

    // Добавляем кнопку закрытия
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
                    const player = new Plyr(video, {
                        controls: [
                            'play-large', 'play', 'progress', 'current-time',
                            'duration', 'mute', 'volume', 'fullscreen'
                        ],
                        fullscreen: { enabled: true, iosNative: true }
                    });
                    
                    // Добавляем обработчики событий для показа/скрытия элементов управления эпизодами
                    video.addEventListener('play', () => {
                        episodeControls.style.opacity = '0';
                        episodeControls.style.pointerEvents = 'none';
                    });
                    
                    video.addEventListener('pause', () => {
                        episodeControls.style.opacity = '1';
                        episodeControls.style.pointerEvents = 'auto';
                    });
                    
                    // Также скрываем элементы управления при перемотке
                    video.addEventListener('seeking', () => {
                        episodeControls.style.opacity = '0';
                        episodeControls.style.pointerEvents = 'none';
                    });
                    
                    video.addEventListener('seeked', () => {
                        // Возвращаем элементы управления через небольшую задержку после перемотки
                        setTimeout(() => {
                            if (!video.paused) {
                                episodeControls.style.opacity = '0';
                                episodeControls.style.pointerEvents = 'none';
                            } else {
                                episodeControls.style.opacity = '1';
                                episodeControls.style.pointerEvents = 'auto';
                            }
                        }, 30);
                    });
                    
                    // Обработчики событий для показа/скрытия элементов управления эпизодами
                }
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

function createEpisodeControls(title, modal, video) {
    // Проверяем, является ли видео эпизодом сериала (содержит S##E## в названии)
    const isEpisode = /S(\d+)E(\d+)/i.test(title);
    
    // Если это не эпизод сериала, не создаем элементы управления эпизодами
    if (!isEpisode) {
        const container = document.createElement('div');
        container.style.display = 'none'; // Скрываем контейнер, если это не эпизод
        return container;
    }
    
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

    // Функция для извлечения информации о текущем эпизоде из заголовка
    function extractEpisodeInfo(title) {
        // Регулярное выражение для поиска S(сезон)E(эпизод)
        const match = title.match(/S(\d+)E(\d+)/i);
        if (match) {
            return {
                season: parseInt(match[1]),
                episode: parseInt(match[2])
            };
        }
        return null;
    }
    
    // Получаем ID сериала и информацию о текущем эпизоде
    let currentTvshowId = null;
    let currentEpisodeInfo = null;
    
    // Инициализация при создании элемента
    extractTvshowIdFromTitle(title).then(tvshowId => {
        if (tvshowId) {
            currentTvshowId = tvshowId;
            currentEpisodeInfo = extractEpisodeInfo(title);
        }
    });

    // Функция для получения списка эпизодов
    async function getEpisodes(tvshowId) {
        try {
            const episodes = await fetchEpisodes(tvshowId);
            // Группируем эпизоды по сезонам и сортируем
            const episodesBySeason = {};
            episodes.forEach(ep => {
                if (!episodesBySeason[ep.season_number]) {
                    episodesBySeason[ep.season_number] = [];
                }
                episodesBySeason[ep.season_number].push(ep);
            });
            
            // Сортируем эпизоды в каждом сезоне
            Object.keys(episodesBySeason).forEach(season => {
                episodesBySeason[season].sort((a, b) => a.episode_number - b.episode_number);
            });
            
            return episodesBySeason;
        } catch (error) {
            console.error('Ошибка при получении списка эпизодов:', error);
            return {};
        }
    }

    // Функция для перехода к следующему эпизоду
    async function goToNextEpisode() {
        if (!currentTvshowId || !currentEpisodeInfo) return;
        
        const episodesBySeason = await getEpisodes(currentTvshowId);
        const seasons = Object.keys(episodesBySeason).map(Number).sort((a, b) => a - b);
        
        let nextEpisode = null;
        
        // Ищем следующий эпизод
        for (let i = 0; i < seasons.length; i++) {
            const seasonNum = seasons[i];
            const seasonEpisodes = episodesBySeason[seasonNum];
            
            if (seasonNum === currentEpisodeInfo.season) {
                // Ищем в текущем сезоне
                for (let j = 0; j < seasonEpisodes.length; j++) {
                    if (seasonEpisodes[j].episode_number === currentEpisodeInfo.episode) {
                        // Нашли текущий эпизод, проверяем следующий
                        if (j + 1 < seasonEpisodes.length) {
                            nextEpisode = seasonEpisodes[j + 1];
                        } else {
                            // Если это последний эпизод в сезоне, ищем первый в следующем сезоне
                            if (i + 1 < seasons.length) {
                                const nextSeason = seasons[i + 1];
                                nextEpisode = episodesBySeason[nextSeason][0];
                            }
                        }
                        break;
                    }
                }
                break;
            }
        }
        
        if (nextEpisode && nextEpisode.file_path) {
            // Закрываем текущий модальный элемент
            modal.remove();
            // Открываем следующий эпизод
            setTimeout(() => {
                openVideoPlayer(nextEpisode.file_path, `${extractShowName(title)} - S${nextEpisode.season_number}E${nextEpisode.episode_number} - ${nextEpisode.title || `Эпизод ${nextEpisode.episode_number}`}`);
            }, 100); // Добавляем небольшую задержку для корректного закрытия предыдущего модального окна
        } else {
            alert('Следующий эпизод не найден');
        }
    }

    // Функция для перехода к предыдущему эпизоду
    async function goToPrevEpisode() {
        if (!currentTvshowId || !currentEpisodeInfo) return;
        
        const episodesBySeason = await getEpisodes(currentTvshowId);
        const seasons = Object.keys(episodesBySeason).map(Number).sort((a, b) => a - b);
        
        let prevEpisode = null;
        
        // Ищем предыдущий эпизод
        for (let i = seasons.length - 1; i >= 0; i--) {
            const seasonNum = seasons[i];
            const seasonEpisodes = episodesBySeason[seasonNum];
            
            if (seasonNum === currentEpisodeInfo.season) {
                // Ищем в текущем сезоне
                for (let j = seasonEpisodes.length - 1; j >= 0; j--) {
                    if (seasonEpisodes[j].episode_number === currentEpisodeInfo.episode) {
                        // Нашли текущий эпизод, проверяем предыдущий
                        if (j - 1 >= 0) {
                            prevEpisode = seasonEpisodes[j - 1];
                        } else {
                            // Если это первый эпизод в сезоне, ищем последний в предыдущем сезоне
                            if (i - 1 >= 0) {
                                const prevSeason = seasons[i - 1];
                                const prevSeasonEpisodes = episodesBySeason[prevSeason];
                                prevEpisode = prevSeasonEpisodes[prevSeasonEpisodes.length - 1];
                            }
                        }
                        break;
                    }
                }
                break;
            }
        }
        
        if (prevEpisode && prevEpisode.file_path) {
            // Закрываем текущий модальный элемент
            modal.remove();
            // Открываем предыдущий эпизод
            setTimeout(() => {
                openVideoPlayer(prevEpisode.file_path, `${extractShowName(title)} - S${prevEpisode.season_number}E${prevEpisode.episode_number} - ${prevEpisode.title || `Эпизод ${prevEpisode.episode_number}`}`);
            }, 100); // Добавляем небольшую задержку для корректного закрытия предыдущего модального окна
        } else {
            alert('Предыдущий эпизод не найден');
        }
    }

    // Обновляем обработчики после инициализации
    prevBtn.onclick = async () => {
        // Убедимся, что данные инициализированы
        if (!currentTvshowId) {
            const tvshowId = await extractTvshowIdFromTitle(title);
            if (tvshowId) {
                currentTvshowId = tvshowId;
            }
        }
        if (!currentEpisodeInfo) {
            currentEpisodeInfo = extractEpisodeInfo(title);
        }
        goToPrevEpisode();
    };
    
    nextBtn.onclick = async () => {
        // Убедимся, что данные инициализированы
        if (!currentTvshowId) {
            const tvshowId = await extractTvshowIdFromTitle(title);
            if (tvshowId) {
                currentTvshowId = tvshowId;
            }
        }
        if (!currentEpisodeInfo) {
            currentEpisodeInfo = extractEpisodeInfo(title);
        }
        goToNextEpisode();
    };

    listBtn.onclick = async () => {
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