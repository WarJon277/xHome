import { useState, useEffect, useRef } from 'react';
import { fetchKaleidoscopes, createKaleidoscope, deleteKaleidoscope, uploadKaleidoscopeMusic, fetchPhotos } from '../api';
import { Plus, Trash2, Music, Image as ImageIcon, Check, Folder, ArrowLeft } from 'lucide-react';

export default function KaleidoscopeManager() {
    const [items, setItems] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadKaleidoscopes();
    }, []);

    const loadKaleidoscopes = async () => {
        setIsLoading(true);
        try {
            const data = await fetchKaleidoscopes();
            setItems(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Удалить этот калейдоскоп?')) return;
        try {
            await deleteKaleidoscope(id);
            loadKaleidoscopes();
        } catch (e) {
            alert('Ошибка удаления: ' + e.message);
        }
    };

    return (
        <div>
            {!showForm ? (
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold">Калейдоскопы</h2>
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-4 py-2 bg-green-600 rounded flex items-center gap-2"
                        >
                            <Plus size={20} /> Создать
                        </button>
                    </div>

                    {isLoading ? <div className="text-center text-gray-400">Загрузка...</div> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {items.map(item => (
                                <div key={item.id} className="p-4 rounded-lg flex justify-between items-center" style={{ backgroundColor: 'var(--card-bg)' }}>
                                    <div>
                                        <h3 className="font-bold text-lg">{item.title}</h3>
                                        <p className="text-sm text-gray-400">{new Date(item.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            ))}
                            {items.length === 0 && (
                                <div className="col-span-full text-center text-gray-500 p-8">Нет созданных калейдоскопов</div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <KaleidoscopeForm onCancel={() => { setShowForm(false); loadKaleidoscopes(); }} />
            )}
        </div>
    );
}

function KaleidoscopeForm({ onCancel }) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        duration: 5, // default duration
        cover_path: '',
        items: []
    });
    const [musicFile, setMusicFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [showGalleryPicker, setShowGalleryPicker] = useState(false);
    const [pickerMode, setPickerMode] = useState('items'); // 'items' or 'cover'

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.items.length === 0) {
            alert('Выберите хотя бы одно фото');
            return;
        }

        setUploading(true);
        try {
            let musicPath = '';
            if (musicFile) {
                const res = await uploadKaleidoscopeMusic(musicFile, (pct) => { });
                musicPath = res.music_path;
            }

            // Prepare items
            const kItems = formData.items.map((photo, index) => ({
                photo_path: photo.file_path, // Full path from gallery item
                duration: formData.duration,
                order: index,
                transition_effect: ['fade', 'slide', 'zoom', 'blur'][index % 4] // Rotate effects for now
            }));

            await createKaleidoscope({
                title: formData.title,
                description: formData.description,
                music_path: musicPath,
                cover_path: formData.cover_path || (kItems[0] ? kItems[0].photo_path : ''),
                items: kItems
            });

            onCancel(); // Close form and reload list
        } catch (e) {
            alert('Ошибка: ' + e.message);
        } finally {
            setUploading(false);
        }
    };

    const removePhoto = (index) => {
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData({ ...formData, items: newItems });
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg max-w-4xl mx-auto">
            <h2 className="text-2xl mb-6 font-bold">Создание Калейдоскопа</h2>

            {showGalleryPicker ? (
                <GalleryPicker
                    mode={pickerMode}
                    onConfirm={(selected) => {
                        if (pickerMode === 'cover') {
                            if (selected.length > 0) {
                                setFormData({ ...formData, cover_path: selected[0].file_path || selected[0].thumbnail_path });
                            }
                        } else {
                            // Deduplicate items base on ID if possible, or just append
                            setFormData({ ...formData, items: [...formData.items, ...selected] });
                        }
                        setShowGalleryPicker(false);
                    }}
                    onCancel={() => setShowGalleryPicker(false)}
                />
            ) : (
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block mb-2 text-sm font-medium">Название</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:border-green-500 outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium">Длительность кадра (сек)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.duration}
                                onChange={(e) => setFormData({ ...formData, duration: parseFloat(e.target.value) })}
                                className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:border-green-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block mb-2 text-sm font-medium">Обложка</label>
                        <div className="flex items-center gap-4">
                            {formData.cover_path ? (
                                <div className="w-24 h-24 rounded overflow-hidden border border-gray-600 relative group">
                                    <img src={formData.cover_path} className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, cover_path: '' })}
                                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-500 transition-opacity"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>
                            ) : (
                                <div className="w-24 h-24 rounded border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500">
                                    Нет
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => { setPickerMode('cover'); setShowGalleryPicker(true); }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2"
                            >
                                <ImageIcon size={16} /> Выбрать обложку
                            </button>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block mb-2 text-sm font-medium">Музыка (mp3, wav, ogg)</label>
                        <div className="flex items-center gap-4 bg-gray-700 p-4 rounded border border-gray-600">
                            <Music size={24} className="text-gray-400" />
                            <input
                                type="file"
                                accept="audio/*"
                                onChange={(e) => setMusicFile(e.target.files[0])}
                                className="flex-1 bg-transparent"
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <label className="block text-sm font-medium">Фотографии ({formData.items.length})</label>
                            <button
                                type="button"
                                onClick={() => { setPickerMode('items'); setShowGalleryPicker(true); }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded flex items-center gap-2 text-sm"
                            >
                                <ImageIcon size={16} /> Добавить фото
                            </button>
                        </div>

                        {/* Selected Photos Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto max-h-60 p-2 bg-gray-900/50 rounded border border-gray-700">
                            {formData.items.length === 0 && (
                                <div className="col-span-full text-center py-8 text-gray-500">Фото не выбраны</div>
                            )}
                            {formData.items.map((photo, idx) => (
                                <div key={idx} className="relative aspect-square group rounded overflow-hidden border border-gray-700">
                                    <img src={photo.thumbnail_path} className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removePhoto(idx)}
                                        className="absolute top-1 right-1 p-1 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-gray-700">
                        <button
                            type="submit"
                            disabled={uploading}
                            className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded font-medium disabled:opacity-50"
                        >
                            {uploading ? 'Сохранение...' : 'Создать Калейдоскоп'}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded font-medium"
                        >
                            Отмена
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

function GalleryPicker({ onConfirm, onCancel, mode = 'items' }) {
    const [currentPath, setCurrentPath] = useState("");
    const [items, setItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]); // Array of photo objects

    useEffect(() => {
        loadItems(currentPath);
    }, [currentPath]);

    const loadItems = async (path) => {
        try {
            const data = await fetchPhotos(path);
            const sorted = data.sort((a, b) => {
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                return (a.name || '').localeCompare(b.name || '');
            });
            setItems(sorted);
        } catch (e) {
            console.error(e);
        }
    };

    const toggleSelection = (item) => {
        if (mode === 'cover') {
            // Single selection for cover
            setSelectedItems([item]);
            return;
        }

        if (selectedItems.find(i => i.id === item.id)) {
            setSelectedItems(selectedItems.filter(i => i.id !== item.id));
        } else {
            setSelectedItems([...selectedItems, item]);
        }
    };

    const handleBack = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        setCurrentPath(parts.join('/'));
    };

    return (
        <div className="flex flex-col h-[600px] bg-gray-900 rounded border border-gray-700">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t">
                <div className="flex items-center gap-2">
                    {currentPath && (
                        <button onClick={handleBack} className="p-1 hover:bg-gray-700 rounded-full">
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <span className="font-mono text-sm truncate max-w-[200px] sm:max-w-md">
                        /{currentPath}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-green-400 font-medium">Выбрано: {selectedItems.length}</span>
                    <button
                        onClick={() => onConfirm(selectedItems)}
                        className="px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm disabled:opacity-50"
                        disabled={selectedItems.length === 0}
                    >
                        {mode === 'cover' ? 'Установить обложку' : 'Добавить'}
                    </button>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {items.map(item => {
                        const isSelected = selectedItems.find(i => i.id === item.id);
                        if (item.type === 'folder') {
                            return (
                                <div
                                    key={item.name}
                                    onClick={() => setCurrentPath(currentPath ? `${currentPath}/${item.name}` : item.name)}
                                    className="aspect-square bg-gray-800 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-gray-700 border border-transparent hover:border-blue-500/50"
                                >
                                    <Folder className="text-blue-500 mb-1" size={32} />
                                    <span className="text-xs text-center truncate w-full px-1">{item.name}</span>
                                </div>
                            );
                        } else {
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => toggleSelection(item)}
                                    className={`relative aspect-square rounded overflow-hidden cursor-pointer group border-2 ${isSelected ? 'border-green-500' : 'border-transparent'}`}
                                >
                                    <img src={item.thumbnail_path} className="w-full h-full object-cover" />
                                    {isSelected && (
                                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                            <Check className="text-green-500 drop-shadow-md" size={32} />
                                        </div>
                                    )}
                                </div>
                            );
                        }
                    })}
                </div>
            </div>
        </div>
    );
}

function X({ size, className }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
        </svg>
    )
}
