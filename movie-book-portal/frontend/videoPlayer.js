// videoPlayer.js
import { fetchTvshows, fetchEpisodes } from './api.js';
import { showEpisodesList } from './episodesList.js';

/**
 * Открывает полноэкранный видеоплеер в модальном окне
 * @param {string} filePath - путь к видеофайлу
 * @param {string} title - заголовок видео (используется для определения эпизода)
 */

/**
 * Открывает полноэкранный видеоплеер в модальном окне
 * @param {string} filePath - путь к видеофайлу
 * @param {string} title - заголовок видео
 * @param {object|null} metadata - метаданные эпизода { tvshowId, seasonNumber, episodeNumber, episodeTitle }
 */
export function openVideoPlayer(filePath, title = '', metadata = null) {
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
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    });

    // ─── LOADER ───────────────────────────────
    const loader = document.createElement('div');
    loader.className = 'video-loader';
    loader.innerHTML = `
        <div class="video-loader-spinner"></div>
        <div class="video-loader-text">Загрузка видео...</div>
    `;
    modal.appendChild(loader);

    // Ensure loader is visible initially
    requestAnimationFrame(() => {
        if (loader && loader.classList.contains('hidden')) {
            loader.classList.remove('hidden');
        }
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
    // Pass metadata directly
    const episodeControls = createEpisodeControls(title, modal, video, metadata);
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
    // Ensure loader is visible immediately after modal is added to DOM
    if (loader && loader.classList.contains('hidden')) {
        loader.classList.remove('hidden');
    }

    // Set a minimum loader display time to ensure user sees the loading indicator
    let minimumLoaderDisplay = true;
    setTimeout(() => {
        minimumLoaderDisplay = false;
        // If all other conditions allow hiding the loader, hide it now
        const canHideLoader =
            video.readyState >= video.HAVE_CURRENT_DATA &&
            !video.seeking &&
            !video.waiting;
        if (canHideLoader) {
            loader.classList.add('hidden');
        }
    }, 500); // Show loader for at least 500ms

    fetch(videoSrc, { method: 'HEAD' })
        .then(res => {
            if (!res.ok) throw new Error(`Видео не найдено: ${res.status}`);

            video.src = videoSrc;
            video.load();

            // Ждём, пока видео сможет играть
            video.addEventListener('loadedmetadata', () => {
                // Скрываем лоадер при успешной загрузке метаданных
                // Only hide if minimum display time has passed
                if (!minimumLoaderDisplay) {
                    loader.classList.add('hidden');
                }

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

                }
            }, { once: true });

            // Показываем лоадер при начале загрузки
            video.addEventListener('loadstart', () => {
                if (!minimumLoaderDisplay) {
                    loader.classList.remove('hidden');
                }
            });

            // Скрываем лоадер при начале воспроизведения
            video.addEventListener('playing', () => {
                // Only hide if minimum display time has passed
                if (!minimumLoaderDisplay) {
                    loader.classList.add('hidden');
                }
            });

            // Показываем лоадер при ожидании данных
            video.addEventListener('waiting', () => {
                loader.classList.remove('hidden');
            });

            // Скрываем лоадер при приостановке ожидания
            video.addEventListener('canplay', () => {
                // Only hide if minimum display time has passed
                if (!minimumLoaderDisplay) {
                    loader.classList.add('hidden');
                }
            });
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
        background: rgba(0,0,0.7);
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

function createEpisodeControls(title, modal, video, metadata) {
    // metadata = { tvshowId, seasonNumber, episodeNumber, episodeTitle }
    // Если метаданных нет, пробуем старый способ (но мы хотим перевести всё на метаданные)
    const isEpisode = metadata || /S(\d+)E(\d+)/i.test(title);

    // Если это не эпизод сериала, не создаем элементы управления эпизодами
    if (!isEpisode) {
        const container = document.createElement('div');
        container.style.display = 'none'; // Скрываем контейнер
        return container;
    }

    const container = document.createElement('div');
    container.style.cssText = `
        position: absolute;
        top: 16px;
        left: 16px;
        right: 16px;
        z-index: 10010;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
    `;

    const btnStyle = `
        background: rgba(0,0,0,0.7);
        color: white;
        border: none;
        border-radius: 6px;
        padding: 12px 16px;
        font-size: 14px;
        cursor: pointer;
        backdrop-filter: blur(6px);
        transition: background 0.2s;
        flex: 1;
        min-width: 120px;
        max-width: 160px;
        margin: 5px;
    `;

    // Дополнительные стили для мобильных устройств
    if (window.innerWidth <= 768) {
        container.style.top = '10px';
        container.style.left = '10px';
        container.style.right = '10px';
        container.style.gap = '8px';
    }

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀ Предыдущий';
    prevBtn.style.cssText = btnStyle;

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Следующий ▶';
    nextBtn.style.cssText = btnStyle;

    const listBtn = document.createElement('button');
    listBtn.textContent = 'Список эпизодов';
    listBtn.style.cssText = btnStyle;

    // Используем предоставленные метаданные или пытаемся извлечь (fallback)
    const tvshowId = metadata?.tvshowId;
    const currentSeason = metadata?.seasonNumber;
    const currentEpisode = metadata?.episodeNumber;

    // Функция для получения списка эпизодов
    async function getEpisodes(tid) {
        try {
            const episodes = await fetchEpisodes(tid);
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
        if (!tvshowId) return;

        const episodesBySeason = await getEpisodes(tvshowId);
        const seasons = Object.keys(episodesBySeason).map(Number).sort((a, b) => a - b);

        let nextEp = null;

        // Find next logic
        // ... (Similar logic, simplified) ...
        for (let i = 0; i < seasons.length; i++) {
            const seasonNum = seasons[i];
            const seasonEpisodes = episodesBySeason[seasonNum];

            if (seasonNum === currentSeason) {
                // Ищем в текущем сезоне
                for (let j = 0; j < seasonEpisodes.length; j++) {
                    if (seasonEpisodes[j].episode_number === currentEpisode) {
                        if (j + 1 < seasonEpisodes.length) {
                            nextEp = seasonEpisodes[j + 1];
                        } else {
                            // First of next season
                            if (i + 1 < seasons.length) {
                                nextEp = episodesBySeason[seasons[i + 1]][0];
                            }
                        }
                        break;
                    }
                }
                break;
            }
        }

        if (nextEp && nextEp.file_path) {
            modal.remove();
            setTimeout(() => {
                openVideoPlayer(
                    nextEp.file_path,
                    `${title.split(' - ')[0]} - S${nextEp.season_number}E${nextEp.episode_number} - ${nextEp.title}`,
                    {
                        tvshowId: tvshowId,
                        seasonNumber: nextEp.season_number,
                        episodeNumber: nextEp.episode_number,
                        episodeTitle: nextEp.title
                    }
                );
            }, 100);
        } else {
            alert('Следующий эпизод не найден');
        }
    }

    // Функция для перехода к предыдущему эпизоду
    async function goToPrevEpisode() {
        if (!tvshowId) return;

        const episodesBySeason = await getEpisodes(tvshowId);
        const seasons = Object.keys(episodesBySeason).map(Number).sort((a, b) => a - b);

        let prevEp = null;

        for (let i = seasons.length - 1; i >= 0; i--) {
            const seasonNum = seasons[i];
            const seasonEpisodes = episodesBySeason[seasonNum];

            if (seasonNum === currentSeason) {
                for (let j = seasonEpisodes.length - 1; j >= 0; j--) {
                    if (seasonEpisodes[j].episode_number === currentEpisode) {
                        if (j - 1 >= 0) {
                            prevEp = seasonEpisodes[j - 1];
                        } else {
                            // Last of previous season
                            if (i - 1 >= 0) {
                                const prevSeas = seasons[i - 1];
                                const prevSeasEps = episodesBySeason[prevSeas];
                                prevEp = prevSeasEps[prevSeasEps.length - 1];
                            }
                        }
                        break;
                    }
                }
                break;
            }
        }

        if (prevEp && prevEp.file_path) {
            modal.remove();
            setTimeout(() => {
                openVideoPlayer(
                    prevEp.file_path,
                    `${title.split(' - ')[0]} - S${prevEp.season_number}E${prevEp.episode_number} - ${prevEp.title}`,
                    {
                        tvshowId: tvshowId,
                        seasonNumber: prevEp.season_number,
                        episodeNumber: prevEp.episode_number,
                        episodeTitle: prevEp.title
                    }
                );
            }, 100);
        } else {
            alert('Предыдущий эпизод не найден');
        }
    }

    // Обновляем обработчики после инициализации
    // Функция для обработки переключения эпизода с защитой от быстрых кликов
    const handleEpisodeSwitch = async (switchFunction) => {
        // Добавляем небольшую задержку для предотвращения быстрых кликов
        prevBtn.disabled = true;
        nextBtn.disabled = true;

        setTimeout(() => {
            prevBtn.disabled = false;
            nextBtn.disabled = false;
        }, 800);

        switchFunction();
    };

    prevBtn.onclick = () => handleEpisodeSwitch(goToPrevEpisode);
    nextBtn.onclick = () => handleEpisodeSwitch(goToNextEpisode);

    // Добавляем touch события для мобильных устройств
    const addTouch = (btn) => {
        btn.addEventListener('touchstart', (e) => {
            // e.preventDefault(); // Don't prevent default everywhere or click might not fire
            btn.classList.add('pressed');
        });
        btn.addEventListener('touchend', (e) => {
            // e.preventDefault();
            setTimeout(() => btn.classList.remove('pressed'), 150);
        });
    };
    addTouch(prevBtn);
    addTouch(nextBtn);
    addTouch(listBtn);

    // Добавляем стили для состояния нажатия кнопок
    if (!document.getElementById('pressed-style')) {
        const style = document.createElement('style');
        style.id = 'pressed-style';
        style.textContent = `
            button.pressed {
                background: rgba(50, 50, 150, 0.9) !important;
                transform: scale(0.95);
            }
        `;
        document.head.appendChild(style);
    }

    listBtn.onclick = async () => {
        if (tvshowId) {
            modal.remove();
            showEpisodesList(tvshowId, title.split(' - ')[0] || 'TV Show');
        } else {
            alert("Не удалось определить ID сериала");
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

// ────────────────────────────────────────────────────────
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