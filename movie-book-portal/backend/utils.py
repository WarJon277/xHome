import os
import io
import fitz  # PyMuPDF
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from PIL import Image
from PIL import Image
import shutil

AUDIO_EXTENSIONS = {'.mp3', '.m4a', '.m4b', '.aac', '.flac', '.wav', '.ogg'}
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}

def unzip_file(zip_path, dest_dir):
    """
    Extracts a ZIP file to the destination directory.
    Returns the destination directory path.
    """
    try:
        if not zipfile.is_zipfile(zip_path):
            return None
            
        os.makedirs(dest_dir, exist_ok=True)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(dest_dir)
        return dest_dir
    except Exception as e:
        print(f"Error unzipping file {zip_path}: {e}")
        return None

def find_audio_files(directory):
    """
    Recursively finds all audio files in a directory.
    Returns a list of full paths.
    """
    audio_files = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if os.path.splitext(file.lower())[1] in AUDIO_EXTENSIONS:
                audio_files.append(os.path.join(root, file))
    
    # Sort files to ensure correct order (e.g. 01.mp3, 02.mp3)
    audio_files.sort()
    return audio_files

def find_thumbnail_in_dir(directory):
    """
    Looks for a common cover image file in the directory.
    """
    common_names = ['cover', 'folder', 'album', 'front', 'art']
    
    # First search for exact matches of common names
    for root, dirs, files in os.walk(directory):
        for file in files:
            name, ext = os.path.splitext(file.lower())
            if ext in IMAGE_EXTENSIONS:
                if name in common_names:
                    return os.path.join(root, file)
                
    # If not found, look for any image that might be a cover (e.g. contains 'cover')
    for root, dirs, files in os.walk(directory):
        for file in files:
            name, ext = os.path.splitext(file.lower())
            if ext in IMAGE_EXTENSIONS:
                if 'cover' in name or 'folder' in name:
                    return os.path.join(root, file)

    # Finally, just return the first image found (if any)
    for root, dirs, files in os.walk(directory):
        for file in files:
            ext = os.path.splitext(file.lower())[1]
            if ext in IMAGE_EXTENSIONS:
                return os.path.join(root, file)
                
    return None

def apply_image_filter(img, filter_type):
    """Apply a filter to the image based on the filter type"""
    import numpy as np
    
    # Convert to RGB if necessary
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    if filter_type == 'brightness':
        # Increase brightness
        np_img = np.array(img)
        np_img = np.clip(np_img * 1.3, 0, 255).astype(np.uint8)
        return Image.fromarray(np_img)
    
    elif filter_type == 'contrast':
        # Increase contrast
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(img)
        return enhancer.enhance(1.3)
    
    elif filter_type == 'saturation':
        # Increase saturation
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Color(img)
        return enhancer.enhance(1.5)
    
    elif filter_type == 'bw':
        # Convert to grayscale
        return img.convert('L').convert('RGB')
    
    elif filter_type == 'vintage':
        # Apply vintage effect
        np_img = np.array(img)
        # Add sepia tone
        sepia_filter = np.array([[0.393, 0.769, 0.189],
                                [0.349, 0.686, 0.168],
                                [0.272, 0.534, 0.131]])
        sepia_img = np.dot(np_img, sepia_filter.T)
        sepia_img = np.clip(sepia_img, 0, 255).astype(np.uint8)
        
        # Increase contrast and reduce saturation for vintage look
        from PIL import ImageEnhance
        img = Image.fromarray(sepia_img)
        img = ImageEnhance.Contrast(img).enhance(1.2)
        img = ImageEnhance.Color(img).enhance(0.8)
        return img
    
    elif filter_type == 'none':
        # Return original image
        return img
    
    else:
        # Return original image if no filter type specified
        return img

async def get_book_page_content(book, page_num, db):
    full_path = book.file_path
    if not full_path or not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Book or file not found")

    ext = Path(full_path).suffix.lower()

    try:
        if ext == ".epub":
            with zipfile.ZipFile(full_path, 'r') as epub:
                if 'META-INF/container.xml' not in epub.namelist():
                    raise HTTPException(status_code=400, detail="Invalid EPUB: no container.xml")

                container_content = epub.read('META-INF/container.xml').decode('utf-8')
                root = ET.fromstring(container_content)
                ns = {'c': 'urn:oasis:names:tc:opendocument:xmlns:container'}
                rootfile = root.find('.//c:rootfile', ns)
                if rootfile is None:
                    raise HTTPException(status_code=400, detail="Invalid container.xml")
                opf_path = rootfile.get('full-path')
                if not opf_path or opf_path not in epub.namelist():
                    raise HTTPException(status_code=400, detail="OPF file specified in container not found")

                opf_dir = os.path.dirname(opf_path) or ''
                opf_content = epub.read(opf_path).decode('utf-8')
                opf_root = ET.fromstring(opf_content)
                ns_opf = {'opf': 'http://www.idpf.org/2007/opf'}

                manifest = {}
                for item in opf_root.findall('.//opf:manifest/opf:item', ns_opf):
                    item_id = item.get('id')
                    href = item.get('href')
                    if item_id and href:
                        manifest[item_id] = href

                spine = []
                for itemref in opf_root.findall('.//opf:spine/opf:itemref', ns_opf):
                    item_id = itemref.get('idref')
                    if item_id and item_id in manifest:
                        spine.append(manifest[item_id])

                if not spine:
                    raise HTTPException(status_code=400, detail="EPUB has no readable chapters in spine")

                total_pages = len(spine)
                if book.total_pages != total_pages:
                    book.total_pages = total_pages
                    db.commit()

                if page_num < 1 or page_num > total_pages:
                    raise HTTPException(status_code=404, detail="Page number out of range")

                content_file = spine[page_num - 1]
                if opf_dir:
                    content_path = os.path.normpath(os.path.join(opf_dir, content_file)).replace('\\', '/')
                else:
                    content_path = content_file.replace('\\', '/')

                try:
                    content_bytes = epub.read(content_path)
                except KeyError:
                    try:
                        content_bytes = epub.read(content_file)
                    except KeyError:
                        basename = os.path.basename(content_path)
                        matches = [n for n in epub.namelist() if n.endswith(basename)]
                        if not matches:
                            raise HTTPException(status_code=500, detail=f"Chapter file '{content_file}' not found in EPUB")
                        content_bytes = epub.read(matches[0])

                content = content_bytes.decode('utf-8')
                return {"content": content, "total": total_pages}
        else:
            doc = fitz.open(full_path)
            if page_num < 1 or page_num > doc.page_count:
                doc.close()
                raise HTTPException(status_code=404, detail="Page number out of range")

            page = doc.load_page(page_num - 1)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), colorspace=fitz.csRGB)
            img_bytes = pix.tobytes("png")
            doc.close()

            return StreamingResponse(io.BytesIO(img_bytes), media_type="image/png")

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка обработки книги: {str(e)}")
