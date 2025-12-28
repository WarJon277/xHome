// Управление состоянием приложения
export const state = {
    currentCategory: 'movie',
    currentGenre: 'Все',
    editingItem: null
};

// Функции для обновления состояния
export function setCurrentCategory(category) {
    state.currentCategory = category;
}

export function setCurrentGenre(genre) {
    state.currentGenre = genre;
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

export function getEditingItem() {
    return state.editingItem;
}