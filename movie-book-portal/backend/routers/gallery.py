import os
import shutil
import hashlib
import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from PIL import Image
from utils import apply_image_filter

router = APIRouter(prefix="/gallery", tags=["gallery"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GALLERY_UPLOADS = os.path.join(BASE_DIR, "uploads", "gallery")

@router.get("")
def get_gallery_contents(folder: str = ""):
    try:
        base_path = os.path.abspath(GALLERY_UPLOADS)
        # Убираем ведущие и trailing слэши из folder
        folder = folder.strip("/").strip("\\")
        requested_path = os.path.abspath(os.path.join(GALLERY_UPLOADS, folder))
        
        if not requested_path.startswith(base_path):
            raise HTTPException(status_code=400, detail="Недопустимый путь")
        
        if not os.path.exists(requested_path):
            return [] # Возвращаем пустой список вместо 404, чтобы фронтенд не ломался
        
        contents = []
        try:
            items = os.listdir(requested_path)
        except Exception as e:
            print(f"Ошибка listdir для {requested_path}: {e}")
            raise HTTPException(status_code=500, detail=f"Ошибка доступа к папке: {str(e)}")

        for item in items:
            try:
                item_path = os.path.join(requested_path, item)
                is_directory = os.path.isdir(item_path)
                
                if is_directory:
                    contents.append({
                        "id": None,
                        "name": item,
                        "type": "folder",
                        "path": os.path.join(folder, item).replace('\\', '/'),
                        "size": None,
                        "modified": os.path.getmtime(item_path),
                        "thumbnail_path": "/static/assets/images/folder-icon_thumb.png"
                    })
                elif os.path.isfile(item_path):
                    if '_thumb.' in item:
                        continue

                    _, ext = os.path.splitext(item)
                    if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                        # Генерируем ID на основе пути
                        file_id = int(hashlib.md5(item_path.encode()).hexdigest(), 16) % 10**8
                        
                        # Проверяем наличие миниатюры
                        thumb_name = f"{os.path.splitext(item)[0]}_thumb.webp"
                        thumb_path = os.path.join(requested_path, thumb_name)
                        
                        if not os.path.exists(thumb_path):
                            # Try to generate thumbnail on the fly if missing
                            try:
                                with Image.open(item_path) as img:
                                    img.thumbnail((300, 300), Image.Resampling.LANCZOS)
                                    img.save(thumb_path, "WEBP", quality=80)
                                    thumb_filename = thumb_name
                            except Exception as thumb_gen_err:
                                print(f"Failed to generate thumbnail for {item}: {thumb_gen_err}")
                                thumb_filename = item
                        else:
                            thumb_filename = thumb_name
                        
                        contents.append({
                            "id": file_id,
                            "name": item,
                            "type": "photo",
                            "path": os.path.join(folder, item).replace('\\', '/'),
                            "size": os.path.getsize(item_path),
                            "modified": os.path.getmtime(item_path),
                            "thumbnail_path": f"/uploads/gallery/{os.path.join(folder, thumb_filename).replace('\\', '/')}",
                            "file_path": f"/uploads/gallery/{os.path.join(folder, item).replace('\\', '/')}"
                        })
            except Exception as item_err:
                print(f"Ошибка при обработке элемента {item}: {item_err}")
                continue # Пропускаем проблемный элемент
        
        return contents
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

@router.get("/search")
def search_photos(query: str):
    try:
        results = []
        for root, dirs, files in os.walk(GALLERY_UPLOADS):
            for file in files:
                _, ext = os.path.splitext(file)
                if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                    if query.lower() in file.lower():
                        file_path = os.path.join(root, file)
                        file_id = int(hashlib.md5(file_path.encode()).hexdigest(), 16) % 10**8
                        
                        relative_path = os.path.relpath(file_path, BASE_DIR).replace('\\', '/')
                        
                        thumb_path = os.path.join(root, f"{os.path.splitext(file)[0]}_thumb.webp")
                        if not os.path.exists(thumb_path):
                            thumb_path = file_path
                        
                        relative_thumb_path = os.path.relpath(thumb_path, BASE_DIR).replace('\\', '/')
                        
                        results.append({
                            "id": file_id,
                            "name": file,
                            "type": "photo",
                            "path": relative_path,
                            "size": os.path.getsize(file_path),
                            "modified": os.path.getmtime(file_path),
                            "thumbnail_path": f"/{relative_thumb_path}",
                            "file_path": f"/{relative_path}"
                        })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при поиске фото: {str(e)}")

@router.get("/{photo_id}")
def get_photo(photo_id: int):
    try:
        for root, dirs, files in os.walk(GALLERY_UPLOADS):
            for file in files:
                file_path = os.path.join(root, file)
                file_id = int(hashlib.md5(file_path.encode()).hexdigest(), 16) % 10**8
                
                if file_id == photo_id:
                    _, ext = os.path.splitext(file)
                    if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                        relative_path = os.path.relpath(file_path, BASE_DIR).replace('\\', '/')
                        
                        thumb_path = os.path.join(os.path.dirname(file_path), f"{os.path.splitext(file)[0]}_thumb.webp")
                        if not os.path.exists(thumb_path):
                            thumb_path = file_path
                        
                        relative_thumb_path = os.path.relpath(thumb_path, BASE_DIR).replace('\\', '/')
                        
                        return {
                            "id": file_id,
                            "title": os.path.splitext(file)[0],
                            "description": "",
                            "file_path": f"/{relative_path}",
                            "thumbnail_path": f"/{relative_thumb_path}",
                            "upload_date": os.path.getmtime(file_path)
                        }
        
        raise HTTPException(status_code=404, detail="Photo not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении фото: {str(e)}")

@router.post("")
def create_photo(photo_data: dict):
    try:
        folder_name = photo_data.get("title", "")
        folder_path = photo_data.get("path", "")  # Путь к папке, в которой нужно создать новую папку
        
        if not folder_name:
            raise HTTPException(status_code=400, detail="Название папки не указано")
        
        folder_name = re.sub(r'[<>:"/\\|?*]', '_', folder_name)
        
        # Если указан путь к папке, создаем внутри неё, иначе в корне
        if folder_path:
            # Проверяем, что путь находится в пределах разрешенной директории
            base_path = os.path.abspath(GALLERY_UPLOADS)
            requested_path = os.path.abspath(os.path.join(GALLERY_UPLOADS, folder_path))
            
            if not requested_path.startswith(base_path):
                raise HTTPException(status_code=400, detail="Недопустимый путь")
            
            final_path = os.path.join(requested_path, folder_name)
        else:
            final_path = os.path.join(GALLERY_UPLOADS, folder_name)
        
        if os.path.exists(final_path):
            raise HTTPException(status_code=400, detail="Папка с таким именем уже существует")
        
        os.makedirs(final_path, exist_ok=True)
        return {"message": "Папка создана успешно", "path": final_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при создании папки: {str(e)}")

@router.delete("/manage/folder_delete")
def delete_folder(path: str):
    try:
        base_path = os.path.abspath(GALLERY_UPLOADS)
        requested_path = os.path.abspath(os.path.join(GALLERY_UPLOADS, path))
        
        if not requested_path.startswith(base_path) or requested_path == base_path:
            raise HTTPException(status_code=400, detail="Недопустимый путь или попытка удалить корень")
        
        if not os.path.exists(requested_path):
            raise HTTPException(status_code=404, detail="Папка не найдена")
        
        if not os.path.isdir(requested_path):
            raise HTTPException(status_code=400, detail="Указанный путь не является папкой")
        
        shutil.rmtree(requested_path)
        
        return {"message": "Папка и её содержимое удалены успешно"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении папки: {str(e)}")

@router.delete("/{photo_id}")
def delete_photo(photo_id: int):
    try:
        for root, dirs, files in os.walk(GALLERY_UPLOADS):
            for file in files:
                file_path = os.path.join(root, file)
                file_id = int(hashlib.md5(file_path.encode()).hexdigest(), 16) % 10**8
                
                if file_id == photo_id:
                    os.remove(file_path)
                    
                    thumb_path = os.path.join(os.path.dirname(file_path), f"{os.path.splitext(file)[0]}_thumb.webp")
                    if os.path.exists(thumb_path):
                        os.remove(thumb_path)
                    
                    return {"message": "Фото удалено успешно"}
        
        raise HTTPException(status_code=404, detail="Photo not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении фото: {str(e)}")

@router.post("/upload_to_folder")
async def upload_photo_to_folder(folder: str = Form(""), file: UploadFile = File(...)):
    try:
        print(f"DEBUG: Starting upload for file: {file.filename}, folder: '{folder}'")
        base_path = os.path.abspath(GALLERY_UPLOADS)
        requested_path = os.path.abspath(os.path.join(base_path, folder))
        
        if not requested_path.startswith(base_path):
            print(f"DEBUG: Invalid path rejected: {requested_path}")
            raise HTTPException(status_code=400, detail="Недопустимый путь")
        
        os.makedirs(requested_path, exist_ok=True)
        
        allowed_ext = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_ext:
            print(f"DEBUG: Invalid extension rejected: {ext}")
            raise HTTPException(status_code=400, detail="Неподдерживаемый формат изображения")
        
        file_path = os.path.join(requested_path, file.filename)
        print(f"DEBUG: Saving file to: {file_path}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        try:
            with Image.open(file_path) as img:
                img.thumbnail((300, 300), Image.Resampling.LANCZOS)
                thumb_path = os.path.join(requested_path, f"{os.path.splitext(file.filename)[0]}_thumb.webp")
                img.save(thumb_path, "WEBP", quality=85)
                print(f"DEBUG: Thumbnail generated: {thumb_path}")
        except Exception as e:
            print(f"Ошибка при создании миниатюры: {e}")
        
        print(f"DEBUG: Upload successful: {file.filename}")
        return {"message": "Файл загружен успешно", "file_path": file_path}
    except Exception as e:
        print(f"ERROR during upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке файла: {str(e)}")

@router.post("/move_photo")
async def move_photo(photo_path: str = Form(...), target_folder: str = Form(None)):
    try:
        base_path = os.path.abspath(GALLERY_UPLOADS)
        source_path = os.path.abspath(os.path.join(GALLERY_UPLOADS, photo_path))
        
        # Если целевая папка None или пустая, это означает перемещение в корень
        if not target_folder:
            target_path = GALLERY_UPLOADS
        else:
            target_path = os.path.abspath(os.path.join(GALLERY_UPLOADS, target_folder))
        
        if not source_path.startswith(base_path):
            raise HTTPException(status_code=400, detail="Недопустимый путь")
        
        if not os.path.exists(source_path):
            raise HTTPException(status_code=404, detail="Файл не найден")
        
        if not os.path.isdir(target_path):
            raise HTTPException(status_code=404, detail="Целевая папка не найдена")
        
        filename = os.path.basename(source_path)
        destination_path = os.path.join(target_path, filename)
        shutil.move(source_path, destination_path)
        
        source_thumb_path = os.path.join(os.path.dirname(source_path), f"{os.path.splitext(filename)[0]}_thumb.webp")
        dest_thumb_path = os.path.join(target_path, f"{os.path.splitext(filename)[0]}_thumb.webp")
        if os.path.exists(source_thumb_path):
             # Check if dest already exists to avoid error? shutil.move overwrites usually but let's be safe
             if os.path.exists(dest_thumb_path):
                 os.remove(dest_thumb_path)
             shutil.move(source_thumb_path, dest_thumb_path)
        
        return {"message": "Фото перемещено успешно", "new_path": destination_path}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Ошибка при перемещении фото: {str(e)}")

@router.post("/move_folder")
async def move_folder(folder_path: str = Form(...), target_folder: str = Form(None)):

    try:
        # Логирование для отладки
        print(f"Получен запрос на перемещение папки: folder_path='{folder_path}', target_folder='{target_folder}'")
        base_path = os.path.abspath(GALLERY_UPLOADS)
        source_path = os.path.abspath(os.path.join(GALLERY_UPLOADS, folder_path))
        
        # Если целевая папка None или пустая, это означает перемещение в корень
        if not target_folder:
            target_path = GALLERY_UPLOADS
        else:
            target_path = os.path.abspath(os.path.join(GALLERY_UPLOADS, target_folder))
        
        if not source_path.startswith(base_path):
            print(f"source_path '{source_path}' не начинается с base_path '{base_path}'")
            raise HTTPException(status_code=400, detail="Недопустимый путь")
        
        if not os.path.exists(source_path):
            print(f"source_path '{source_path}' не существует")
            raise HTTPException(status_code=404, detail="Папка не найдена")
        
        if not os.path.isdir(source_path):
            print(f"source_path '{source_path}' не является папкой")
            raise HTTPException(status_code=400, detail="Указанный путь не является папкой")
        
        if not os.path.isdir(target_path):
            print(f"target_path '{target_path}' не существует или не является папкой")
            raise HTTPException(status_code=404, detail="Целевая папка не найдена")
        
        # Проверяем, что мы не пытаемся переместить папку внутрь самой себя
        if source_path == target_path or target_path.startswith(source_path + os.sep):
            raise HTTPException(status_code=400, detail="Невозможно переместить папку внутрь самой себя")
        
        folder_name = os.path.basename(source_path)
        destination_path = os.path.join(target_path, folder_name)
        
        # Проверяем, что папка с таким именем не существует в целевой директории
        if os.path.exists(destination_path):
            raise HTTPException(status_code=400, detail="Папка с таким именем уже существует в целевой директории")
        
        shutil.move(source_path, destination_path)
        
        return {"message": "Папка перемещена успешно", "new_path": destination_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при перемещении папки: {str(e)}")

@router.post("/rename_folder")
def rename_folder(data: dict):
    try:
        folder_path = data.get("folder_path")
        new_name = data.get("new_name")

        if not folder_path or not new_name:
            raise HTTPException(status_code=400, detail="Не указан путь или новое имя")

        # Sanitize new_name
        new_name = re.sub(r'[<>:"/\\|?*]', '_', new_name)

        base_path = os.path.abspath(GALLERY_UPLOADS)
        source_path = os.path.abspath(os.path.join(GALLERY_UPLOADS, folder_path))
        
        # Parent directory of the source folder
        parent_dir = os.path.dirname(source_path)
        target_path = os.path.join(parent_dir, new_name)

        if not source_path.startswith(base_path):
            raise HTTPException(status_code=400, detail="Недопустимый путь")

        if not os.path.exists(source_path):
            raise HTTPException(status_code=404, detail="Папка не найдена")
        
        if os.path.exists(target_path):
             raise HTTPException(status_code=400, detail="Папка с таким именем уже существует")

        os.rename(source_path, target_path)
        
        return {"message": "Папка переименована успешно", "new_path": target_path}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при переименовании: {str(e)}")

@router.post("/{photo_id}/apply_filter")
async def apply_filter_to_photo(photo_id: int, filter_type: str = None):
    try:
        source_file_path = None
        for root, dirs, files in os.walk(GALLERY_UPLOADS):
            for file in files:
                file_path = os.path.join(root, file)
                file_id = int(hashlib.md5(file_path.encode()).hexdigest(), 16) % 10**8
                
                if file_id == photo_id:
                    _, ext = os.path.splitext(file)
                    if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                        source_file_path = file_path
                        break
            if source_file_path:
                break
        
        if not source_file_path:
            raise HTTPException(status_code=404, detail="Photo not found")
        
        try:
            with Image.open(source_file_path) as img:
                filtered_img = apply_image_filter(img, filter_type)
                filtered_img.save(source_file_path, quality=95, optimize=True)
                
                thumb_path = os.path.join(os.path.dirname(source_file_path), f"{os.path.splitext(os.path.basename(source_file_path))[0]}_thumb.webp")
                filtered_thumb = filtered_img.copy()
                filtered_thumb.thumbnail((300, 300), Image.Resampling.LANCZOS)
                filtered_thumb.save(thumb_path, "WEBP", quality=85)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка при применении фильтра: {str(e)}")
        
        return {"message": "Filter applied successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при применении фильтра: {str(e)}")
