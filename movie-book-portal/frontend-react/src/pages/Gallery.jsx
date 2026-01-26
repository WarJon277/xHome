import { useEffect, useState, useRef } from 'react';
import { fetchPhotos, deleteFolder, deletePhoto, createPhotoFolder, uploadPhotoToFolder, movePhoto, fetchKaleidoscopes } from '../api';
import {
    Folder, MoreVertical, Download, Share2, CornerUpRight, Trash2,
    ChevronRight, Home, Upload, FolderPlus, ArrowLeft, Image as ImageIcon,
    PlayCircle, Edit, Move, Share
} from 'lucide-react';
import KaleidoscopeViewer from '../components/KaleidoscopeViewer';
import PhotoModal from '../components/PhotoModal';
import ContextMenu from '../components/ContextMenu';
import MoveModal from '../components/MoveModal';
import ConfirmationModal from '../components/ConfirmationModal';
import InputModal from '../components/InputModal';

export default function GalleryPage() {
    // State
    const [items, setItems] = useState([]);
    const [currentPath, setCurrentPath] = useState(''); // Empty string = root
    const [viewMode, setViewMode] = useState('photos'); // 'photos' or 'kaleidoscopes'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Modal State
    const [selectedPhoto, setSelectedPhoto] = useState(null); // Changed from selectedPhotoIndex
    const [confirmModal, setConfirmModal] = useState(null);
    const [inputModal, setInputModal] = useState(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState(null);

    // Move State
    const [moveItem, setMoveItem] = useState(null);

    // Upload State
    const [uploadStatus, setUploadStatus] = useState(null); // { active, total, current, progress, failures: [], currentFile }

    // Upload Refs
    const fileInputRef = useRef(null);
    const longPressTimer = useRef(null);
    const isLongPress = useRef(false);

    // ... (touch handlers mostly same)
    const handleTouchStart = (e, item) => {
        isLongPress.current = false;
        const touch = e.touches[0];
        const clientX = touch.clientX;
        const clientY = touch.clientY;

        longPressTimer.current = setTimeout(() => {
            isLongPress.current = true;
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
        if (viewMode === 'photos') {
            loadItems(currentPath);
        }
    }, [currentPath, viewMode, refreshTrigger]); // Added viewMode and refreshTrigger

    const handleFolderClick = (folderName) => {
        const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
        setCurrentPath(newPath);
    };

    const handleBack = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        setCurrentPath(parts.join('/'));
    };

    const handlePhotoClick = (item) => {
        setSelectedPhoto(item);
    };

    const closePhotoModal = () => setSelectedPhoto(null);

    const navigatePhoto = (direction) => {
        if (!selectedPhoto) return;

        const photoItems = items.filter(item => item.type !== 'folder');
        const currentIndex = photoItems.findIndex(item => item.id === selectedPhoto.id);

        let nextIndex = currentIndex + direction;

        if (nextIndex >= 0 && nextIndex < photoItems.length) {
            setSelectedPhoto(photoItems[nextIndex]);
        }
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
            message: `Вы уверены, что хотите удалить "${item.name || item.title}"? Это действие необратимо.`,
            isDanger: true,
            confirmLabel: "Удалить",
            onConfirm: () => performDelete(item)
        });
    };

    const performDelete = async (item) => {
        try {
            if (item.type === 'folder') {
                const fullPath = currentPath ? `${currentPath}/${item.name}` : item.name;
                await deleteFolder(fullPath);
            } else {
                await deletePhoto(item.id);
            }
            if (selectedPhoto && selectedPhoto.id === item.id) {
                closePhotoModal();
            }
            setRefreshTrigger(prev => prev + 1); // Trigger refresh
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
            await createPhotoFolder({ title: name, path: currentPath });
            setRefreshTrigger(prev => prev + 1); // Trigger refresh
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
            const folderPath = currentPath ? `${currentPath}/${item.name}` : item.name;
            await renameFolder(folderPath, newName);
            setRefreshTrigger(prev => prev + 1); // Trigger refresh
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
                setRefreshTrigger(prev => prev + 1); // Trigger refresh
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
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setUploadStatus({
            active: true,
            total: files.length,
            current: 0,
            progress: 0,
            failures: [],
            currentFile: ''
        });

        // Use a loop to process files one by one (or in parallel batches if needed, but sequential is safer for now)
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setUploadStatus(prev => ({
                ...prev,
                current: i + 1,
                currentFile: file.name,
                progress: 0
            }));

            try {
                await uploadPhotoToFolder(currentPath, file, (percent) => {
                    setUploadStatus(prev => ({
                        ...prev,
                        progress: percent
                    }));
                });
            } catch (err) {
                console.error(`Failed to upload ${file.name}:`, err);
                setUploadStatus(prev => ({
                    ...prev,
                    failures: [...prev.failures, { name: file.name, error: err.message }]
                }));
            }
        }

        // Post-upload cleanup
        setRefreshTrigger(prev => prev + 1);

        // Wait a moment before clearing status if successful, or leave open if errors
        setUploadStatus(prev => {
            if (prev.failures.length === 0) {
                setTimeout(() => setUploadStatus(null), 2000); // Auto-hide after 2s if all success
                return { ...prev, active: false, currentFile: 'Done!', progress: 100 };
            } else {
                return { ...prev, active: false, currentFile: 'Finished with errors', progress: 100 };
            }
        });

        e.target.value = null; // Reset input
    };

    const handleShare = async (item) => {
        if (!item || item.type === 'folder') return;
        const url = getImageUrl(item.file_path);
        const fullUrl = window.location.origin + url;

        if (window.AndroidApp && typeof window.AndroidApp.shareFile === 'function') {
            window.AndroidApp.shareFile(fullUrl, item.title || item.name);
            return;
        }

        if (navigator.share) {
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                const file = new File([blob], `${item.title || 'photo'}.jpg`, { type: blob.type });

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: item.title,
                        files: [file]
                    });
                } else {
                    await navigator.share({
                        title: item.title,
                        url: fullUrl
                    });
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Share failed:', err);
                }
            }
        } else {
            // Fallback: Copy link to clipboard
            try {
                await navigator.clipboard.writeText(fullUrl);
                alert("Ссылка скопирована в буфер обмена");
            } catch (err) {
                alert("Ваш браузер не поддерживает функцию 'Поделиться'");
            }
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
        <div className="p-4 sm:p-6 relative min-h-screen pb-24 bg-transparent mt-12 sm:mt-0">
            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                accept="image/*"
                className="hidden"
            />

            <div className="px-0 sm:px-4"> {/* Container for content */}
                {viewMode === 'kaleidoscopes' ? (
                    <>
                        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <PlayCircle className="text-red-500" /> Калейдоскопы
                            </h1>
                            <div className="flex bg-black/40 p-1 rounded-lg self-start sm:self-auto border border-white/5">
                                <button
                                    onClick={() => setViewMode('photos')}
                                    className="px-6 py-2 rounded-md transition-all text-sm font-medium text-gray-400 hover:text-white"
                                >
                                    Фото
                                </button>
                                <button
                                    className="px-6 py-2 rounded-md transition-all text-sm font-bold text-white shadow-lg"
                                    style={{ backgroundColor: 'var(--accent-color)' }}
                                >
                                    Калейдоскопы
                                </button>
                            </div>
                        </header>
                        <KaleidoscopeViewer />
                    </>
                ) : (
                    <>
                        <header className="mb-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <div className="flex items-center gap-4">
                                    {currentPath && (
                                        <button
                                            onClick={handleBack}
                                            className="p-2 rounded-full hover:opacity-80 transition-colors"
                                            style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}
                                        >
                                            <ArrowLeft size={20} />
                                        </button>
                                    )}
                                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                        <ImageIcon style={{ color: 'var(--accent-color)' }} /> Галерея
                                    </h1>
                                </div>

                                {/* Minimalist Tab Switcher */}
                                <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 self-start sm:self-auto">
                                    <button
                                        className="px-6 py-2 rounded-md transition-all text-sm font-bold text-white shadow-lg"
                                        style={{ backgroundColor: 'var(--accent-color)' }}
                                    >
                                        Фото
                                    </button>
                                    <button
                                        onClick={() => setViewMode('kaleidoscopes')}
                                        className="px-6 py-2 rounded-md transition-all text-sm font-medium text-gray-400 hover:text-white"
                                    >
                                        Калейдоскопы
                                    </button>
                                </div>
                            </div>

                            {/* Breadcrumbs */}
                            <div className="text-sm flex flex-wrap items-center gap-2 p-2 rounded px-4 inline-flex max-w-full" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-secondary)' }}>
                                <span
                                    className={`cursor-pointer hover:opacity-80 ${!currentPath ? 'font-bold' : ''}`}
                                    style={{ color: !currentPath ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                                    onClick={() => setCurrentPath("")}
                                >
                                    Root
                                </span>
                                {currentPath.split('/').filter(Boolean).map((part, index, arr) => {
                                    const path = arr.slice(0, index + 1).join('/');
                                    return (
                                        <span key={path} className="flex items-center gap-2">
                                            <span>/</span>
                                            <span
                                                className={`cursor-pointer hover:text-white ${index === arr.length - 1 ? 'text-white font-semibold' : ''}`}
                                                onClick={() => setCurrentPath(path)}
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
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10 gap-2 sm:gap-3">
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
                                            select-none
                                        `}
                                            style={{ backgroundColor: 'var(--card-bg)', WebkitTouchCallout: 'none' }}
                                            tabIndex={0}
                                            data-tv-clickable="true"
                                            onClick={() => {
                                                if (isLongPress.current) return;
                                                isFolder ? handleFolderClick(item.name) : handlePhotoClick(item)
                                            }}
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
                        {selectedPhoto && (
                            <PhotoModal
                                item={selectedPhoto}
                                onClose={closePhotoModal}
                                onNext={() => navigatePhoto(1)}
                                onPrev={() => navigatePhoto(-1)}
                                hasNext={items.filter(item => item.type !== 'folder').findIndex(item => item.id === selectedPhoto.id) < items.filter(item => item.type !== 'folder').length - 1}
                                hasPrev={items.filter(item => item.type !== 'folder').findIndex(item => item.id === selectedPhoto.id) > 0}
                                onDelete={handleDelete}
                            />
                        )}
                    </>
                )}

                {/* Move Modal */}
                {moveItem && (
                    <MoveModal
                        item={moveItem}
                        currentPath={currentPath}
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
                            { label: "Открыть", onClick: () => contextMenu.item.type === 'folder' ? handleFolderClick(contextMenu.item.name) : handlePhotoClick(contextMenu.item), icon: <ImageIcon size={16} /> },
                            // Show "Rename" for folders and "Share" for photos
                            ...(contextMenu.item.type === 'folder'
                                ? [{ label: "Переименовать", onClick: () => handleRename(contextMenu.item), icon: <Edit size={16} /> }]
                                : [{ label: "Поделиться", onClick: () => handleShare(contextMenu.item), icon: <Share2 size={16} /> }]
                            ),
                            { label: "Переместить", onClick: () => setMoveItem(contextMenu.item), icon: <Move size={16} /> },
                            { label: 'Удалить', onClick: () => handleDelete(contextMenu.item), icon: <Trash2 size={16} />, className: 'text-red-500 hover:bg-red-500/20' }
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
                    {/* UPLOAD STATUS OVERLAY */}
                    {uploadStatus && (
                        <div className="fixed bottom-24 right-6 sm:right-8 bg-gray-900 border border-gray-700 p-4 rounded-lg shadow-xl z-50 w-80 max-w-[calc(100vw-3rem)]">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-white text-sm">
                                    {uploadStatus.active ? 'Загрузка...' : 'Загрузка завершена'}
                                </h3>
                                {!uploadStatus.active && (
                                    <button
                                        onClick={() => setUploadStatus(null)}
                                        className="text-gray-400 hover:text-white"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            <div className="text-xs text-gray-300 mb-2 truncate">
                                {uploadStatus.active
                                    ? `Uploading ${uploadStatus.current}/${uploadStatus.total}: ${uploadStatus.currentFile}`
                                    : `Uploaded ${uploadStatus.total - uploadStatus.failures.length} of ${uploadStatus.total} files`
                                }
                            </div>

                            {uploadStatus.active && (
                                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                                    <div
                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadStatus.progress}%` }}
                                    ></div>
                                </div>
                            )}

                            {uploadStatus.failures.length > 0 && (
                                <div className="mt-2 max-h-32 overflow-y-auto">
                                    <p className="text-red-400 text-xs font-bold mb-1">Errors:</p>
                                    {uploadStatus.failures.map((fail, idx) => (
                                        <div key={idx} className="text-red-400 text-xs truncate">
                                            • {fail.name}: {fail.error}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

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
        </div>
    );
}
