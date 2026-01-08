document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadThemeSettings();

    document.getElementById('theme-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        saveTheme();
    });

    document.getElementById('reset-theme').addEventListener('click', resetTheme);


    // Add Form Handler
    document.getElementById('admin-add-form').addEventListener('submit', handleAddSubmit);

    // Initial toggle
    toggleCategoryInputs();
});

// Global var for editing
let currentEditingId = null;

function showAddForm() {
    document.getElementById('content-list-view').style.display = 'none';
    document.getElementById('content-add-view').style.display = 'block';
}

function hideAddForm() {
    document.getElementById('content-list-view').style.display = 'block';
    document.getElementById('content-add-view').style.display = 'none';
    document.getElementById('admin-add-form').reset();
    currentEditingId = null; // Reset editing state
    document.getElementById('form-submit-btn').innerText = "Добавить";
    document.getElementById('add-form-title').innerText = "Добавить новый элемент";
    toggleCategoryInputs();
    document.getElementById('progress-container').style.display = 'none';
}

window.editAdminItem = async (category, id) => {
    try {
        const mapping = { 'movies': 'movie', 'books': 'book', 'tvshows': 'tvshow' };
        // Reverse mapping logic if needed, but here category is likely 'movies' etc from loadContent('movies')
        // Actually loadContent is called with 'movies', 'books', 'tvshows'.
        // But the select input values are 'movie', 'book', 'tvshow'.
        const endpoint = category;
        const selectVal = category === 'movies' ? 'movie' : category === 'books' ? 'book' : 'tvshow';

        const res = await fetch(`/${endpoint}/${id}`);
        if (!res.ok) throw new Error("Failed to fetch item details");
        const item = await res.json();

        // Populate Form
        document.getElementById('category').value = selectVal;
        toggleCategoryInputs(); // update visibility

        document.getElementById('title').value = item.title || '';
        document.getElementById('year').value = item.year || '';
        document.getElementById('description').value = item.description || '';
        document.getElementById('director-author').value = item.director || item.author || '';
        // Rating/Genre if exist in form
        const ratingInput = document.getElementById('rating');
        if (ratingInput && item.rating) ratingInput.value = item.rating;

        const genreInput = document.getElementById('genre');
        if (genreInput && item.genre) genreInput.value = item.genre;
        // genre select logic is tricky in admin.js as it doesn't seem to fetch genres dynamically in the snippet shown?
        // Wait, admin.js DOES NOT show genre input in the form structure I saw earlier.
        // Let's re-read admin.js snippet. It has:
        /*
            title, year, description, director-author
        */
        // It hardcodes genre="General" in handleAddSubmit.

        currentEditingId = id;
        document.getElementById('form-submit-btn').innerText = "Сохранить изменения";
        document.getElementById('add-form-title').innerText = "Редактирование элемента";

        showAddForm();

    } catch (e) {
        console.error(e);
        alert("Ошибка при загрузке данных для редактирования");
    }
};

window.toggleCategoryInputs = () => {
    const cat = document.getElementById('category').value;
    const singleContainer = document.getElementById('single-file-container');
    const episodesContainer = document.getElementById('episodes-container');

    if (cat === 'tvshow') {
        singleContainer.style.display = 'none';
        episodesContainer.style.display = 'block';
    } else {
        singleContainer.style.display = 'block';
        episodesContainer.style.display = 'none';
    }
};

function updateProgressBar(percent, text) {
    const container = document.getElementById('progress-container');
    const bar = document.getElementById('progress-bar');
    const txt = document.getElementById('progress-text');

    container.style.display = 'block';
    bar.style.width = percent + '%';
    txt.textContent = text ? `${text} (${percent}%)` : `${percent}%`;
}

function uploadFileXHR(url, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                const percent = Math.round((e.loaded / e.total) * 100);
                onProgress(percent);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => reject(new Error("Network error"));

        const fd = new FormData();
        fd.append('file', file);
        xhr.send(fd);
    });
}

async function handleAddSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('form-submit-btn'); // Use ID directly
    const originalText = btn.innerText;
    btn.disabled = true;

    try {
        const category = document.getElementById('category').value;
        const mapping = { 'movie': 'movies', 'book': 'books', 'tvshow': 'tvshows' };
        const endpoint = mapping[category];

        const data = {
            title: document.getElementById('title').value,
            year: document.getElementById('year').value ? parseInt(document.getElementById('year').value) : null,
            description: document.getElementById('description').value,
            director: document.getElementById('director-author').value, // Used for Director or Author
            author: document.getElementById('director-author').value,
            genre: document.getElementById('genre').value || "General",
            rating: document.getElementById('rating').value ? parseFloat(document.getElementById('rating').value) : 0
        };

        // 1. Create OR Update Main Item
        if (currentEditingId) {
            btn.innerText = "Обновление записи...";
            const updateRes = await fetch(`/${endpoint}/${currentEditingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!updateRes.ok) throw new Error("Failed to update item");
            const updatedItem = await updateRes.json();
            var id = updatedItem.id; // var to match scope

            // For updates, we only upload files if user selected them
            // Logic below handles files if input is not empty.

        } else {
            btn.innerText = "Создание записи...";
            const createRes = await fetch(`/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!createRes.ok) throw new Error("Failed to create item");
            const createdItem = await createRes.json();
            var id = createdItem.id;
        }

        // 2. Handle File Uploads
        if (category === 'tvshow') {
            // Multi-episode upload
            const fileInput = document.getElementById('episodes');
            const files = fileInput.files;
            const seasonNum = parseInt(document.getElementById('season-num').value) || 1;

            if (files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const episodeNum = i + 1;
                    btn.innerText = `Загрузка эпизода ${i + 1}/${files.length}...`;

                    // Create Episode
                    const epData = {
                        tvshow_id: id,
                        season_number: seasonNum,
                        episode_number: episodeNum,
                        title: `Эпизод ${episodeNum}`
                    };

                    const epRes = await fetch('/episodes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(epData)
                    });
                    if (!epRes.ok) throw new Error(`Could not create episode ${episodeNum}`);
                    const epObj = await epRes.json();

                    // Upload File
                    await uploadFileXHR(`/episodes/${epObj.id}/upload`, file, (pct) => {
                        updateProgressBar(pct, `Эпизод ${i + 1}/${files.length}`);
                    });
                }
            }
        } else {
            // Single file upload (Movie/Book)
            const fileInput = document.getElementById('file');
            if (fileInput.files.length > 0) {
                btn.innerText = "Загрузка файла...";
                await uploadFileXHR(`/${endpoint}/${id}/upload`, fileInput.files[0], (pct) => {
                    updateProgressBar(pct, "Загрузка основного файла");
                });
            }
        }

        // 3. Upload Thumbnail
        const thumbInput = document.getElementById('thumbnail');
        if (thumbInput.files.length > 0) {
            btn.innerText = "Загрузка обложки...";
            // Thumbnails are usually small, standard fetch is fine or XHR generic
            await uploadFileXHR(`/${endpoint}/${id}/upload_thumbnail`, thumbInput.files[0], (pct) => {
                updateProgressBar(pct, "Загрузка обложки");
            });
        }

        alert(currentEditingId ? "Успешно обновлено!" : "Успешно добавлено!");
        hideAddForm();
        loadContent(endpoint, null);
        loadStats();

    } catch (err) {
        console.error(err);
        alert("Ошибка при добавлении: " + err.message);
        document.getElementById('progress-container').style.display = 'none';
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// Theme Presets
const THEME_PRESETS = {
    midnight: {
        "--bg-primary": "#0a0a1a",
        "--bg-secondary": "#1e1e1e",
        "--text-primary": "#ffffff",
        "--text-secondary": "#e0e0e0",
        "--accent-color": "#4caf50",
        "--card-bg": "rgba(30, 30, 30, 0.7)",
        "--header-bg": "rgba(18, 18, 28, 0.8)",
        "--font-family": "Arial, sans-serif"
    },
    light: {
        "--bg-primary": "#f5f5f5",
        "--bg-secondary": "#ffffff",
        "--text-primary": "#333333",
        "--text-secondary": "#555555",
        "--accent-color": "#2196f3",
        "--card-bg": "rgba(255, 255, 255, 0.9)",
        "--header-bg": "rgba(255, 255, 255, 0.95)",
        "--font-family": "Arial, sans-serif"
    },
    ocean: {
        "--bg-primary": "#001e3c",
        "--bg-secondary": "#0a2e52",
        "--text-primary": "#e3f2fd",
        "--text-secondary": "#90caf9",
        "--accent-color": "#00bcd4",
        "--card-bg": "rgba(10, 46, 82, 0.7)",
        "--header-bg": "rgba(0, 30, 60, 0.8)",
        "--font-family": "sans-serif"
    },
    forest: {
        "--bg-primary": "#1b2e1b",
        "--bg-secondary": "#2e4a2e",
        "--text-primary": "#e8f5e9",
        "--text-secondary": "#a5d6a7",
        "--accent-color": "#66bb6a",
        "--card-bg": "rgba(46, 74, 46, 0.7)",
        "--header-bg": "rgba(27, 46, 27, 0.8)",
        "--font-family": "serif"
    },
    cyberpunk: {
        "--bg-primary": "#050014",
        "--bg-secondary": "#1a0b2e",
        "--text-primary": "#fff0f5",
        "--text-secondary": "#ff69b4",
        "--accent-color": "#ff00ff",
        "--card-bg": "rgba(26, 11, 46, 0.7)",
        "--header-bg": "rgba(5, 0, 20, 0.9)",
        "--font-family": "'Courier New', monospace"
    },
    sunset: {
        "--bg-primary": "#2d1b2e",
        "--bg-secondary": "#b0413e",
        "--text-primary": "#ffffc2",
        "--text-secondary": "#feb2a8",
        "--accent-color": "#fca311",
        "--card-bg": "rgba(45, 27, 46, 0.7)",
        "--header-bg": "rgba(45, 27, 46, 0.9)",
        "--font-family": "'Trebuchet MS', sans-serif"
    },
    dracula: {
        "--bg-primary": "#282a36",
        "--bg-secondary": "#44475a",
        "--text-primary": "#f8f8f2",
        "--text-secondary": "#6272a4",
        "--accent-color": "#ff79c6",
        "--card-bg": "rgba(68, 71, 90, 0.7)",
        "--header-bg": "rgba(40, 42, 54, 0.9)",
        "--font-family": "Consolas, monospace"
    },
    coffee: {
        "--bg-primary": "#2c241b",
        "--bg-secondary": "#4a3c31",
        "--text-primary": "#e6d7c3",
        "--text-secondary": "#a89f91",
        "--accent-color": "#c08c5d",
        "--card-bg": "rgba(60, 48, 40, 0.75)",
        "--header-bg": "rgba(44, 36, 27, 0.9)",
        "--font-family": "Georgia, serif"
    }
};

window.applyPreset = (presetName) => {
    const preset = THEME_PRESETS[presetName];
    if (!preset) return;

    for (const [key, value] of Object.entries(preset)) {
        // Update inputs
        const input = document.querySelector(`input[name="${key}"]`);
        if (input) input.value = value;

        // Update preview
        document.documentElement.style.setProperty(key, value);
    }
};

async function loadContent(category, btn) {
    if (btn) {
        document.querySelectorAll('#content .nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    const tableBody = document.querySelector('#content-table tbody');
    tableBody.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center;">Загрузка...</td></tr>';

    try {
        const response = await fetch(`/${category}`);
        if (!response.ok) throw new Error("Failed to fetch");
        const items = await response.json();

        tableBody.innerHTML = '';
        if (items.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center;">Нет элементов</td></tr>';
            return;
        }

        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #333';
            tr.innerHTML = `
                <td style="padding: 10px;">${item.id}</td>
                <td style="padding: 10px;">${item.title}</td>
                <td style="padding: 10px;">
                    <button class="edit-btn" style="background-color: #f39c12; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;" onclick="editAdminItem('${category}', ${item.id})">Ред.</button>
                    <button class="delete-btn" style="background-color: #d32f2f; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;" onclick="deleteItem('${category}', ${item.id})">Удалить</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        tableBody.innerHTML = '<tr><td colspan="3" style="padding: 20px; text-align: center; color: red;">Ошибка загрузки</td></tr>';
    }
}

async function deleteItem(category, id) {
    if (!confirm(`Удалить объект ID ${id} из ${category}?`)) return;

    try {
        const response = await fetch(`/${category}/${id}`, { method: 'DELETE' });
        if (response.ok) {
            // Reload current category
            const activeBtn = document.querySelector('#content .nav-item.active');
            loadContent(category, activeBtn);
            // Reload stats as well
            loadStats();
        } else {
            alert('Ошибка удаления');
        }
    } catch (e) {
        console.error(e);
        alert('Ошибка сети');
    }
}

async function loadStats() {
    try {
        const response = await fetch('/admin/stats');
        const stats = await response.json();
        const grid = document.getElementById('stats-grid');
        grid.innerHTML = '';

        const labels = {
            movies: 'Фильмы',
            books: 'Книги',
            tvshows: 'Сериалы',
            photos: 'Фото'
        };

        for (const [key, value] of Object.entries(stats)) {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.innerHTML = `
                <h3>${labels[key] || key}</h3>
                <div class="stat-number">${value}</div>
            `;
            grid.appendChild(card);
        }
    } catch (e) {
        console.error("Failed to load stats:", e);
    }
}

async function loadThemeSettings() {
    try {
        const response = await fetch('/admin/theme');
        const theme = await response.json();

        for (const [key, value] of Object.entries(theme)) {
            const inputName = key; // e.g., --bg-primary
            const input = document.querySelector(`input[name="${inputName}"]`);
            if (input) {
                input.value = value;
            }
        }
    } catch (e) {
        console.error("Failed to load theme settings:", e);
    }
}

async function saveTheme() {
    const formData = new FormData(document.getElementById('theme-form'));
    const settings = {};
    for (const [key, value] of formData.entries()) {
        settings[key] = value;
    }

    try {
        const response = await fetch('/admin/theme', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ settings })
        });

        if (response.ok) {
            alert('Тема сохранена! Обновите страницу, чтобы увидеть изменения.');
            // Dynamically apply locally too
            const root = document.documentElement;
            for (const [key, value] of Object.entries(settings)) {
                root.style.setProperty(key, value);
            }
        } else {
            alert('Ошибка сохранения темы');
        }
    } catch (e) {
        console.error("Error saving theme:", e);
        alert('Ошибка сети');
    }
}

async function resetTheme() {
    if (!confirm("Вы уверены, что хотите сбросить тему к стандартной?")) return;

    try {
        const response = await fetch('/admin/theme/reset', { method: 'POST' });
        if (response.ok) {
            location.reload();
        }
    } catch (e) {
        console.error(e);
    }
}
