// Управление состоянием приложения
export const state = {
    currentCategory: 'movie',
    currentGenre: 'Все',
    currentFolder: "",  // Путь к текущей папке в галерее
    editingItem: null
};

// Функции для обновления состояния
export function setCurrentCategory(category) {
    state.currentCategory = category;
}

export function setCurrentGenre(genre) {
    state.currentGenre = genre;
}

export function setCurrentFolder(folder) {
    state.currentFolder = folder;
}

export function setEditingItem(item) {
    state.editingItem = item;
}

// Функции для получения состояния
export function getCurrentCategory() {
    return state.currentCategory;
}

export function getCurrentGenre() {
    return state.currentGenre;
}

export function getCurrentFolder() {
    return state.currentFolder;
}

export function getEditingItem() {
    return state.editingItem;
}