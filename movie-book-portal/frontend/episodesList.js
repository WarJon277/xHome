import { fetchEpisodes, updateEpisode, deleteEpisode, uploadEpisodeFile } from './api.js';
import { openVideoPlayer } from './videoPlayer.js';

// Функция для отображения списка эпизодов сериала
export async function showEpisodesList(tvshowId, tvshowTitle) {
    try {
        // Загружаем эпизоды для сериала
        const episodes = await fetchEpisodes(tvshowId);

        // Создаем модальное окно для списка эпизодов
        const modal = document.createElement('div');
        modal.id = 'episodes-modal';
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0.9);
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; z-index: 10000; padding: 20px;
            width: 100vw; height: 100vh; box-sizing: border-box;
        `;

        const container = document.createElement('div');
        container.style.cssText = `
            background: #2c3e50;
            border-radius: 8px;
            padding: 20px;
            max-width: 800px;
            max-height: 80vh;
            width: 90%;
            overflow-y: auto;
            position: relative;
        `;

        const title = document.createElement('h2');
        title.textContent = `Эпизоды: ${tvshowTitle}`;
        title.style.cssText = `
            color: white;
            margin-top: 0;
            text-align: center;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute; top: 10px; right: 15px; width: 30px; height: 30px;
            background: #e74c3c; color: white; border: none; border-radius: 50%;
            font-size: 16px; cursor: pointer; z-index: 10001;
        `;
        closeBtn.onclick = () => modal.remove();

        const episodesList = document.createElement('div');
        episodesList.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        `;

        if (episodes.length === 0) {
            const noEpisodes = document.createElement('p');
            noEpisodes.textContent = 'Нет загруженных эпизодов';
            noEpisodes.style.cssText = `
                color: #ecf0f1;
                text-align: center;
                grid-column: 1 / -1;
                font-style: italic;
            `;
            episodesList.appendChild(noEpisodes);
        } else {
            // Удаляем дубликаты эпизодов, если они есть (по комбинации сезона и номера эпизода)
            const uniqueEpisodes = [];
            const seenKeys = new Set();
            episodes.forEach(episode => {
                const key = `${episode.season_number}-${episode.episode_number}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    uniqueEpisodes.push(episode);
                }
            });

            // Группируем уникальные эпизоды по сезонам
            const episodesBySeason = {};
            uniqueEpisodes.forEach(episode => {
                if (!episodesBySeason[episode.season_number]) {
                    episodesBySeason[episode.season_number] = [];
                }
                episodesBySeason[episode.season_number].push(episode);
            });

            // Создаем карточки для каждого сезона
            Object.keys(episodesBySeason).sort((a, b) => parseInt(a) - parseInt(b)).forEach(seasonNum => {
                const seasonDiv = document.createElement('div');
                seasonDiv.style.cssText = `
                    grid-column: 1 / -1;
                    margin-bottom: 20px;
                `;

                const seasonTitle = document.createElement('h3');
                seasonTitle.textContent = `Сезон ${seasonNum}`;
                seasonTitle.style.cssText = `
                    color: #3498db;
                    margin: 0 10px 0;
                    border-bottom: 1px solid #3498db;
                    padding-bottom: 5px;
                `;
                seasonDiv.appendChild(seasonTitle);

                const seasonEpisodes = document.createElement('div');
                seasonEpisodes.style.cssText = `
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                `;

                episodesBySeason[seasonNum].sort((a, b) => a.episode_number - b.episode_number).forEach(episode => {
                    const episodeCard = document.createElement('div');
                    episodeCard.className = 'episode-card';
                    episodeCard.style.cssText = `
                        background: #34495e;
                        border-radius: 5px;
                        padding: 10px;
                        min-width: 150px;
                        cursor: pointer;
                        transition: background 0.3s;
                        border: 1px solid #4a5f7a;
                    `;
                    episodeCard.onmouseover = () => episodeCard.style.background = '#3d566e';
                    episodeCard.onmouseout = () => episodeCard.style.background = '#34495e';

                    const episodeTitle = document.createElement('div');
                    episodeTitle.textContent = `Эпизод ${episode.episode_number}`;
                    episodeTitle.style.cssText = `
                        color: #ecf0f1;
                        font-weight: bold;
                        margin-bottom: 5px;
                    `;

                    const episodeSubtitle = document.createElement('div');
                    episodeSubtitle.textContent = episode.title || `Эпизод ${episode.episode_number}`;
                    episodeSubtitle.style.cssText = `
                        color: #bdc3c7;
                        font-size: 0.9em;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    `;

                    episodeCard.appendChild(episodeTitle);
                    episodeCard.appendChild(episodeSubtitle);

                    // Обработчик клика для воспроизведения эпизода
                    episodeCard.addEventListener('click', (e) => {
                        // Проверяем, был ли клик по кнопке редактирования, чтобы не открывать плеер
                        if (e.target.tagName === 'BUTTON') {
                            return;
                        }

                        if (episode.file_path) {
                            // Закрываем модальное окно эпизодов перед открытием плеера
                            const episodesModal = document.getElementById('episodes-modal');
                            if (episodesModal) {
                                episodesModal.remove();
                            }
                            openVideoPlayer(
                                episode.file_path,
                                `${tvshowTitle} - S${episode.season_number}E${episode.episode_number} - ${episode.title || `Эпизод ${episode.episode_number}`}`,
                                {
                                    tvshowId: tvshowId,
                                    seasonNumber: episode.season_number,
                                    episodeNumber: episode.episode_number,
                                    episodeTitle: episode.title || `Эпизод ${episode.episode_number}`
                                }
                            );
                        } else {
                            alert(`Файл для этого эпизода ещё не загружен`);
                        }
                    });

                    // Создаем контейнер для кнопок действия
                    const actionButtons = document.createElement('div');
                    actionButtons.style.cssText = `
                        display: flex;
                        gap: 5px;
                        margin-top: 8px;
                    `;

                    // Кнопка редактирования эпизода
                    const editBtn = document.createElement('button');
                    editBtn.textContent = '✏';
                    editBtn.title = 'Редактировать эпизод';
                    editBtn.style.cssText = `
                        background: #3498db;
                        color: white;
                        border: none;
                        border-radius: 3px;
                        padding: 3px 6px;
                        font-size: 12px;
                        cursor: pointer;
                        flex: 1;
                    `;
                    editBtn.onclick = (e) => {
                        e.stopPropagation(); // Останавливаем всплытие, чтобы не вызвать проигрывание
                        editEpisode(episode, tvshowId);
                    };

                    // Кнопка удаления эпизода
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = '🗑';
                    deleteBtn.title = 'Удалить эпизод';
                    deleteBtn.style.cssText = `
                        background: #e74c3c;
                        color: white;
                        border: none;
                        border-radius: 3px;
                        padding: 3px 6px;
                        font-size: 12px;
                        cursor: pointer;
                        flex: 1;
                    `;
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation(); // Останавливаем всплытие, чтобы не вызвать проигрывание
                        if (confirm(`Удалить эпизод "${episode.title || `Эпизод ${episode.episode_number}`}"?`)) {
                            deleteEpisodeById(episode.id, episodeCard, tvshowId);
                        }
                    };

                    actionButtons.appendChild(editBtn);
                    actionButtons.appendChild(deleteBtn);
                    episodeCard.appendChild(actionButtons);

                    seasonEpisodes.appendChild(episodeCard);
                });

                seasonDiv.appendChild(seasonEpisodes);
                episodesList.appendChild(seasonDiv);
            });
        }

        container.appendChild(closeBtn);
        container.appendChild(title);
        container.appendChild(episodesList);
        modal.appendChild(container);
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Ошибка при загрузке эпизодов:', error);
        alert('Ошибка при загрузке списка эпизодов');
    }
}

// Функция для редактирования эпизода
async function editEpisode(episode, tvshowId) {
    // Открываем модальное окно для редактирования эпизода
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.8);
        display: flex; align-items: center; justify-content: center;
        z-index: 10001; padding: 20px; box-sizing: border-box;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
        background: #2c3e50;
        border-radius: 8px;
        padding: 20px;
        width: 90%;
        max-width: 500px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;

    const title = document.createElement('h3');
    title.textContent = `Редактировать эпизод: ${episode.title || `Эпизод ${episode.episode_number}`}`;
    title.style.cssText = `
        color: white;
        margin-top: 0;
        text-align: center;
    `;

    const form = document.createElement('form');
    form.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 15px;
    `;

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = episode.title || `Эпизод ${episode.episode_number}`;
    titleInput.placeholder = 'Название эпизода';
    titleInput.style.cssText = `
        padding: 10px;
        border-radius: 4px;
        border: 1px solid #555;
        background: #34495e;
        color: white;
    `;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'video/*,.mp4,.avi,.mov,.mkv,.wmv,.flv,.webm';
    fileInput.style.cssText = `
        padding: 10px;
        border-radius: 4px;
        border: 1px solid #555;
        background: #34495e;
        color: white;
    `;

    const fileLabel = document.createElement('label');
    fileLabel.textContent = 'Заменить файл эпизода (необязательно):';
    fileLabel.style.color = 'white';

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-top: 15px;
    `;

    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.textContent = 'Сохранить';
    saveBtn.style.cssText = `
        flex: 1;
        padding: 10px;
        background: #3498db;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.style.cssText = `
        flex: 1;
        padding: 10px;
        background: #7f8c8d;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    cancelBtn.onclick = () => modal.remove();

    form.appendChild(titleInput);
    form.appendChild(fileLabel);
    form.appendChild(fileInput);
    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);
    form.appendChild(buttonContainer);

    container.appendChild(title);
    container.appendChild(form);
    modal.appendChild(container);
    document.body.appendChild(modal);

    form.onsubmit = async (e) => {
        e.preventDefault();
        try {
            // Обновляем данные эпизода
            const updatedData = {
                tvshow_id: episode.tvshow_id,
                season_number: episode.season_number,
                episode_number: episode.episode_number,
                title: titleInput.value,
                description: episode.description || ""
            };

            await updateEpisode(episode.id, updatedData);

            // Если выбран файл, загружаем его
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                await uploadEpisodeFile(episode.id, file);
                alert('Эпизод и файл успешно обновлены!');
            } else {
                alert('Эпизод успешно обновлён!');
            }

            // Закрываем модальное окно
            modal.remove();

            // Перезагружаем модальное окно с обновленными данными
            const episodesModal = document.getElementById('episodes-modal');
            // Получаем заголовок сериала из заголовка модального окна перед его удалением
            const modalTitle = episodesModal ? episodesModal.querySelector('h2')?.textContent || '' : '';
            const tvshowName = modalTitle ? modalTitle.replace('Эпизоды: ', '') : '';
            if (episodesModal) {
                episodesModal.remove();
            }
            showEpisodesList(tvshowId, tvshowName || `TV Show ${tvshowId}`);
        } catch (error) {
            console.error('Ошибка при обновлении эпизода:', error);
            alert('Ошибка при обновлении эпизода');
        }
    };
}

// Функция для удаления эпизода по ID
async function deleteEpisodeById(episodeId, episodeCard, tvshowId) {
    try {
        await deleteEpisode(episodeId);
        // Удаляем элемент из DOM
        episodeCard.remove();
        alert('Эпизод успешно удалён!');
    } catch (error) {
        console.error('Ошибка при удалении эпизода:', error);
        alert('Ошибка при удалении эпизода');
    }
}