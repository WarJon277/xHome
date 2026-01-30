"""
Video converter using FFmpeg for MP4 conversion
"""
import subprocess
import os
import shutil
from typing import Optional
from datetime import datetime

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
        
        # Check if input is already MP4
        if input_path.lower().endswith('.mp4'):
            log_message(f"File is already MP4, copying to output location", log_file)
            try:
                shutil.copy2(input_path, output_path)
                if delete_source and input_path != output_path:
                    os.remove(input_path)
                return True
            except Exception as e:
                log_message(f"Error copying MP4 file: {e}", log_file)
                return False
        
        log_message(f"Converting {input_path} to MP4...", log_file)
        
        # Create output directory if needed
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # FFmpeg command with optimized settings for speed and browser compatibility
        # Using H.264 codec with CRF=23 for good quality/speed balance
        # -preset faster for quicker encoding (was 'medium')
        # -ac 2 forces stereo audio (browsers don't support 5.1/multi-channel)
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-c:v', 'libx264',        # H.264 video codec
            '-crf', '23',              # Constant Rate Factor (23 = good quality, faster than 18)
            '-preset', 'faster',       # Encoding speed (faster = quicker conversion)
            '-c:a', 'aac',            # AAC audio codec
            '-ac', '2',               # Force stereo audio (2 channels) for browser compatibility
            '-b:a', '192k',           # Audio bitrate
            '-movflags', '+faststart', # Enable streaming
            '-y',                      # Overwrite output file
            output_path
        ]
        
        # Run conversion
        log_message(f"Running FFmpeg conversion...", log_file)
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True
        )
        
        # Monitor progress
        stderr_output = []
        for line in process.stderr:
            stderr_output.append(line)
            # Log progress lines (FFmpeg outputs to stderr)
            if 'time=' in line.lower() or 'frame=' in line.lower():
                # Extract and log progress (optional, can be verbose)
                pass
        
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
