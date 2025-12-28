import { fetchTvshows, fetchEpisodes, getTvshowIdByName } from './api.js';
import { showEpisodesList } from './episodesList.js';

// Для фильмов — открытие видео-плеера
// Открытие видеоплеера в модальном окне
export function openVideoPlayer(filePath, title) {

    if (!filePath) {
        alert("Путь к файлу не указан");
        return;
    }

    // Проверяем, является ли это эпизодом сериала по заголовку
    const isEpisode = title.includes(' - S') && title.includes('E'); // Проверяем формат "Название - SxEy - ..."

    const modal = document.createElement('div');
    modal.id = 'video-modal';
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.95);
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; z-index: 9999; padding: 20px;
        width: 100vw; height: 100vh; box-sizing: border-box;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
        position: absolute; top: 20px; right: 20px; width: 40px; height: 40px;
        background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%;
        font-size: 24px; cursor: pointer; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.5);
    `;
    closeBtn.title = 'Закрыть (Esc)';

    // Создаем контейнер для элементов управления эпизодами, если это эпизод
    let episodeControls = null;
    if (isEpisode) {
        episodeControls = document.createElement('div');
        episodeControls.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            z-index: 10000;
            display: flex;
            gap: 10px;
        `;

        // Извлекаем ID сериала и номера сезона/эпизода из заголовка
        const match = title.match(/(.*) - S(\d+)E(\d+) - (.*)/);
        let tvshowTitle = '';
        let seasonNumber = 0;
        let episodeNumber = 0;
        let episodeTitle = '';
        let tvshowId = null;

        if (match) {
            tvshowTitle = match[1];
            seasonNumber = parseInt(match[2]);
            episodeNumber = parseInt(match[3]);
            episodeTitle = match[4] || `Эпизод ${episodeNumber}`;
        }

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '◀ Предыдущий';
        prevBtn.style.cssText = `
            background: rgba(0,0,0.6);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 14px;
        `;

        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Следующий ▶';
        nextBtn.style.cssText = `
            background: rgba(0,0,0,0.6);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 14px;
        `;

        // Кнопка для открытия списка всех эпизодов
        const allEpisodesBtn = document.createElement('button');
        allEpisodesBtn.textContent = 'Все эпизоды';
        allEpisodesBtn.style.cssText = `
            background: rgba(0,0,0,0.6);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 14px;
        `;

        // Функция для получения ID сериала по названию (упрощенная)
        const getTvshowIdByName = async (name) => {
            try {
                const tvshows = await fetchTvshows();
                const tvshow = tvshows.find(show => show.title === name);
                return tvshow ? tvshow.id : null;
            } catch (error) {
                console.error('Ошибка при получении ID сериала:', error);
                return null;
            }
        };

        // Функция для получения всех эпизодов сериала
        const loadEpisodes = async (tvshowId) => {
            try {
                return await fetchEpisodes(tvshowId);
            } catch (error) {
                console.error('Ошибка при загрузке эпизодов:', error);
                return [];
            }
        };

        // Обработчик для кнопки "Предыдущий"
        prevBtn.onclick = async () => {
            if (!tvshowTitle) return;
            
            const id = await getTvshowIdByName(tvshowTitle);
            if (!id) {
                alert('Не удалось найти сериал');
                return;
            }

            const episodes = await loadEpisodes(id);
            if (episodes.length === 0) {
                alert('Нет доступных эпизодов');
                return;
            }

            // Находим текущий эпизод и предыдущий
            const currentEpisode = episodes.find(ep =>
                ep.season_number === seasonNumber && ep.episode_number === episodeNumber
            );

            if (!currentEpisode) {
                alert('Текущий эпизод не найден');
                return;
            }

            // Находим предыдущий эпизод
            const prevEpisode = episodes.find(ep => {
                if (ep.season_number === seasonNumber) {
                    return ep.episode_number === episodeNumber - 1;
                } else if (ep.season_number === seasonNumber - 1) {
                    // Находим максимальный номер эпизода в предыдущем сезоне
                    const maxEpisodeInPrevSeason = Math.max(...episodes
                        .filter(e => e.season_number === seasonNumber - 1)
                        .map(e => e.episode_number));
                    return ep.episode_number === maxEpisodeInPrevSeason;
                }
                return false;
            }) || episodes
                .filter(ep => ep.season_number < seasonNumber || (ep.season_number === seasonNumber && ep.episode_number < episodeNumber))
                .sort((a, b) => {
                    if (a.season_number !== b.season_number) return b.season_number - a.season_number;
                    return b.episode_number - a.episode_number;
                })[0];

            if (prevEpisode && prevEpisode.file_path) {
                // Закрываем текущий плеер и открываем предыдущий эпизод
                modal.remove();
                openVideoPlayer(prevEpisode.file_path, `${tvshowTitle} - S${prevEpisode.season_number}E${prevEpisode.episode_number} - ${prevEpisode.title || `Эпизод ${prevEpisode.episode_number}`}`);
            } else {
                alert('Предыдущий эпизод не найден или недоступен');
            }
        };

        // Обработчик для кнопки "Следующий"
        nextBtn.onclick = async () => {
            if (!tvshowTitle) return;
            
            const id = await getTvshowIdByName(tvshowTitle);
            if (!id) {
                alert('Не удалось найти сериал');
                return;
            }

            const episodes = await loadEpisodes(id);
            if (episodes.length === 0) {
                alert('Нет доступных эпизодов');
                return;
            }

            // Находим текущий эпизод и следующий
            const currentEpisode = episodes.find(ep =>
                ep.season_number === seasonNumber && ep.episode_number === episodeNumber
            );

            if (!currentEpisode) {
                alert('Текущий эпизод не найден');
                return;
            }

            // Находим следующий эпизод
            const nextEpisode = episodes.find(ep => {
                if (ep.season_number === seasonNumber) {
                    return ep.episode_number === episodeNumber + 1;
                } else if (ep.season_number === seasonNumber + 1) {
                    // Находим минимальный номер эпизода в следующем сезоне
                    const minEpisodeInNextSeason = Math.min(...episodes
                        .filter(e => e.season_number === seasonNumber + 1)
                        .map(e => e.episode_number));
                    return ep.episode_number === minEpisodeInNextSeason;
                }
                return false;
            }) || episodes
                .filter(ep => ep.season_number > seasonNumber || (ep.season_number === seasonNumber && ep.episode_number > episodeNumber))
                .sort((a, b) => {
                    if (a.season_number !== b.season_number) return a.season_number - b.season_number;
                    return a.episode_number - b.episode_number;
                })[0];

            if (nextEpisode && nextEpisode.file_path) {
                // Закрываем текущий плеер и открываем следующий эпизод
                modal.remove();
                openVideoPlayer(nextEpisode.file_path, `${tvshowTitle} - S${nextEpisode.season_number}E${nextEpisode.episode_number} - ${nextEpisode.title || `Эпизод ${nextEpisode.episode_number}`}`);
            } else {
                alert('Следующий эпизод не найден или недоступен');
            }
        };

        // Обработчик для кнопки "Все эпизоды"
        allEpisodesBtn.onclick = async () => {
            if (!tvshowTitle) return;
            
            const id = await getTvshowIdByName(tvshowTitle);
            if (!id) {
                alert('Не удалось найти сериал');
                return;
            }

            // Закрываем текущий плеер и открываем список эпизодов
            modal.remove();
            showEpisodesList(id, tvshowTitle);
        };

        episodeControls.appendChild(prevBtn);
        episodeControls.appendChild(nextBtn);
        episodeControls.appendChild(allEpisodesBtn);
        modal.appendChild(episodeControls);
    }

    const videoContainer = document.createElement('div');
    videoContainer.style.cssText = `
        max-width: 95vw; max-height: 85vh; position: relative;
        width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    `;

    const video = document.createElement('video');
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    video.style.cssText = `
        width: 100%; height: auto; max-height: 85vh; object-fit: contain;
        display: block;
    `;
    
    // Формируем правильный путь к видеофайлу
    // Если путь уже начинается с /, используем как есть
    // Если путь начинается с uploads/, добавляем /
    // Иначе добавляем /uploads/
    let videoSrc;
    if (filePath.startsWith('/')) {
        videoSrc = filePath;
    } else if (filePath.startsWith('uploads/')) {
        videoSrc = `/${filePath}`;
    } else {
        videoSrc = `/uploads/${filePath}`;
    }
    
    // Проверяем существование файла перед загрузкой
    fetch(videoSrc, {method: 'HEAD'}).then(response => {
        if(response.ok) {
            video.src = videoSrc;
            // Initialize Plyr after video source is set
            setTimeout(() => {
                if (window.Plyr) {
                    new Plyr(video, {
                        controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'pip', 'airplay', 'fullscreen'],
                        i18n: {
                            restart: 'Перезапустить',
                            rewind: 'Назад {seektime}s',
                            play: 'Воспроизвести',
                            pause: 'Пауза',
                            fastForward: 'Вперед {seektime}s',
                            seek: 'Перемотать',
                            played: 'Воспроизведено',
                            buffered: 'Буферизовано',
                            currentTime: 'Текущее время',
                            duration: 'Продолжительность',
                            volume: 'Громкость',
                            toggleMute: 'Отключить/включить звук',
                            togglePip: 'Картинка в картинке',
                            toggleFullscreen: 'Полноэкранный режим'
                        }
                    });
                } else {
                    // Fallback to native controls if Plyr is not available
                    video.controls = true;
                }
            }, 100);
        } else {
            alert("Видео файл не найден. Пожалуйста, проверьте наличие файла на сервере.");
            closeModal();
        }
    }).catch(error => {
        console.error("Ошибка при проверке видео файла:", error);
        alert("Ошибка при загрузке видео файла.");
        closeModal();
    });

    videoContainer.appendChild(video);

    const titleEl = document.createElement('h3');
    titleEl.textContent = title || '';
    titleEl.style.cssText = `
        color: white; margin: 15px 0 5px 0; text-align: center; max-width: 90%;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    `;

    modal.append(closeBtn, videoContainer, titleEl);
    document.body.appendChild(modal);

    // Фикс зависания после паузы (без изменений)
    let needReloadOnResume = false;
    video.addEventListener('pause', () => { console.log('Pause'); needReloadOnResume = true; });
    video.addEventListener('play', async () => {
        if (!needReloadOnResume) return;
        needReloadOnResume = false;
        const t = video.currentTime || 0;
        try {
            video.pause(); video.load();
            await new Promise(r => video.addEventListener('canplay', r, {once: true}));
            video.currentTime = t; video.play();
        } catch (e) { console.warn('Resume failed:', e); }
    });
    video.addEventListener('stalled', () => { needReloadOnResume = true; });

    closeBtn.onclick = () => closeModal();
    modal.onclick = e => { if (e.target === modal) closeModal(); };
    
    const escHandler = e => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', escHandler);

    function closeModal() {
        document.removeEventListener('keydown', escHandler);
        if (modal.parentNode) modal.remove();
    }
}

export function getVideoType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const types = {
        mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', ogv: 'video/ogg',
        mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska'
    };
    return types[ext] || 'video/mp4';
}