from fastapi import APIRouter
from services.system_monitor import get_system_stats
import os

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/stats")
async def get_stats():
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
    
    return get_system_stats(project_root)
