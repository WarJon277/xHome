"""
Torrent downloader using qBittorrent client via API
Requires qBittorrent installed and running with Web UI enabled
"""
from qbittorrentapi import Client
import time
import os
from typing import Optional
from datetime import datetime

def log_progress(message: str, log_file: str = None):
    """Log progress message"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    msg = f"[{timestamp}] {message}"
    print(msg)
    
    if log_file:
        try:
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(msg + "\n")
        except Exception:
            pass

def download_torrent(
    torrent_url: str, 
    save_path: str, 
    timeout: int = 7200, 
    log_file: str = None,
    referer: str = None,  # NEW: Referer header for kinorush protection
    qbt_host: str = "localhost",
    qbt_port: int = 8080,
    qbt_username: str = "admin",
    qbt_password: str = "adminadmin"
) -> Optional[str]:
    """
    Download torrent file using qBittorrent and return path to the largest video file
    
    Args:
        torrent_url: URL to .torrent file
        save_path: Directory to save downloaded files
        timeout: Maximum wait time in seconds (default 2 hours)
        log_file: Optional path to log file
        referer: Referer URL (page where torrent link was found)
        qbt_host: qBittorrent host (default: localhost)
        qbt_port: qBittorrent Web UI port (default: 8080)
        qbt_username: qBittorrent username (default: admin)
        qbt_password: qBittorrent password (default: adminadmin)
        
    Returns:
        Tuple of (video_file_path, torrent_hash), or (None, None) if download fails
    """
    try:
        os.makedirs(save_path, exist_ok=True)
        
        log_progress(f"Connecting to qBittorrent at {qbt_host}:{qbt_port}", log_file)
        
        # Connect to qBittorrent
        try:
            qbt_client = Client(
                host=qbt_host,
                port=qbt_port,
                username=qbt_username,
                password=qbt_password
            )
            # Test connection
            qbt_client.auth_log_in()
            log_progress("Successfully connected to qBittorrent", log_file)
        except Exception as e:
            log_progress(f"Failed to connect to qBittorrent: {e}", log_file)
            log_progress("Make sure qBittorrent is running with Web UI enabled", log_file)
            return None, None
        
        log_progress(f"Adding torrent from: {torrent_url}", log_file)
        
        # Download torrent file with proper headers
        import requests
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        # Create session to maintain cookies
        session = requests.Session()
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection': 'keep-alive',
        }
        
        # Add referer if provided (CRITICAL for kinorush.name)
        if referer:
            headers['Referer'] = referer
            log_progress(f"Using Referer: {referer}", log_file)
        
        try:
            # First visit the main page to get cookies
            if referer:
                session.get(referer, headers=headers, timeout=10, verify=False)
            
            # Now download the torrent file
            response = session.get(torrent_url, headers=headers, timeout=30, verify=False, allow_redirects=True)
            response.raise_for_status()
            
            # Check if we got HTML instead of torrent
            content_type = response.headers.get('Content-Type', '')
            if 'text/html' in content_type or b'<!DOCTYPE' in response.content[:100] or b'<html' in response.content[:100]:
                log_progress(f"ERROR: Received HTML instead of torrent file. Site may be blocking downloads.", log_file)
                log_progress(f"Content-Type: {content_type}", log_file)
                log_progress(f"First 200 bytes: {response.content[:200]}", log_file)
                return None
            
            # Save torrent file temporarily
            temp_torrent_path = os.path.join(save_path, "temp_download.torrent")
            with open(temp_torrent_path, 'wb') as f:
                f.write(response.content)
            
            log_progress(f"Torrent file downloaded", log_file)
        except Exception as e:
            log_progress(f"Failed to download torrent file: {e}", log_file)
            return None, None
        
        # Add torrent to qBittorrent
        try:
            torrent = qbt_client.torrents_add(
                torrent_files=temp_torrent_path,
                save_path=save_path,
                is_paused=False
            )
            
            # Give it a moment to be added
            time.sleep(2)
            
            # Get torrent info
            torrents = qbt_client.torrents_info()
            if not torrents:
                log_progress("Failed to add torrent to qBittorrent", log_file)
                return None, None
            
            # Find our torrent (should be the last one added)
            torrent_hash = None
            for t in torrents:
                if t.save_path == save_path or save_path in t.save_path:
                    torrent_hash = t.hash
                    torrent_name = t.name
                    log_progress(f"Torrent added: {torrent_name}", log_file)
                    break
            
            if not torrent_hash:
                # Just use the first torrent as fallback
                torrent_hash = torrents[-1].hash
                torrent_name = torrents[-1].name
                log_progress(f"Using torrent: {torrent_name}", log_file)
            
        except Exception as e:
            log_progress(f"Failed to add torrent: {e}", log_file)
            return None, None
        finally:
            # Clean up temp torrent file
            try:
                os.remove(temp_torrent_path)
            except:
                pass
        
        # Wait for download to complete
        log_progress("Starting download...", log_file)
        start_time = time.time()
        last_progress = -1
        last_download_time = time.time()  # Track when we last saw download activity
        stall_timeout = 180  # 3 minutes in seconds
        
        while True:
            # Check timeout
            if time.time() - start_time > timeout:
                log_progress(f"Download timeout after {timeout} seconds", log_file)
                try:
                    qbt_client.torrents_delete(delete_files=True, torrent_hashes=torrent_hash)
                except:
                    pass
                return None, None
            
            # Get torrent status
            try:
                torrent_info = qbt_client.torrents_info(torrent_hashes=torrent_hash)
                if not torrent_info:
                    log_progress("Torrent not found in client", log_file)
                    return None, None
                
                info = torrent_info[0]
                progress = int(info.progress * 100)
                state = info.state
                dlspeed = info.dlspeed
                
                # Check for stalled download (no activity for 3 minutes)
                if dlspeed > 0:
                    # Reset stall timer if we're downloading
                    last_download_time = time.time()
                elif time.time() - last_download_time > stall_timeout and progress < 100:
                    # No download activity for 3 minutes and not complete
                    log_progress(f"Torrent stalled (no download for {stall_timeout}s). Aborting...", log_file)
                    try:
                        qbt_client.torrents_delete(delete_files=True, torrent_hashes=torrent_hash)
                    except:
                        pass
                    return None, None
                
                # Log progress every 10%
                if progress != last_progress and progress % 10 == 0:
                    log_progress(
                        f"Download progress: {progress}% "
                        f"(Down: {dlspeed / 1000:.1f} KB/s, "
                        f"Up: {info.upspeed / 1000:.1f} KB/s, "
                        f"Peers: {info.num_seeds})",
                        log_file
                    )
                    last_progress = progress
                
                # Check if completed
                if state in ['uploading', 'stalledUP', 'pausedUP'] or progress >= 100:
                    log_progress("Download complete!", log_file)
                    break
                
                # Check for errors
                if state == 'error':
                    log_progress(f"Download error: {info.state}", log_file)
                    try:
                        qbt_client.torrents_delete(delete_files=True, torrent_hashes=torrent_hash)
                    except:
                        pass
                    return None, None
                
            except Exception as e:
                log_progress(f"Error checking torrent status: {e}", log_file)
                time.sleep(5)
                continue
            
            time.sleep(2)
        
        # Find largest video file
        log_progress("Finding video file...", log_file)
        
        video_extensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v']
        largest_video = None
        largest_size = 0
        
        try:
            files = qbt_client.torrents_files(torrent_hash)
            for file_info in files:
                file_path = os.path.join(save_path, file_info.name)
                file_size = file_info.size
                file_ext = os.path.splitext(file_info.name)[1].lower()
                
                if file_ext in video_extensions and file_size > largest_size:
                    largest_size = file_size
                    largest_video = file_path
        except Exception as e:
            log_progress(f"Error getting file list from qBittorrent: {e}", log_file)
            # Fallback: search filesystem
            for root, dirs, files in os.walk(save_path):
                for file in files:
                    file_ext = os.path.splitext(file)[1].lower()
                    if file_ext in video_extensions:
                        file_path = os.path.join(root, file)
                        try:
                            file_size = os.path.getsize(file_path)
                            if file_size > largest_size:
                                largest_size = file_size
                                largest_video = file_path
                        except:
                            continue
        
        if largest_video and os.path.exists(largest_video):
            log_progress(f"Found video file: {largest_video} ({largest_size / (1024**3):.2f} GB)", log_file)
            return largest_video, torrent_hash  # Return both video path and hash
        else:
            log_progress("No video file found in torrent", log_file)
            return None, None
            
    except Exception as e:
        log_progress(f"Error downloading torrent: {e}", log_file)
        return None, None

def check_qbittorrent_connection(
    qbt_host: str = "localhost",
    qbt_port: int = 8080,
    qbt_username: str = "admin",
    qbt_password: str = "adminadmin"
) -> bool:
    """
    Check if qBittorrent is running and accessible
    
    Returns:
        True if connection successful, False otherwise
    """
    try:
        qbt_client = Client(
            host=qbt_host,
            port=qbt_port,
            username=qbt_username,
            password=qbt_password
        )
        qbt_client.auth_log_in()
        return True
    except Exception:
        return False

def remove_torrent(
    torrent_hash: str,
    qbt_host: str = "localhost",
    qbt_port: int = 8080,
    qbt_username: str = "admin",
    qbt_password: str = "adminadmin",
    log_file: str = None
) -> bool:
    """
    Stop and remove torrent from qBittorrent
    
    Args:
        torrent_hash: Hash of the torrent to remove
        qbt_host: qBittorrent host
        qbt_port: qBittorrent Web UI port
        qbt_username: qBittorrent username
        qbt_password: qBittorrent password
        log_file: Optional path to log file
        
    Returns:
        True if removal successful, False otherwise
    """
    try:
        qbt_client = Client(
            host=qbt_host,
            port=qbt_port,
            username=qbt_username,
            password=qbt_password
        )
        qbt_client.auth_log_in()
        
        # Pause torrent first
        qbt_client.torrents_pause(torrent_hashes=torrent_hash)
        log_progress(f"Paused torrent {torrent_hash}", log_file)
        
        # Delete torrent (but keep files - they're already converted)
        qbt_client.torrents_delete(delete_files=False, torrent_hashes=torrent_hash)
        log_progress(f"Removed torrent {torrent_hash} from qBittorrent", log_file)
        
        return True
    except Exception as e:
        log_progress(f"Error removing torrent: {e}", log_file)
        return False
