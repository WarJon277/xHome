import { useEffect, useState, useRef } from 'react';
import { fetchPhotos, deleteFolder, deletePhoto, createPhotoFolder, uploadPhotoToFolder, movePhoto, moveFolder, renameFolder } from '../api';
import { Image as ImageIcon, Folder, ArrowLeft, Plus, Upload, Trash, X, Move, Edit } from 'lucide-react';
import PhotoModal from '../components/PhotoModal';
import ContextMenu from '../components/ContextMenu';
import MoveModal from '../components/MoveModal';
import ConfirmationModal from '../components/ConfirmationModal';
import InputModal from '../components/InputModal';

export default function GalleryPage() {
    const [items, setItems] = useState([]);
    const [currentFolder, setCurrentFolder] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Modal State
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);
    const [inputModal, setInputModal] = useState(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState(null);

    // Move State
    const [moveItem, setMoveItem] = useState(null);

    // Upload Refs
    const fileInputRef = useRef(null);
    const longPressTimer = useRef(null);

    // ... (touch handlers mostly same)
    const handleTouchStart = (e, item) => {
        const touch = e.touches[0];
        const clientX = touch.clientX;
        const clientY = touch.clientY;

        longPressTimer.current = setTimeout(() => {
            setContextMenu({
                x: clientX,
                y: clientY,
                item: item
            });
            if (navigator.vibrate) navigator.vibrate(50);
        }, 600);
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

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
            x: e.clientX,
            y: e.clientY,
            item: item
        });
    };

    // --- Actions ---

    const handleDelete = (item) => {
        setConfirmModal({
            title: "Удаление",
            message: `Вы уверены, что хотите удалить "${item.name}"? Это действие необратимо.`,
            isDanger: true,
            confirmLabel: "Удалить",
            onConfirm: () => performDelete(item)
        });
    };

    const performDelete = async (item) => {
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
            console.error(err);
            setConfirmModal({
                title: "Ошибка",
                message: "Не удалось удалить элемент. Возможно, он уже удален.",
                isDanger: false,
                confirmLabel: "OK",
                onConfirm: () => setConfirmModal(null)
            });
            return; // Don't close modal yet if we want to show error? Actually, let's close and show error modal
        }
        setConfirmModal(null);
    };

    const handleCreateFolder = () => {
        setInputModal({
            title: "Новая папка",
            placeholder: "Название папки",
            initialValue: "",
            confirmLabel: "Создать",
            onConfirm: performCreateFolder
        });
    };

    const performCreateFolder = async (name) => {
        if (!name) return;
        try {
            await createPhotoFolder({ title: name, path: currentFolder });
            loadItems(currentFolder);
            setInputModal(null);
        } catch (err) {
            setConfirmModal({
                title: "Ошибка",
                message: "Ошибка при создании папки.",
                confirmLabel: "OK",
                onConfirm: () => setConfirmModal(null)
            });
        }
    };

    const handleRename = (item) => {
        if (item.type !== 'folder') return; // Only rename folders for now as requested
        setInputModal({
            title: "Переименовать папку",
            placeholder: "Новое название",
            initialValue: item.name,
            confirmLabel: "Сохранить",
            onConfirm: (newName) => performRename(item, newName)
        });
    };

    const performRename = async (item, newName) => {
        if (!newName || newName === item.name) {
            setInputModal(null);
            return;
        }
        try {
            // Construct relative path to folder
            const folderPath = currentFolder ? `${currentFolder}/${item.name}` : item.name;
            await renameFolder(folderPath, newName);
            loadItems(currentFolder);
            setInputModal(null);
        } catch (err) {
            setConfirmModal({
                title: "Ошибка",
                message: "Не удалось переименовать папку. " + (err.message || ""),
                confirmLabel: "OK",
                onConfirm: () => setConfirmModal(null)
            });
        }
    };

    const handleMoveAction = (targetFolder) => {
        const item = moveItem;
        if (!item) return;

        const performMove = async () => {
            try {
                if (item.type === 'folder') {
                    await moveFolder(item.path || item.name, targetFolder);
                } else {
                    await movePhoto(item.path || item.file_path, targetFolder);
                }
                loadItems(currentFolder);
            } catch (err) {
                console.error(err);
                setConfirmModal({
                    title: "Ошибка",
                    message: "Ошибка при перемещении: " + err.message,
                    confirmLabel: "OK",
                    onConfirm: () => setConfirmModal(null)
                });
            } finally {
                setMoveItem(null);
            }
        };
        performMove();
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
            setConfirmModal({
                title: "Ошибка",
                message: "Ошибка загрузки файла",
                confirmLabel: "OK",
                onConfirm: () => setConfirmModal(null)
            });
        } finally {
            e.target.value = null;
        }
    };

    // Helper to normalize path
    const getImageUrl = (path) => {
        if (!path) return null;
        path = path.replace(/\\/g, '/');
        if (path.startsWith('http')) return path;

        // Remove duplicate /uploads if present
        if (path.startsWith('/uploads/uploads/')) path = path.replace('/uploads/uploads/', '/uploads/');
        if (path.startsWith('uploads/uploads/')) path = path.replace('uploads/uploads/', 'uploads/');

        if (path.startsWith('/uploads/') || path.startsWith('/static/')) return path;
        if (path.startsWith('uploads/') || path.startsWith('static/')) return `/${path}`;

        // If it starts with / but not /uploads/, it likely needs prefixing
        if (path.startsWith('/')) return `/uploads/gallery${path}`;

        return `/uploads/gallery/${path}`;
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
                            className="p-2 rounded-full hover:opacity-80 transition-colors"
                            style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <ImageIcon className="text-yellow-500" /> Галерея
                    </h1>
                </div>

                {/* Breadcrumbs */}
                <div className="text-sm flex flex-wrap items-center gap-2 p-2 rounded px-4 inline-flex max-w-full" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-secondary)' }}>
                    <span
                        className={`cursor-pointer hover:opacity-80 ${!currentFolder ? 'font-bold' : ''}`}
                        style={{ color: !currentFolder ? 'var(--text-primary)' : 'var(--text-secondary)' }}
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
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1 sm:gap-2">
                    {items.map(item => {
                        const isFolder = item.type === 'folder';
                        const imageUrl = !isFolder ? getImageUrl(item.thumbnail_path || item.file_path) : null;

                        return (
                            <div
                                key={item.id || item.name}
                                className={`
                                    relative aspect-square rounded-lg overflow-hidden cursor-pointer
                                    hover:scale-105 transition-transform border border-gray-800
                                    flex flex-col items-center justify-center p-4 group tv-focusable
                                `}
                                style={{ backgroundColor: 'var(--card-bg)' }}
                                tabIndex={0}
                                data-tv-clickable="true"
                                onClick={() => isFolder ? handleFolderClick(item.name) : handlePhotoClick(item)}
                                onContextMenu={(e) => handleRightClick(e, item)}
                                onTouchStart={(e) => handleTouchStart(e, item)}
                                onTouchEnd={handleTouchEnd}
                                onTouchMove={handleTouchEnd}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') isFolder ? handleFolderClick(item.name) : handlePhotoClick(item);
                                }}
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
                        // Show "Rename" only for folders
                        ...(contextMenu.item.type === 'folder' ? [{ label: "Переименовать", onClick: () => handleRename(contextMenu.item), icon: <Edit size={16} /> }] : []),
                        { label: "Переместить", onClick: () => setMoveItem(contextMenu.item), icon: <Move size={16} /> },
                        { label: 'Удалить', onClick: () => handleDelete(contextMenu.item), icon: <Trash size={16} />, className: 'text-red-500 hover:bg-red-500/20' }
                    ]}
                />
            )}

            {/* CONFIRMATION MODAL */}
            {confirmModal && (
                <ConfirmationModal
                    title={confirmModal.title}
                    message={confirmModal.message}
                    onClose={() => setConfirmModal(null)}
                    onConfirm={confirmModal.onConfirm}
                    confirmLabel={confirmModal.confirmLabel}
                    isDanger={confirmModal.isDanger}
                />
            )}

            {/* INPUT MODAL */}
            {inputModal && (
                <InputModal
                    title={inputModal.title}
                    initialValue={inputModal.initialValue}
                    placeholder={inputModal.placeholder}
                    confirmLabel={inputModal.confirmLabel}
                    onClose={() => setInputModal(null)}
                    onConfirm={inputModal.onConfirm}
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
