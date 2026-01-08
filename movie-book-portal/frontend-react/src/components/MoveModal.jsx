import { useState, useEffect } from 'react';
import { X, Folder, ArrowLeft, Check, Home } from 'lucide-react';
import { fetchPhotos } from '../api';

export default function MoveModal({ item, currentPath, onClose, onMove }) {
    const [browsePath, setBrowsePath] = useState(""); // Start at root
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFolders(browsePath);
    }, [browsePath]);

    const loadFolders = async (path) => {
        setLoading(true);
        try {
            const data = await fetchPhotos(path);
            // Filter only folders
            const folderList = data.filter(i => i.type === 'folder');
            setFolders(folderList);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (folderName) => {
        const newPath = browsePath ? `${browsePath}/${folderName}` : folderName;
        // Check if we are trying to enter the folder we are moving (cycle prevention)
        if (item.type === 'folder' && (item.path === newPath || newPath.startsWith(item.path + '/'))) {
            return; // Cannot move folder into itself
        }
        setBrowsePath(newPath);
    };

    const handleUp = () => {
        if (!browsePath) return;
        const parts = browsePath.split('/');
        parts.pop();
        setBrowsePath(parts.join('/'));
    };

    const handleConfirm = () => {
        // Prevent moving to same folder
        if (browsePath === currentPath) {
            alert("Файл уже находится в этой папке");
            return;
        }
        onMove(browsePath);
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] rounded-xl max-w-md w-full border border-gray-700 overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-[#252525]">
                    <h3 className="text-white font-bold truncate pr-4">
                        Переместить "{item.name}"
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
                </div>

                {/* Navigation Header */}
                <div className="bg-[#2a2a2a] p-3 flex items-center gap-2 text-sm border-b border-gray-700">
                    {browsePath ? (
                        <button onClick={handleUp} className="p-1 hover:bg-white/10 rounded text-gray-300">
                            <ArrowLeft size={16} />
                        </button>
                    ) : (
                        <div className="p-1"><Home size={16} className="text-gray-500" /></div>
                    )}
                    <div className="text-gray-300 font-mono truncate flex-1">
                        {browsePath || "Root"}
                    </div>
                </div>

                <div className="p-2 overflow-y-auto flex-1 min-h-[300px]">
                    {loading ? (
                        <div className="text-center text-gray-500 py-8">Загрузка...</div>
                    ) : (
                        <div className="space-y-1">
                            {folders.length === 0 && (
                                <div className="text-center text-gray-500 py-8">Папок нет</div>
                            )}

                            {folders.map(folder => {
                                // Check if this is the folder being moved - disable it visually
                                const isSelf = item.type === 'folder' && folder.name === item.name;

                                if (isSelf) return null;

                                return (
                                    <button
                                        key={folder.name}
                                        onClick={() => handleNavigate(folder.name)}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 text-left transition-colors text-white group"
                                    >
                                        <Folder className="text-blue-500 group-hover:text-blue-400" size={20} />
                                        <span className="flex-1 truncate">{folder.name}</span>
                                        <span className="text-gray-500 text-xs">Открыть</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-4 border-t border-gray-700 bg-[#252525] flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-300 hover:text-white"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={browsePath === currentPath} // Disable if target is source
                        className={`
                            px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2
                            ${browsePath === currentPath
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'}
                        `}
                    >
                        <Check size={16} />
                        Переместить сюда
                    </button>
                </div>
            </div>
        </div>
    );
}
