import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { fetchVideos, deleteVideoFolder, deleteVideo, createVideoFolder, uploadVideoToFolder, moveVideo, moveVideoFolder, renameVideoFolder } from '../api';
import {
    Folder, MoreVertical, Download, Share2, CornerUpRight, Trash2,
    ChevronRight, Home, Upload, FolderPlus, ArrowLeft, Image as ImageIcon,
    PlayCircle, Play, Edit, Move, Share, Film
} from 'lucide-react';
import VideoModal from '../components/VideoModal';
import ContextMenu from '../components/ContextMenu';
import MoveModal from '../components/MoveModal';
import ConfirmationModal from '../components/ConfirmationModal';
import InputModal from '../components/InputModal';


export default function VideoGalleryPage() {
    // State
    const [items, setItems] = useState([]);
    const [currentPath, setCurrentPath] = useState(() => {
        // Initialize from localStorage to survive refreshes
        return localStorage.getItem('video_gallery_path') || '';
    });
    const [viewMode] = useState('photos'); // 'photos' or 'kaleidoscopes'
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
            const data = await fetchVideos(folder);

            // Client-side sorting: Folders first, then files
            const sorted = data.items.sort((a, b) => {
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                return (a.name || a.title || '').localeCompare(b.name || b.title || '');
            });

            setItems(sorted);
            setError(null);
        } catch (err) {
            console.error("Failed to load video gallery:", err);
            setError("Не удалось загрузить видеогалерею");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'photos') {
            loadItems(currentPath);
        }
        // Save path to localStorage
        localStorage.setItem('video_gallery_path', currentPath);

        // Define global callbacks for Android upload
        // These need to be always available in case the page reloads during upload
        window.onVideoUploadProgress = (filename, percent, current, total) => {
            if (percent === -1) {
                setUploadStatus(prev => ({
                    ...(prev || { active: true, total, failures: [] }),
                    failures: [...(prev?.failures || []), { name: filename, error: 'Upload failed' }]
                }));
            } else {
                setUploadStatus({
                    active: true,
                    total,
                    current,
                    progress: percent,
                    failures: [],
                    currentFile: filename
                });
            }
        };

        window.onVideoUploadComplete = () => {
            // Refresh list to show new files
            setRefreshTrigger(prev => prev + 1);
            // Show success for 1.5s then clear
            setUploadStatus(prev => prev ? { ...prev, active: false, progress: 100 } : null);
            setTimeout(() => setUploadStatus(null), 2000);
        };

        return () => {
            // Optional: clean up, but we want them to stay if page reloads
            // delete window.onVideoUploadProgress;
            // delete window.onVideoUploadComplete;
        };
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
                await deleteVideoFolder(fullPath);
            } else {
                await deleteVideo(item.path); // Adjusted based on backend: delete_video(path)
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
            await createVideoFolder({ name: name, parent: currentPath });
            setRefreshTrigger(prev => prev + 1); // Trigger refresh
            setInputModal(null);
        } catch {
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
            await renameVideoFolder(folderPath, newName);
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
                    await moveVideoFolder(item.path || item.name, targetFolder);
                } else {
                    await moveVideo(item.path || item.file_path, targetFolder);
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
        if (window.AndroidApp && typeof window.AndroidApp.pickVideos === 'function') {
            // Call native picker. Progress will be handled by global callbacks defined in useEffect
            window.AndroidApp.pickVideos(currentPath || '');

        } else if (window.AndroidApp) {
            // Old APK without pickVideos — warn user to update
            alert('Для загрузки видео обновите приложение xWV2 до последней версии.');

        } else {
            // Browser — standard file input
            fileInputRef.current.click();
        }
    };

    const processFiles = async (files) => {
        if (!files || files.length === 0) return;

        setUploadStatus({
            active: true,
            total: files.length,
            current: 0,
            progress: 0,
            failures: [],
            currentFile: 'Starting...'
        });

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            setUploadStatus(prev => {
                const safePrev = prev || { active: true, total: files.length, failures: [] };
                return {
                    ...safePrev,
                    current: i + 1,
                    currentFile: file.name,
                    progress: 0
                };
            });

            try {
                await uploadVideoToFolder(currentPath, file, (percent) => {
                    setUploadStatus(prev => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            progress: percent
                        };
                    });
                });
            } catch (err) {
                console.error(`Failed to upload ${file.name}:`, err);
                setUploadStatus(prev => {
                    const safePrev = prev || { active: true, total: files.length, failures: [] };
                    return {
                        ...safePrev,
                        failures: [...safePrev.failures, { name: file.name, error: err.message }]
                    };
                });
            }
        }

        setRefreshTrigger(prev => prev + 1);

        setUploadStatus(prev => {
            const safePrev = prev || { failures: [] };
            if (safePrev.failures.length === 0) {
                setTimeout(() => setUploadStatus(null), 2000);
                return { ...safePrev, active: false, currentFile: 'Done!', progress: 100 };
            } else {
                return { ...safePrev, active: false, currentFile: 'Finished with errors', progress: 100 };
            }
        });
    };

    const handleFileChange = async (e) => {
        try {
            const files = Array.from(e.target.files || []);
            await processFiles(files);
        } catch (err) {
            console.error("Critical upload error:", err);
            alert("Ошибка при запуске загрузки: " + err.message);
        } finally {
            if (e.target) e.target.value = null;
        }
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
            } catch {
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
                accept="video/*"
                className="hidden"
            />

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
                            <Film style={{ color: 'var(--accent-color)' }} /> Видеогалерея
                        </h1>
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

            {error && <div className="text-center text-red-500 mt-10">{error}</div>}
            {
                loading ? (
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
                                                    alt={item.title || item.name}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2">
                                                    <Film size={40} className="text-gray-500" />
                                                    <span className="text-gray-400 text-xs text-center truncate w-full px-1">{item.title || item.name}</span>
                                                </div>
                                            )}
                                            {/* Permanent Small Play Icon in Corner */}
                                            <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm p-1 rounded-md border border-white/20 z-10 pointer-events-none">
                                                <Play size={14} className="text-white fill-current" />
                                            </div>

                                            {/* Hover Large Play icon overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                                                <PlayCircle size={48} className="text-white drop-shadow-2xl" />
                                            </div>
                                            {/* Hover Info */}
                                            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2">
                                                <span className="text-white text-xs font-medium truncate w-full block">{item.title || item.name}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            }

            {/* Video Playback Modal */}
            {
                selectedPhoto && (
                    <VideoModal
                        item={selectedPhoto}
                        onClose={closePhotoModal}
                        onNext={() => navigatePhoto(1)}
                        onPrev={() => navigatePhoto(-1)}
                        hasNext={items.filter(item => item.type !== 'folder').findIndex(item => item.id === selectedPhoto.id) < items.filter(item => item.type !== 'folder').length - 1}
                        hasPrev={items.filter(item => item.type !== 'folder').findIndex(item => item.id === selectedPhoto.id) > 0}
                        onDelete={handleDelete}
                    />
                )
            }

            {/* Move Modal */}
            {
                moveItem && (
                    <MoveModal
                        item={moveItem}
                        currentPath={currentPath}
                        onClose={() => setMoveItem(null)}
                        onMove={handleMoveAction}
                    />
                )
            }

            {/* Context Menu */}
            {
                contextMenu && (
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
                )
            }

            {/* CONFIRMATION MODAL */}
            {
                confirmModal && (
                    <ConfirmationModal
                        title={confirmModal.title}
                        message={confirmModal.message}
                        onClose={() => setConfirmModal(null)}
                        onConfirm={confirmModal.onConfirm}
                        confirmLabel={confirmModal.confirmLabel}
                        isDanger={confirmModal.isDanger}
                    />
                )
            }

            {/* INPUT MODAL */}
            {
                inputModal && (
                    <InputModal
                        title={inputModal.title}
                        initialValue={inputModal.initialValue}
                        placeholder={inputModal.placeholder}
                        confirmLabel={inputModal.confirmLabel}
                        onClose={() => setInputModal(null)}
                        onConfirm={inputModal.onConfirm}
                    />
                )
            }

            {/* Floating Action Buttons (FABs) */}
            {createPortal(
                <div
                    className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 flex flex-col gap-4 z-[9999]"
                    style={{ pointerEvents: 'none' }}
                >
                    {/* UPLOAD STATUS OVERLAY */}
                    {uploadStatus && (
                        <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-2xl w-80 max-w-[calc(100vw-3rem)] pointer-events-auto mb-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
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

                    <div className="flex flex-col gap-4 pointer-events-auto items-end">
                        <button
                            onClick={handleCreateFolder}
                            className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-full shadow-2xl text-white transition-all hover:scale-110 active:scale-95 border border-gray-700 hover:border-gray-600 group"
                            title="Создать папку"
                        >
                            <FolderPlus size={24} className="group-hover:text-blue-400 transition-colors" />
                        </button>
                        <button
                            onClick={handleUploadClick}
                            className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full shadow-2xl text-white transition-all hover:scale-110 active:scale-95 border border-blue-500 hover:border-blue-400 group relative"
                            title="Загрузить видео"
                        >
                            <Upload size={28} className="group-hover:translate-y-[-2px] transition-transform" />
                            <div className="absolute inset-0 rounded-full bg-blue-400 opacity-0 group-hover:animate-ping pointer-events-none"></div>
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
