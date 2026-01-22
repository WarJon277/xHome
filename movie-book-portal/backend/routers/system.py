from fastapi import APIRouter
from services.system_monitor import get_system_stats
import os

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/stats")
async def get_stats(show_data_disk: bool = False):
    # Calculate project root (assuming backend/routers/ is where this file could be, 
    # but imports suggest we are running from backend dir or similar)
    # The file we are writing is backend/routers/system.py
    # So project root is two levels up -> backend -> project_root
    
    # However, getcwd usually is where main.py runs.
    # Let's rely on finding 'backend' in path or just relative to this file.
    
    # current file: .../backend/routers/system.py
    # backend dir: .../backend
    # project root: .../
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    project_root = os.path.dirname(backend_dir)
    
    return get_system_stats(project_root, show_data_disk=show_data_disk)

@router.get("/discovery-status")
async def get_discovery_status():
    """Get status of all auto-discovery scripts"""
    import json
    from datetime import datetime
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    
    # Helper function to read settings
    def read_settings(filename):
        try:
            settings_path = os.path.join(backend_dir, filename)
            if os.path.exists(settings_path):
                with open(settings_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error reading {filename}: {e}")
        return {}
    
    # Helper function to parse log file
    def parse_log(filename, max_lines=10):
        try:
            log_path = os.path.join(backend_dir, filename)
            if not os.path.exists(log_path):
                return {
                    "last_run": None,
                    "last_success": None,
                    "recent_activity": [],
                    "status": "idle"
                }
            
            with open(log_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # Get last N lines
            recent_lines = lines[-max_lines:] if len(lines) > max_lines else lines
            recent_activity = [line.strip() for line in recent_lines if line.strip()]
            
            # Find last run timestamp
            last_run = None
            last_success = None
            status = "idle"
            
            for line in reversed(lines):
                # Extract timestamp from log format: [2026-01-22 21:00:00]
                if '[' in line and ']' in line:
                    try:
                        timestamp_str = line[line.find('[')+1:line.find(']')]
                        if not last_run:
                            last_run = timestamp_str
                        
                        # Check for success indicators
                        if not last_success:
                            if 'Successfully added' in line or 'успешно добавлен' in line.lower():
                                # Extract title
                                if 'book:' in line.lower():
                                    last_success = line.split('book:')[-1].strip()
                                elif 'audiobook:' in line.lower():
                                    last_success = line.split('audiobook:')[-1].strip()
                                elif 'movie:' in line.lower() or 'фильм:' in line.lower():
                                    last_success = line.split(':')[-1].strip()
                                else:
                                    last_success = "Item downloaded"
                        
                        # Check if currently running
                        if 'Starting' in line and 'cycle' in line:
                            # Check if this was recent (within last 5 minutes)
                            try:
                                log_time = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                                now = datetime.now()
                                diff = (now - log_time).total_seconds()
                                if diff < 300:  # 5 minutes
                                    status = "running"
                            except:
                                pass
                    except:
                        continue
            
            return {
                "last_run": last_run,
                "last_success": last_success,
                "recent_activity": recent_activity,
                "status": status
            }
        except Exception as e:
            print(f"Error parsing {filename}: {e}")
            return {
                "last_run": None,
                "last_success": None,
                "recent_activity": [],
                "status": "error"
            }
    
    # Helper to calculate next run time
    def calculate_next_run(last_run_str, interval_minutes):
        if not last_run_str or not interval_minutes:
            return None
        try:
            last_run = datetime.strptime(last_run_str, '%Y-%m-%d %H:%M:%S')
            from datetime import timedelta
            next_run = last_run + timedelta(minutes=interval_minutes)
            return next_run.strftime('%Y-%m-%d %H:%M:%S')
        except:
            return None
    
    # Read settings
    auto_settings = read_settings('auto_discovery_settings.json')
    movie_settings = read_settings('movie_discovery_settings.json')
    
    # Parse logs
    auto_log = parse_log('auto_discovery.log')
    movie_log = parse_log('movie_discovery.log')
    
    # Build response
    return {
        "books": {
            "enabled": auto_settings.get("enabled", False),
            "interval_minutes": auto_settings.get("book_interval_minutes", auto_settings.get("interval_minutes", 60)),
            "last_run": auto_log["last_run"],
            "next_run": calculate_next_run(auto_log["last_run"], auto_settings.get("book_interval_minutes", auto_settings.get("interval_minutes", 60))),
            "last_success": auto_log["last_success"],
            "recent_activity": auto_log["recent_activity"],
            "status": auto_log["status"]
        },
        "audiobooks": {
            "enabled": auto_settings.get("enabled", False),
            "interval_minutes": auto_settings.get("audiobook_interval_minutes", auto_settings.get("interval_minutes", 60)),
            "last_run": auto_log["last_run"],
            "next_run": calculate_next_run(auto_log["last_run"], auto_settings.get("audiobook_interval_minutes", auto_settings.get("interval_minutes", 60))),
            "last_success": auto_log["last_success"],
            "recent_activity": auto_log["recent_activity"],
            "status": auto_log["status"]
        },
        "movies": {
            "enabled": movie_settings.get("enabled", False),
            "interval_minutes": movie_settings.get("interval_minutes", 720),
            "last_run": movie_log["last_run"],
            "next_run": calculate_next_run(movie_log["last_run"], movie_settings.get("interval_minutes", 720)),
            "last_success": movie_log["last_success"],
            "recent_activity": movie_log["recent_activity"],
            "status": movie_log["status"]
        }
    }

@router.post("/discovery-restart/{discovery_type}")
async def restart_discovery(discovery_type: str):
    """Restart/Force run discovery for specific type"""
    import json
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    
    if discovery_type not in ["books", "audiobooks", "movies"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid discovery type")
    
    try:
        if discovery_type == "movies":
            settings_path = os.path.join(backend_dir, "movie_discovery_settings.json")
            if os.path.exists(settings_path):
                with open(settings_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Set force flag
                data["force_run"] = True
                
                with open(settings_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4, ensure_ascii=False)
                return {"status": "success", "message": "Movie discovery triggered"}
        
        else: # books or audiobooks
            settings_path = os.path.join(backend_dir, "auto_discovery_settings.json")
            if os.path.exists(settings_path):
                with open(settings_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Set specific force flag
                if discovery_type == "books":
                    data["force_run_books"] = True
                elif discovery_type == "audiobooks":
                    data["force_run_audiobooks"] = True
                
                with open(settings_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4, ensure_ascii=False)
                return {"status": "success", "message": f"{discovery_type.capitalize()} discovery triggered"}
                
    except Exception as e:
        print(f"Error triggering restart: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))
    
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Settings file not found")

@router.post("/discovery-settings")
async def update_discovery_settings(settings: dict):
    """Update discovery settings (interval)"""
    import json
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    
    discovery_type = settings.get("type")
    interval = settings.get("interval_minutes")
    
    if not discovery_type or not interval:
         from fastapi import HTTPException
         raise HTTPException(status_code=400, detail="Missing required fields")
    
    try:
        interval = int(interval)
        if interval < 1:
            raise ValueError("Interval must be positive")
            
        if discovery_type == "movies":
            settings_path = os.path.join(backend_dir, "movie_discovery_settings.json")
            if os.path.exists(settings_path):
                with open(settings_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                data["interval_minutes"] = interval
                
                with open(settings_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4, ensure_ascii=False)
                return {"status": "success", "message": "Settings updated"}
        
        else: # books or audiobooks
            settings_path = os.path.join(backend_dir, "auto_discovery_settings.json")
            if os.path.exists(settings_path):
                with open(settings_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                if discovery_type == "books":
                    data["book_interval_minutes"] = interval
                elif discovery_type == "audiobooks":
                    data["audiobook_interval_minutes"] = interval
                
                # Also ensure enabled is true if we set interval? No, keep logic separate.
                
                with open(settings_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4, ensure_ascii=False)
                return {"status": "success", "message": "Settings updated"}
                
    except Exception as e:
        print(f"Error updating settings: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))
    
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Settings file not found")
