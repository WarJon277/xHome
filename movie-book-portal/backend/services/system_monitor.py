import psutil
import os
import platform

def get_directory_size(start_path = '.'):
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(start_path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                # skip if it is symbolic link
                if not os.path.islink(fp):
                    try:
                        total_size += os.path.getsize(fp)
                    except OSError:
                        pass
    except Exception:
        pass
    return total_size
def get_disk_for_path(path):
    """Определяет диск для указанного пути на Linux/Unix"""
    try:
        # Для Linux получаем точку монтирования
        path = os.path.abspath(path)
        
        # Ищем точку монтирования для этого пути
        best_match = None
        best_length = 0
        
        for partition in psutil.disk_partitions():
            mountpoint = partition.mountpoint
            if path.startswith(mountpoint):
                # Находим самую глубокую точку монтирования
                if len(mountpoint) > best_length:
                    best_length = len(mountpoint)
                    best_match = mountpoint
        
        if best_match:
            return best_match
        
        # Если не нашли, используем корень
        return '/'
    except Exception:
        return '/'

def get_system_stats(project_path: str, show_data_disk=False):
    # CPU
    cpu_percent = psutil.cpu_percent(interval=0.1)
    
    # RAM
    ram = psutil.virtual_memory()
    ram_stats = {
        "total": ram.total,
        "available": ram.available,
        "percent": ram.percent,
        "used": ram.used,
        "free": ram.free
    }

    # Disk - ВСЕГДА показываем /data если указан show_data_disk=True
    if show_data_disk:
        # Принудительно показываем диск /data
        try:
            disk = psutil.disk_usage('/data')
            disk_stats = {
                "path": "/data",
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": disk.percent
            }
        except Exception as e:
            # Если /data не доступен, показываем где проект
            drive = get_disk_for_path(project_path)
            disk = psutil.disk_usage(drive)
            disk_stats = {
                "path": drive,
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": disk.percent
            }
    else:
        # Старая логика
        try:
            # Определяем диск для проекта
            if platform.system() == "Windows":
                drive = os.path.splitdrive(project_path)[0]
                if not drive:
                    drive = "C:\\"
                else:
                    drive = drive + "\\"
            else:
                # Для Linux используем точку монтирования
                drive = get_disk_for_path(project_path)
            
            disk = psutil.disk_usage(drive)
            disk_stats = {
                "path": drive,
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": disk.percent
            }
        except Exception as e:
            # Fallback to root if specific drive fails
            try:
                disk = psutil.disk_usage('/')
                disk_stats = {
                    "path": "/",
                    "total": disk.total,
                    "used": disk.used,
                    "free": disk.free,
                    "percent": disk.percent
                }
            except:
                disk_stats = {
                    "path": "unknown",
                    "total": 0,
                    "used": 0,
                    "free": 0,
                    "percent": 0,
                    "error": str(e)
                }

    # Temperature
    temps = {}
    try:
        if hasattr(psutil, "sensors_temperatures"):
            temp_data = psutil.sensors_temperatures()
            if temp_data:
                for name, entries in temp_data.items():
                    if entries:
                        temps[name] = entries[0].current
    except Exception:
        pass
        
    # Project Folder Size
    project_size = get_directory_size(project_path)

    return {
        "cpu_percent": cpu_percent,
        "ram": ram_stats,
        "disk": disk_stats,
        "temperature": temps,
        "project_size": project_size
    }
