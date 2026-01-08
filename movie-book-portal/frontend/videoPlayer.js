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
    modal.id = 'video-modal'; // Critical for tvNavigation.js to detect this as a modal
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

    // ─── PROGRESS TRACKING ---------------
    let progressInterval;

    // Function to save progress
    const saveProgress = async () => {
        if (!metadata || !metadata.type || (!metadata.id && !metadata.episodeId)) return;
        if (!video || !video.currentTime) return;

        const type = metadata.type;
        const id = type === 'movie' ? metadata.id : metadata.episodeId;

        if (!id) return;

        try {
            await fetch('/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_type: type,
                    item_id: id,
                    progress_seconds: video.currentTime
                })
            });
        } catch (e) {
            console.error('Failed to save progress', e);
        }
    };

    // ─── TV DETECTION ────────────────────────
    const isTV = () => {
        const ua = navigator.userAgent.toLowerCase();
        return /tv|web0s|tizen|smarttv|bravia|viera|netcast/.test(ua);
    };

    // ─── КОНТЕЙНЕР ДЛЯ КНОПОК (поверх видео) ────────
    // Создаем оверлей для ВСЕХ устройств, включая ТВ
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        zIndex: '10000' // Ensure it's above video
    });

    // Добавляем элементы управления эпизодами
    const episodeControls = createEpisodeControls(title, modal, video, metadata);
    episodeControls.style.pointerEvents = 'auto'; // Кнопки должны быть кликабельны

    // Для ТВ делаем кнопки покрупнее и явно видимыми
    if (isTV()) {
        episodeControls.querySelectorAll('button').forEach(btn => {
            btn.style.padding = '15px 25px';
            btn.style.fontSize = '18px';
            btn.style.margin = '10px';
            btn.style.border = '2px solid transparent'; // Для фокуса

            // Add focus styles specifically for this button
            btn.addEventListener('focus', () => {
                btn.style.borderColor = '#3498db';
                btn.style.transform = 'scale(1.1)';
                btn.style.background = 'rgba(50, 50, 150, 0.9)';
            });
            btn.addEventListener('blur', () => {
                btn.style.borderColor = 'transparent';
                btn.style.transform = 'scale(1)';
                btn.style.background = 'rgba(0,0,0,0.7)';
            });
        });
    }

    overlay.appendChild(episodeControls);

    // Кнопка закрытия (показываем всегда, но на ТВ можно скрыть если мешает, пока оставим)
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: '2147483647',
        width: '60px',
        height: '60px',
        background: 'rgba(200, 0, 0, 0.8)',
        color: 'white',
        border: '2px solid white',
        borderRadius: '50%',
        fontSize: '30px',
        cursor: 'pointer',
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 10px rgba(0,0,0,0.5)'
    });

    closeBtn.onclick = () => {
        saveProgress();
        modal.remove();
    };

    if (isTV()) {
        // На ТВ кнопку закрытия можно сделать прозрачнее или убрать фокус по умолчанию
        closeBtn.style.opacity = '0.7';
    }

    overlay.appendChild(closeBtn);

    // Добавляем оверлей в модальное окно (оно контейнер)
    modal.append(video, overlay);

    if (isTV()) {
        // Добавляем подсказку про выход для ТВ
        const hint = document.createElement('div');
        hint.textContent = 'Нажмите НАЗАД для выхода';
        Object.assign(hint.style, {
            position: 'absolute',
            bottom: '20px', // Внизу
            right: '20px',
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            padding: '10px',
            zIndex: 20000,
            pointerEvents: 'none',
            fontSize: '14px',
            borderRadius: '4px'
        });
        overlay.appendChild(hint); // В оверлей
        // Скрываем подсказку через 5 сек
        setTimeout(() => hint.remove(), 5000);
    }

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
            video.addEventListener('loadedmetadata', async () => {
                // Скрываем лоадер при успешной загрузке метаданных
                // Only hide if minimum display time has passed
                if (!minimumLoaderDisplay) {
                    loader.classList.add('hidden');
                }

                // Инициализация Native Player вместо Plyr для лучшей совместимости с ТВ
                video.controls = true;

                // Auto-Fullscreen logic (Only for TV)
                // isTV defined in parent scope
                const enterFullscreen = () => {
                    if (!isTV()) return;

                    try {
                        // Request fullscreen on the MODAL (container), not just video
                        // This allows custom overlays to be visible
                        if (modal.requestFullscreen) modal.requestFullscreen();
                        else if (modal.webkitRequestFullscreen) modal.webkitRequestFullscreen();
                        else if (modal.msRequestFullscreen) modal.msRequestFullscreen();
                        else if (video.requestFullscreen) video.requestFullscreen(); // Fallback to video only
                    } catch (err) {
                        console.warn("Fullscreen request failed", err);
                    }
                };

                // RESUME LOGIC
                if (metadata && (metadata.type === 'movie' || metadata.type === 'episode')) {
                    const type = metadata.type;
                    const id = type === 'movie' ? metadata.id : metadata.episodeId;

                    if (id) {
                        try {
                            const progRes = await fetch(`/progress/${type}/${id}`);
                            const progData = await progRes.json();
                            const savedTime = progData.progress_seconds;

                            if (savedTime > 10 && savedTime < (video.duration - 30)) {
                                // Make resume button
                                const resumeOverlay = document.createElement('div');
                                Object.assign(resumeOverlay.style, {
                                    position: 'absolute',
                                    inset: '0',
                                    background: 'rgba(0,0,0,0.85)',
                                    zIndex: '10020',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white'
                                });

                                const timeStr = new Date(savedTime * 1000).toISOString().substr(11, 8).replace(/^00:/, '');

                                resumeOverlay.innerHTML = `
                                    <h3 style="margin-bottom:20px">Продолжить просмотр?</h3>
                                    <p style="margin-bottom:30px;color:#ccc">Вы остановились на ${timeStr}</p>
                                    <div style="display:flex;gap:20px">
                                        <button id="resume-yes" style="padding:10px 20px;background:#3498db;border:none;border-radius:5px;color:white;font-size:16px;cursor:pointer">Да, продолжить</button>
                                        <button id="resume-no" style="padding:10px 20px;background:#555;border:none;border-radius:5px;color:white;font-size:16px;cursor:pointer">Начать сначала</button>
                                    </div>
                                `;
                                modal.appendChild(resumeOverlay);

                                // Focus 'Yes' button for TV
                                requestAnimationFrame(() => document.getElementById('resume-yes')?.focus());

                                document.getElementById('resume-yes').onclick = () => {
                                    video.currentTime = savedTime;
                                    video.play().then(enterFullscreen).catch(console.error);
                                    resumeOverlay.remove();
                                    video.focus();
                                };
                                document.getElementById('resume-no').onclick = () => {
                                    video.currentTime = 0;
                                    video.play().then(enterFullscreen).catch(console.error);
                                    resumeOverlay.remove();
                                    video.focus();
                                };
                            } else {
                                video.play().then(enterFullscreen).catch(console.error);
                                video.focus();
                            }
                        } catch (e) {
                            console.error('Error fetching progress', e);
                            video.play().then(enterFullscreen).catch(console.error);
                            video.focus();
                        }
                    } else {
                        video.play().then(enterFullscreen).catch(console.error);
                        video.focus();
                    }
                } else {
                    video.play().then(enterFullscreen).catch(console.error);
                    video.focus();
                }

                // Save interval
                progressInterval = setInterval(saveProgress, 5000);

                // Добавляем обработчики событий для показа/скрытия элементов управления эпизодами
                video.addEventListener('play', () => {
                    episodeControls.style.opacity = '0';
                    episodeControls.style.pointerEvents = 'none';
                });

                video.addEventListener('pause', () => {
                    saveProgress();
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
    // Esc & Back button handler
    const closeHandler = () => {
        saveProgress();
        modal.remove();
        clearInterval(progressInterval);
        document.removeEventListener('keydown', keyHandler);
        // Restore focus to last element?
    };

    const keyHandler = e => {
        if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'BrowserBack') {
            e.preventDefault();
            closeHandler();
        }
        // Redirect arrows to video if not focusing controls
        // Plyr manages focus well usually, but we might want to ensure it.
    };
    document.addEventListener('keydown', keyHandler);

    // document keyHandler handles closure for both TV and Desktop (Esc/Back)

    // Only attach click handler if button exists (non-TV mode)
    // Variable closeBtn is not in scope here if we wrapped it in if(!isTV) block above. 
    // Wait, in previous step I wrapped closeBtn creation in if(!isTV).
    // So 'closeBtn' is not defined here! This will throw ReferenceError.

    // We need to fix this reference error.
    // Ideally, we shouldn't reference 'closeBtn' here at all.
    // The click handler was allocated inside the if block in my instruction above.
    // So we just remove this line.

    // Auto-focus video to enable Plyr shortcuts (arrows for seek/volume)
    // But we also have our overlay controls.
    // If we want Plyr to handle arrows, video or container needs focus.
    setTimeout(() => {
        video.focus();
    }, 100);
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
                        episodeTitle: nextEp.title,
                        episodeId: nextEp.id,
                        type: 'episode'
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
                        episodeTitle: prevEp.title,
                        episodeId: prevEp.id,
                        type: 'episode'
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