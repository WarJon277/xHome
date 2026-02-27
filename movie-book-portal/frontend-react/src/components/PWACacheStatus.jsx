import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ShieldCheck, ShieldAlert, RefreshCw, Smartphone } from 'lucide-react';

export default function PWACacheStatus() {
    const swResult = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ', r);
        },
        onRegisterError(error) {
            console.error('SW Registration error', error);
        },
    });

    // Handle case where vite-plugin-pwa hook is not available or returns undefined
    if (!swResult) {
        console.warn('PWACacheStatus: useRegisterSW returned undefined. PWA features may be disabled.');
        return (
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-2 text-gray-500">
                <Smartphone size={20} />
                <span className="text-sm">Оффлайн режим недоступен</span>
            </div>
        );
    }

    const {
        offlineReady: [offlineReady, setOfflineReady] = [false, () => { }],
        needUpdate: [needUpdate, setNeedUpdate] = [false, () => { }],
        updateServiceWorker,
    } = swResult;

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
        // Service Workers require HTTPS or localhost (Secure Context)
        const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (!isSecure) {
            return {
                label: 'Оффлайн недоступен (нужен HTTPS)',
                color: 'text-red-400',
                icon: ShieldAlert,
                detail: 'Браузер отключает кэш на обычных IP-адресах без защиты.'
            };
        }

        if (!('serviceWorker' in navigator)) {
            return {
                label: 'SW не поддерживается',
                color: 'text-gray-500',
                icon: Smartphone,
                detail: 'Ваш браузер не поддерживает Service Workers.'
            };
        }

        if (needUpdate) return {
            label: 'Доступно обновление',
            color: 'text-yellow-500',
            icon: ShieldAlert,
            detail: 'Доступна новая версия приложения.'
        };

        if (offlineReady || swActive) return {
            label: 'Готов к оффлайн',
            color: 'text-green-500',
            icon: ShieldCheck,
            detail: 'Приложение сохранено в памяти и будет работать без интернета.'
        };

        return {
            label: 'Скачивание кэша...',
            color: 'text-blue-400',
            icon: Smartphone,
            detail: 'Приложение подготавливает файлы для работы оффлайн.'
        };
    };

    const status = getStatus();
    const StatusIcon = status.icon;

    return (
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col gap-3 hover:bg-white/10 transition-all group">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                    <StatusIcon className={`${status.color} shrink-0`} size={20} />
                    <span className="text-sm font-bold truncate" title={status.label}>{status.label}</span>
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

            <p className="text-[11px] text-gray-400 leading-tight">
                {status.detail}
            </p>

            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center justify-between pt-1 border-t border-white/5">
                <span>Кэш приложения</span>
                {(offlineReady || swActive) ? (
                    <span className="text-green-600 bg-green-600/10 px-1.5 rounded">Активен</span>
                ) : (
                    <span className="text-gray-500 italic opacity-50">Неактивен</span>
                )}
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
