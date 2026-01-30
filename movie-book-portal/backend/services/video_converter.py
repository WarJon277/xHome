"""
Video converter using FFmpeg for MP4 conversion
"""
import subprocess
import os
import shutil
import re
from typing import Optional
from datetime import datetime

try:
    from tqdm import tqdm
    TQDM_AVAILABLE = True
except ImportError:
    TQDM_AVAILABLE = False

def log_message(message: str, log_file: str = None):
    """Log a message"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    msg = f"[{timestamp}] {message}"
    print(msg)
    
    if log_file:
        try:
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(msg + "\n")
        except Exception:
            pass

def check_ffmpeg_available() -> bool:
    """
    Check if FFmpeg is installed and available in PATH
    
    Returns:
        True if FFmpeg is available, False otherwise
    """
    try:
        result = subprocess.run(
            ['ffmpeg', '-version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
        return False

def get_video_info(video_path: str) -> Optional[dict]:
    """
    Get video file information using FFprobe
    
    Args:
        video_path: Path to video file
        
    Returns:
        Dictionary with video info or None
    """
    try:
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            video_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            import json
            return json.loads(result.stdout)
        return None
    except Exception:
        return None

def convert_to_mp4(input_path: str, output_path: str, delete_source: bool = False, log_file: str = None) -> bool:
    """
    Convert video file to MP4 format using FFmpeg with high quality settings
    
    Args:
        input_path: Path to input video file
        output_path: Path for output MP4 file
        delete_source: Whether to delete source file after successful conversion
        log_file: Optional path to log file
        
    Returns:
        True if conversion successful, False otherwise
    """
    try:
        if not os.path.exists(input_path):
            log_message(f"Input file not found: {input_path}", log_file)
            return False
        
        if not check_ffmpeg_available():
            log_message("FFmpeg is not available. Please install FFmpeg.", log_file)
            return False
        
        log_message(f"Processing video file: {input_path}", log_file)
        
        # Always re-encode to ensure proper audio channels (stereo)
        # Even if file is already MP4, it may have incompatible multi-channel audio
        
        # Create output directory if needed
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # FFmpeg command optimized for MAXIMUM SPEED
        # Strategy: Copy video stream (no re-encoding), only convert audio to stereo
        # This is 10-20x faster than re-encoding everything!
        # -c:v copy = copy video stream without re-encoding (instant!)
        # -c:a aac -ac 2 = only convert audio to stereo AAC (fast!)
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-c:v', 'copy',           # Copy video stream without re-encoding (FAST!)
            '-c:a', 'aac',            # AAC audio codec
            '-ac', '2',               # Force stereo audio (2 channels) for browser compatibility
            '-b:a', '192k',           # Audio bitrate
            '-movflags', '+faststart', # Enable streaming
            '-y',                      # Overwrite output file
            output_path
        ]
        
        # Run conversion
        log_message(f"Running FFmpeg conversion...", log_file)
        
        # Get video duration for progress bar
        duration_seconds = get_video_duration(input_path)
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True
        )
        
        # Monitor progress with progress bar
        stderr_output = []
        pbar = None
        
        # Pattern to extract time from FFmpeg output (e.g., "time=00:01:23.45")
        time_pattern = re.compile(r'time=(\d+):(\d+):(\d+\.\d+)')
        
        if TQDM_AVAILABLE and duration_seconds:
            pbar = tqdm(
                total=duration_seconds,
                desc="⏳ Конвертация",
                unit="сек",
                bar_format='{desc}: {percentage:3.0f}%|{bar}| {n:.0f}/{total:.0f} [{elapsed}<{remaining}, {rate_fmt}]'
            )
        
        for line in process.stderr:
            stderr_output.append(line)
            
            # Parse progress from FFmpeg output
            if 'time=' in line:
                match = time_pattern.search(line)
                if match and pbar:
                    hours = int(match.group(1))
                    minutes = int(match.group(2))
                    seconds = float(match.group(3))
                    current_time = hours * 3600 + minutes * 60 + seconds
                    
                    # Update progress bar
                    pbar.n = min(current_time, duration_seconds)
                    pbar.refresh()
                elif not TQDM_AVAILABLE and duration_seconds:
                    # Fallback: print progress without tqdm
                    match = time_pattern.search(line)
                    if match:
                        hours = int(match.group(1))
                        minutes = int(match.group(2))
                        seconds = float(match.group(3))
                        current_time = hours * 3600 + minutes * 60 + seconds
                        progress = (current_time / duration_seconds) * 100
                        print(f"\r⏳ Прогресс: {progress:.1f}%", end='', flush=True)
        
        if pbar:
            pbar.close()
        elif not TQDM_AVAILABLE and duration_seconds:
            print()  # New line after progress
        
        # Wait for completion
        process.wait()
        
        if process.returncode == 0 and os.path.exists(output_path):
            output_size = os.path.getsize(output_path) / (1024**3)
            log_message(f"Conversion successful! Output size: {output_size:.2f} GB", log_file)
            
            # Delete source file if requested
            if delete_source and input_path != output_path:
                try:
                    os.remove(input_path)
                    log_message(f"Deleted source file: {input_path}", log_file)
                except Exception as e:
                    log_message(f"Warning: Could not delete source file: {e}", log_file)
            
            return True
        else:
            error_msg = '\n'.join(stderr_output[-10:])  # Last 10 lines
            log_message(f"Conversion failed. FFmpeg error:\n{error_msg}", log_file)
            return False
            
    except Exception as e:
        log_message(f"Error during conversion: {e}", log_file)
        return False

def is_video_file(filename: str) -> bool:
    """
    Check if a file is a video based on extension
    
    Args:
        filename: Name or path of file
        
    Returns:
        True if it's a video file, False otherwise
    """
    video_extensions = [
        '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', 
        '.webm', '.m4v', '.3gp', '.3g2', '.ogv', '.qt', 
        '.mpg', '.mpeg', '.m2v', '.m4v'
    ]
    
    ext = os.path.splitext(filename)[1].lower()
    return ext in video_extensions

def get_video_duration(file_path: str) -> Optional[int]:
    """
    Get video duration in seconds using FFprobe
    
    Args:
        file_path: Path to video file
        
    Returns:
        Duration in seconds or None
    """
    try:
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            file_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return int(float(result.stdout.strip()))
        return None
    except Exception:
        return None
