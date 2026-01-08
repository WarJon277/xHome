// kaleidoscopes.js
const API_BASE = ''; // Relative path

async function fetchKaleidoscopes() {
    try {
        const response = await fetch(`${API_BASE}/kaleidoscopes`);
        if (!response.ok) throw new Error('Failed to fetch kaleidoscopes');
        return await response.json();
    } catch (e) {
        console.error(e);
        return [];
    }
}

async function fetchKaleidoscopeDetails(id) {
    try {
        const response = await fetch(`${API_BASE}/kaleidoscopes/${id}`);
        if (!response.ok) throw new Error('Failed to fetch kaleidoscope details');
        return await response.json();
    } catch (e) {
        console.error(e);
        return null;
    }
}

// Container for Kaleidoscopes
const kaleidoscopeContainer = document.getElementById('kaleidoscope-container');
const galleryContainer = document.getElementById('gallery-container');
const galleryTab = document.getElementById('tab-gallery');
const kaleidoscopeTab = document.getElementById('tab-kaleidoscope');

// Player Elements
let playerOverlay = null;
let audioPlayer = null;
let imageDisplay = null;
let currentIndex = 0;
let currentItems = [];
let playbackInterval = null;

function initKaleidoscopes() {
    if (galleryTab && kaleidoscopeTab) {
        galleryTab.addEventListener('click', () => switchTab('gallery'));
        kaleidoscopeTab.addEventListener('click', () => switchTab('kaleidoscope'));
    }
    createPlayerOverlay();
}

async function switchTab(tab) {
    if (tab === 'gallery') {
        galleryContainer.style.display = 'grid'; // Restore grid
        kaleidoscopeContainer.style.display = 'none';

        galleryTab.classList.add('active');
        kaleidoscopeTab.classList.remove('active');
    } else {
        galleryContainer.style.display = 'none';
        kaleidoscopeContainer.style.display = 'grid';

        galleryTab.classList.remove('active');
        kaleidoscopeTab.classList.add('active');

        await loadKaleidoscopes();
    }
}

async function loadKaleidoscopes() {
    kaleidoscopeContainer.innerHTML = '<div class="loading">Загрузка...</div>';
    const items = await fetchKaleidoscopes();

    kaleidoscopeContainer.innerHTML = '';
    if (items.length === 0) {
        kaleidoscopeContainer.innerHTML = '<div class="empty-state">Нет доступных калейдоскопов</div>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'gallery-item kaleidoscope-item';
        card.innerHTML = `
            <div class="kaleidoscope-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-play-circle"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
            </div>
            <div class="item-name">${item.title}</div>
        `;
        card.onclick = () => playKaleidoscope(item.id);
        kaleidoscopeContainer.appendChild(card);
    });
}

async function playKaleidoscope(id) {
    const details = await fetchKaleidoscopeDetails(id);
    if (!details || !details.items || details.items.length === 0) {
        alert('Калейдоскоп пуст или не найден');
        return;
    }

    currentItems = details.items;
    currentIndex = 0;

    // Setup Audio
    if (details.music_path) {
        audioPlayer.src = details.music_path;
        audioPlayer.loop = true; // Loop music for now
        audioPlayer.play().catch(e => console.log('Audio autoplay blocked', e));
    } else {
        audioPlayer.pause();
        audioPlayer.src = "";
    }

    // Show Overlay
    playerOverlay.classList.add('active');

    // Start Show
    showNextSlide();
}

function showNextSlide() {
    if (currentIndex >= currentItems.length) {
        currentIndex = 0; // Loop
    }

    const item = currentItems[currentIndex];

    // Preload next image
    const nextIdx = (currentIndex + 1) % currentItems.length;
    const nextItem = currentItems[nextIdx];
    const preloadImg = new Image();
    preloadImg.src = nextItem.photo_path;

    // Transition
    imageDisplay.style.opacity = 0;

    setTimeout(() => {
        imageDisplay.src = item.photo_path;
        imageDisplay.onload = () => {
            imageDisplay.style.opacity = 1;
        };
        // Fallback if image is cached and onload doesn't fire fast enough logic is simpler like this though:
        // Ideally we wait for load, but for simplicity:
    }, 500); // Wait for fade out

    const duration = (item.duration || 5) * 1000;

    if (playbackInterval) clearTimeout(playbackInterval);
    playbackInterval = setTimeout(() => {
        currentIndex++;
        showNextSlide();
    }, duration + 1000); // Duration + transition time
}

function stopPlayback() {
    if (playbackInterval) clearTimeout(playbackInterval);
    audioPlayer.pause();
    playerOverlay.classList.remove('active');
    imageDisplay.src = "";
}

function createPlayerOverlay() {
    playerOverlay = document.createElement('div');
    playerOverlay.id = 'kaleidoscope-player';
    playerOverlay.className = 'kaleidoscope-player';

    imageDisplay = document.createElement('img');
    imageDisplay.className = 'kaleidoscope-image';

    audioPlayer = document.createElement('audio');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = stopPlayback;

    playerOverlay.appendChild(imageDisplay);
    playerOverlay.appendChild(closeBtn); // Add audio element strictly if needed visible, otherwise hidden

    document.body.appendChild(playerOverlay);
    document.body.appendChild(audioPlayer);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initKaleidoscopes);
