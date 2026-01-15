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

def get_system_stats(project_path: str):
    # CPU
    # interval=0.1 makes it block for 100ms to get an accurate reading
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

    # Disk
    # Use the drive where the project is located.
    drive = os.path.splitdrive(project_path)[0]
    if not drive:
        drive = "/"
    else:
        drive = drive + "\\"
        
    try:
        disk = psutil.disk_usage(drive)
        disk_stats = {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "percent": disk.percent
        }
    except Exception:
         # Fallback to root if specific drive fails
        disk = psutil.disk_usage('/')
        disk_stats = {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "percent": disk.percent
        }

    # Temperature
    temps = {}
    try:
        if hasattr(psutil, "sensors_temperatures"):
            temp_data = psutil.sensors_temperatures()
            if temp_data:
                for name, entries in temp_data.items():
                    # Just take the first reading for each sensor
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
