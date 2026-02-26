import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ShieldCheck, ShieldAlert, RefreshCw, Smartphone } from 'lucide-react';

export default function PWACacheStatus() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needUpdate: [needUpdate, setNeedUpdate],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ', r);
        },
        onRegisterError(error) {
            console.error('SW Registration error', error);
        },
    });

    const [isChecking, setIsChecking] = useState(false);
    const [swActive, setSwActive] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
                setSwActive(!!registration.active);
            });
        }
    }, []);

    const handleUpdate = async () => {
        setIsChecking(true);
        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await registration.update();
                    // If we have a waiting worker, updateServiceWorker(true) will reload
                    if (needUpdate) {
                        updateServiceWorker(true);
                    }
                }
            }
        } catch (err) {
            console.error("Manual cache update failed:", err);
        } finally {
            // Artificial delay for UX
            setTimeout(() => setIsChecking(false), 1000);
        }
    };

    const getStatus = () => {
        if (needUpdate) return { label: 'Доступно обновление', color: 'text-yellow-500', icon: ShieldAlert };
        if (offlineReady || swActive) return { label: 'Готов к оффлайн', color: 'text-green-500', icon: ShieldCheck };
        return { label: 'Только онлайн', color: 'text-gray-500', icon: Smartphone };
    };

    const status = getStatus();
    const StatusIcon = status.icon;

    return (
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col gap-3 hover:bg-white/10 transition-all group">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <StatusIcon className={status.color} size={20} />
                    <span className="text-sm font-bold truncate max-w-[120px]">{status.label}</span>
                </div>
                <button
                    onClick={handleUpdate}
                    disabled={isChecking}
                    className={`p-2 rounded-xl bg-white/5 hover:bg-white/20 transition-all ${isChecking ? 'animate-spin' : 'active:scale-95'}`}
                    title="Проверить обновление кэша"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center justify-between">
                <span>Кэш приложения</span>
                {offlineReady && <span className="text-green-600 bg-green-600/10 px-1.5 rounded">Активен</span>}
            </div>

            {needUpdate && (
                <button
                    onClick={() => updateServiceWorker(true)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg"
                >
                    Установить обновление
                </button>
            )}
        </div>
    );
}
