import { useEffect, useState, useRef } from 'react';
import { fetchPhotos, deleteFolder, deletePhoto, createPhotoFolder, uploadPhotoToFolder, movePhoto, moveFolder } from '../api';
import { Image as ImageIcon, Folder, ArrowLeft, Plus, Upload, Trash, X, Move } from 'lucide-react';
import PhotoModal from '../components/PhotoModal';
import ContextMenu from '../components/ContextMenu';
import MoveModal from '../components/MoveModal';

export default function GalleryPage() {
    const [items, setItems] = useState([]);
    const [currentFolder, setCurrentFolder] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Modal State
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState(null);

    // Move State
    const [moveItem, setMoveItem] = useState(null);

    // Upload Refs
    const fileInputRef = useRef(null);

    const loadItems = async (folder = "") => {
        try {
            setLoading(true);
            const data = await fetchPhotos(folder);

            // Client-side sorting: Folders first, then files
            const sorted = data.sort((a, b) => {
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                return (a.name || a.title || '').localeCompare(b.name || b.title || '');
            });

            setItems(sorted);
            setError(null);
        } catch (err) {
            console.error("Failed to load gallery:", err);
            setError("Не удалось загрузить галерею");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadItems(currentFolder);
    }, [currentFolder]);

    const handleFolderClick = (folderName) => {
        const newPath = currentFolder ? `${currentFolder}/${folderName}` : folderName;
        setCurrentFolder(newPath);
    };

    const handleBack = () => {
        if (!currentFolder) return;
        const parts = currentFolder.split('/');
        parts.pop();
        setCurrentFolder(parts.join('/'));
    };

    const handlePhotoClick = (item) => {
        const index = items.findIndex(i => i.id === item.id);
        setSelectedPhotoIndex(index);
    };

    const closePhotoModal = () => setSelectedPhotoIndex(null);

    const handleNextPhoto = () => {
        if (selectedPhotoIndex === null) return;
        let nextIndex = selectedPhotoIndex + 1;
        while (nextIndex < items.length && items[nextIndex].type === 'folder') {
            nextIndex++;
        }
        if (nextIndex < items.length) setSelectedPhotoIndex(nextIndex);
    };

    const handlePrevPhoto = () => {
        if (selectedPhotoIndex === null) return;
        let prevIndex = selectedPhotoIndex - 1;
        while (prevIndex >= 0 && items[prevIndex].type === 'folder') {
            prevIndex--;
        }
        if (prevIndex >= 0) setSelectedPhotoIndex(prevIndex);
    };

    // --- Context Menu ---
    const handleRightClick = (e, item) => {
        e.preventDefault();
        setContextMenu({
            x: e.pageX,
            y: e.pageY,
            item: item
        });
    };

    const handleDelete = async (item) => {
        if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return;

        try {
            if (item.type === 'folder') {
                const fullPath = currentFolder ? `${currentFolder}/${item.name}` : item.name;
                await deleteFolder(fullPath);
            } else {
                await deletePhoto(item.id);
            }
            if (selectedPhotoIndex !== null && items[selectedPhotoIndex]?.id === item.id) {
                closePhotoModal();
            }
            loadItems(currentFolder);
        } catch (err) {
            alert("Failed to delete item");
        }
    };

    const handleMoveAction = (targetFolder) => {
        const item = moveItem;
        if (!item) return;

        const performMove = async () => {
            try {
                if (item.type === 'folder') {
                    // Item.path usually includes current folder structure if logic holds 
                    // But in loadItems we set path as full relative path? 
                    // Let's rely on item.path which we expect from API or construct it 
                    // API returns 'path' field.
                    await moveFolder(item.path || item.name, targetFolder); // fallback to name if path missing (for root)
                } else {
                    await movePhoto(item.path || item.file_path, targetFolder);
                }
                loadItems(currentFolder);
            } catch (err) {
                console.error(err);
                alert("Ошибка при перемещении: " + err.message);
            } finally {
                setMoveItem(null);
            }
        };
        performMove();
    };

    // --- Actions ---
    const handleCreateFolder = async () => {
        const name = prompt("Введите название новой папки:");
        if (!name) return;
        try {
            await createPhotoFolder({ title: name, path: currentFolder });
            loadItems(currentFolder);
        } catch (err) {
            alert("Ошибка при создании папки");
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        try {
            for (let i = 0; i < files.length; i++) {
                await uploadPhotoToFolder(currentFolder, files[i], (progress) => {
                    console.log(`Upload ${files[i].name}: ${progress}%`);
                });
            }
            loadItems(currentFolder);
        } catch (err) {
            alert("Ошибка загрузки файла");
        } finally {
            e.target.value = null;
        }
    };

    // Helper to normalize path
    const getImageUrl = (path) => {
        if (!path) return null;
        path = path.replace(/\\/g, '/');
        if (path.startsWith('http')) return path;
        if (path.startsWith('/uploads/') || path.startsWith('/static/')) return path;
        if (path.startsWith('uploads/') || path.startsWith('static/')) return `/${path}`;
        if (path.startsWith('/')) return `/uploads${path}`;
        return `/uploads/${path}`;
    };

    return (
        <div className="p-4 sm:p-6 relative min-h-screen pb-24">
            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                accept="image/*"
                className="hidden"
            />

            <header className="mb-6">
                <div className="flex items-center gap-4 mb-2">
                    {currentFolder && (
                        <button
                            onClick={handleBack}
                            className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 text-white transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ImageIcon className="text-yellow-500" /> Галерея
                    </h1>
                </div>

                {/* Breadcrumbs */}
                <div className="text-gray-400 text-sm flex flex-wrap items-center gap-2 bg-card p-2 rounded px-4 inline-flex max-w-full">
                    <span
                        className={`cursor-pointer hover:text-white ${!currentFolder ? 'text-white' : ''}`}
                        onClick={() => setCurrentFolder("")}
                    >
                        Root
                    </span>
                    {currentFolder.split('/').filter(Boolean).map((part, index, arr) => {
                        const path = arr.slice(0, index + 1).join('/');
                        return (
                            <span key={path} className="flex items-center gap-2">
                                <span>/</span>
                                <span
                                    className={`cursor-pointer hover:text-white ${index === arr.length - 1 ? 'text-white font-semibold' : ''}`}
                                    onClick={() => setCurrentFolder(path)}
                                >
                                    {part}
                                </span>
                            </span>
                        );
                    })}
                </div>
            </header>

            {loading ? (
                <div className="text-center text-gray-500 mt-10">Загрузка...</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 sm:gap-2">
                    {items.map(item => {
                        const isFolder = item.type === 'folder';
                        const imageUrl = !isFolder ? getImageUrl(item.thumbnail_path || item.file_path) : null;

                        return (
                            <div
                                key={item.id || item.name}
                                className={`
                                    relative aspect-square rounded-lg overflow-hidden cursor-pointer
                                    hover:scale-105 transition-transform bg-card border border-gray-800
                                    flex flex-col items-center justify-center p-4 group
                                `}
                                onClick={() => isFolder ? handleFolderClick(item.name) : handlePhotoClick(item)}
                                onContextMenu={(e) => handleRightClick(e, item)}
                            >
                                {isFolder ? (
                                    <>
                                        <Folder size={64} className="text-blue-500 mb-2" fill="currentColor" />
                                        <span className="text-center text-sm font-medium text-white truncate w-full px-2">
                                            {item.name}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        {imageUrl ? (
                                            <img
                                                src={imageUrl}
                                                className="absolute inset-0 w-full h-full object-cover"
                                                alt={item.title}
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="text-gray-600">No Image</div>
                                        )}
                                        {/* Hover Info */}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                            <span className="text-white text-xs truncate w-full">{item.title}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Photo Modal */}
            {selectedPhotoIndex !== null && items[selectedPhotoIndex] && (
                <PhotoModal
                    item={items[selectedPhotoIndex]}
                    onClose={closePhotoModal}
                    onNext={handleNextPhoto}
                    onPrev={handlePrevPhoto}
                    onDelete={handleDelete}
                />
            )}

            {/* Move Modal */}
            {moveItem && (
                <MoveModal
                    item={moveItem}
                    currentPath={currentFolder}
                    onClose={() => setMoveItem(null)}
                    onMove={handleMoveAction}
                />
            )}

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    options={[
                        { label: "Открыть", onClick: () => contextMenu.item.type === 'folder' ? handleFolderClick(contextMenu.item.name) : handlePhotoClick(contextMenu.item), icon: <Upload size={16} /> },
                        { label: "Переместить", onClick: () => setMoveItem(contextMenu.item), icon: <Move size={16} /> },
                        { label: 'Удалить', onClick: () => handleDelete(contextMenu.item), icon: <Trash size={16} />, className: 'text-red-500 hover:bg-red-500/20' }
                    ]}
                />
            )}

            {/* Floating Action Buttons (FABs) */}
            <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 flex flex-col gap-3 sm:gap-4">
                <button
                    onClick={handleCreateFolder}
                    className="p-3 sm:p-4 bg-gray-700 hover:bg-gray-600 rounded-full shadow-lg text-white transition-all hover:scale-110 active:scale-95"
                    title="Создать папку"
                >
                    <Folder size={20} className="sm:w-6 sm:h-6" />
                </button>
                <button
                    onClick={handleUploadClick}
                    className="p-3 sm:p-4 bg-primary hover:bg-red-700 rounded-full shadow-lg text-white transition-all hover:scale-110 active:scale-95"
                    title="Загрузить фото"
                >
                    <Upload size={20} className="sm:w-6 sm:h-6" />
                </button>
            </div>
        </div>
    );
}
