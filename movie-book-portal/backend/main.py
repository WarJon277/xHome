# main.py - Entry point for the Media Portal
import os
import ipaddress
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from database import create_tables
from database_books import create_books_tables
from database_audiobooks import create_audiobooks_tables
from database_tvshows import create_tvshows_tables
from database_gallery import create_gallery_tables
from database_progress import create_progress_tables
from database_kaleidoscope import create_kaleidoscope_tables
from database_videogallery import create_videogallery_tables
from database import ChatMessage, SessionLocal

from routers import movies, books, audiobooks, admin, gallery, videogallery, tvshows, kaleidoscopes, progress, dashboard, flibusta, audiobooks_source, discovery, system
from routers import requests_router

app = FastAPI(title="Медиа-портал: Фильмы и Книги")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware для проверки доступа (безопасность портала)
@app.middleware("http")
async def security_middleware(request: Request, call_next):
    # 1. Определение реального IP адреса
    x_forwarded = request.headers.get("x-forwarded-for")
    x_real_ip = request.headers.get("x-real-ip")
    
    if x_forwarded:
        real_ip = x_forwarded.split(",")[0].strip()
    elif x_real_ip:
        real_ip = x_real_ip.strip()
    else:
        real_ip = request.client.host if request.client else "127.0.0.1"
        
    # 2. Проверка: является ли подключение локальным (домашняя сеть)
    is_local = False
    if real_ip in ("127.0.0.1", "localhost", "::1"):
        is_local = True
    else:
        try:
            ip_obj = ipaddress.ip_address(real_ip)
            # is_private покрывает 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
            is_local = ip_obj.is_private or ip_obj.is_loopback
        except ValueError:
            pass
            
    # 3. Проверка: является ли подключение из нашего приложения
    user_agent = request.headers.get("user-agent", "").lower()
    # Рекомендуется использовать поиск в нижнем регистре для надежности
    is_app_by_ua = "xwv2-app-identifier" in user_agent
    # Также проверяем кастомный заголовок или куки (на случай, если WebView обрежет User-Agent в XHR/Fetch)
    is_app_by_header = request.headers.get("X-App-Identifier") == "true"
    is_app_by_cookie = "xwv2-app-identifier" in request.cookies.get("app_id", "").lower()
    
    is_app = is_app_by_ua or is_app_by_header or is_app_by_cookie

    # 4. Правила блокировки
    # Логируем для отладки, если запрос идет не из локальной сети
    if not is_local:
        print(f"External access attempt: IP={real_ip}, App={is_app}, UA={user_agent}")

    # Правило: Если запрос НЕ из локальной сети И это НЕ приложение -> Блокируем ВСЁ.
    if not is_local and not is_app:
        # Для API-запросов возвращаем JSON-ошибку
        if request.url.path.startswith("/api"):
            return JSONResponse(
                status_code=403,
                content={"detail": "Access Denied. Only authorized app connections allowed outside local network."}
            )
        # Для загрузок и фронтенда тоже блокируем
        return HTMLResponse(
            status_code=403,
            content=f"""
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; margin-top: 100px; padding: 20px;">
            <h1 style="color: #e50914; font-size: 3em;">Вход заблокирован</h1>
            <p style="font-size: 1.2em; color: #333;">Этот сервер — частная территория.</p>
            <div style="background: #f8f8f8; border: 1px solid #ddd; padding: 20px; border-radius: 8px; max-width: 500px; margin: 30px auto; text-align: left;">
                <p>Для доступа необходимо выполнить одно из условий:</p>
                <ul style="line-height: 1.6;">
                    <li>Находиться в <b>локальной домашней сети</b>.</li>
                    <li>Использовать <b>официальное приложение xWV2</b>.</li>
                </ul>
            </div>
            <p style="color: #999; font-size: 0.9em;">Ваш IP: {real_ip}</p>
            <script>
                if (window.AndroidApp && window.AndroidApp.hideLoadingScreen) {{
                    window.AndroidApp.hideLoadingScreen();
                }}
            </script>
        </div>
        """
        )
            
    response = await call_next(request)
    return response

# Пути
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Use React frontend build directory
FRONTEND_PATH = os.path.abspath(os.path.join(BASE_DIR, "../frontend-react/dist"))
UPLOADS_PATH = os.path.abspath(os.path.join(BASE_DIR, "uploads"))

# Статические файлы
os.makedirs(UPLOADS_PATH, exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "books"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "movies"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "tvshows"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "tvshows"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "gallery"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "videogallery"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_PATH, "kaleidoscopes_music"), exist_ok=True)

# Mount static files only if dist directory exists (production mode)
if os.path.exists(FRONTEND_PATH):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_PATH, "assets")), name="assets")
app.mount("/uploads", StaticFiles(directory=UPLOADS_PATH), name="uploads")

# Добавляем маршрут для favicon.ico
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    favicon_path = os.path.join(FRONTEND_PATH, "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/x-icon")
    else:
        raise HTTPException(status_code=404, detail="Favicon not found")

# Инициализация БД
create_tables()
create_books_tables()
create_audiobooks_tables()
create_tvshows_tables()
create_gallery_tables()
create_videogallery_tables()
create_progress_tables()
create_kaleidoscope_tables()

# Подключение роутеров
app.include_router(movies.router, prefix="/api")
app.include_router(books.router, prefix="/api")
app.include_router(audiobooks.router, prefix="/api")
app.include_router(tvshows.router, prefix="/api")
app.include_router(gallery.router, prefix="/api")
app.include_router(videogallery.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(progress.router, prefix="/api")
app.include_router(kaleidoscopes.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(flibusta.router, prefix="/api")
app.include_router(audiobooks_source.router, prefix="/api")
# Register discovery with explicit sub-prefix
app.include_router(discovery.router, prefix="/api/discovery")
app.include_router(system.router, prefix="/api")
app.include_router(requests_router.router, prefix="/api")

# --- WebSocket: Онлайн-счётчик ---
import builtins
import json

from database import ChatMessage, Settings, SessionLocal, AccessLog

online_connections: dict = {}  # WebSocket -> {"ip": IP, "name": Name}

def _get_ws_ip(websocket: WebSocket) -> str:
    """Extract real IP from WebSocket connection."""
    forwarded = websocket.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if websocket.client:
        return websocket.client.host
    return "unknown"

async def broadcast_online_count():
    # Gather unique connections by ID (we can use IP as a simpler approach, or just all connections)
    # Using a list of IP/Name dicts
    users = [{"ip": info["ip"], "name": info.get("name")} for info in online_connections.values()]
    
    # Optional: deduplicate by IP if you want exactly one user entry per IP
    unique_users_dict = {}
    for user in users:
        # If we already have this IP, only override if the new one has a non-null name
        if user["ip"] not in unique_users_dict or user["name"]:
            unique_users_dict[user["ip"]] = user
            
    unique_users = list(unique_users_dict.values())
    count = len(unique_users)
    
    for ws in list(online_connections.keys()):
        try:
            await ws.send_json({"online": count, "users": unique_users})
        except Exception:
            online_connections.pop(ws, None)

import time
@app.websocket("/ws/online")
async def ws_online(websocket: WebSocket):
    await websocket.accept()
    ip = _get_ws_ip(websocket)
    # Default to just IP, name will be set if they send it
    online_connections[websocket] = {"ip": ip, "name": None, "log_id": None}
    await broadcast_online_count()
    
    connect_time = time.time()
    
    # Create initial access log entry
    db = SessionLocal()
    access_log_id = None
    try:
        new_log = AccessLog(
            ip_address=ip,
            connect_time=datetime.datetime.utcnow()
        )
        db.add(new_log)
        db.commit()
        db.refresh(new_log)
        access_log_id = new_log.id
        online_connections[websocket]["log_id"] = access_log_id
    except Exception as e:
        print(f"Error creating access log: {e}")
    finally:
        db.close()
    
    # Send chat history on connect
    db = SessionLocal()
    try:
        # Increment total visits
        visits_setting = db.query(Settings).filter(Settings.key == "total_visits").first()
        if not visits_setting:
            visits_setting = Settings(key="total_visits", value="1")
            db.add(visits_setting)
        else:
            try:
                visits_setting.value = str(int(visits_setting.value) + 1)
            except ValueError:
                visits_setting.value = "1"
        db.commit()

        history = db.query(ChatMessage).order_by(ChatMessage.timestamp.desc()).limit(20).all()
        # reverse to chronological order
        history.reverse()
        history_msgs = [
            {
                "id": msg.id,
                "sender_name": msg.sender_name,
                "sender_ip": msg.sender_ip,
                "message": msg.message,
                "timestamp": msg.timestamp.isoformat()
            } for msg in history
        ]
        await websocket.send_json({"type": "chat_history", "messages": history_msgs})
    except Exception as e:
        print(f"Error sending chat history: {e}")
    finally:
        db.close()

    try:
        while True:
            text_data = await websocket.receive_text()
            try:
                data = json.loads(text_data)
                
                # Registration
                if data.get("type") == "register" and data.get("name"):
                    name = data["name"]
                    online_connections[websocket]["name"] = name
                    await broadcast_online_count()
                    
                    # Update access log with name
                    log_id = online_connections[websocket].get("log_id")
                    if log_id:
                        db = SessionLocal()
                        try:
                            log_entry = db.query(AccessLog).filter(AccessLog.id == log_id).first()
                            if log_entry:
                                log_entry.client_name = name
                                db.commit()
                        except Exception as e:
                            print(f"Error updating access log with name: {e}")
                        finally:
                            db.close()
                    
                # Chat message
                elif data.get("type") == "chat" and data.get("message"):
                    name = data.get("name") or online_connections[websocket].get("name")
                    msg_text = data["message"].strip()
                    if msg_text:
                        db = SessionLocal()
                        try:
                            # Save to DB
                            new_msg = ChatMessage(
                                sender_name=name,
                                sender_ip=ip,
                                message=msg_text
                            )
                            db.add(new_msg)
                            db.commit()
                            db.refresh(new_msg)
                            
                            # Broadcast to all
                            msg_payload = {
                                "type": "new_chat_message",
                                "message": {
                                    "id": new_msg.id,
                                    "sender_name": new_msg.sender_name,
                                    "sender_ip": new_msg.sender_ip,
                                    "message": new_msg.message,
                                    "timestamp": new_msg.timestamp.isoformat()
                                }
                            }
                            # Send to all connected websockets
                            for ws in list(online_connections.keys()):
                                try:
                                    await ws.send_json(msg_payload)
                                except Exception:
                                    pass
                        except Exception as e:
                            print(f"Error saving/broadcasting chat: {e}")
                        finally:
                            db.close()
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        conn_info = online_connections.pop(websocket, None)
        await broadcast_online_count()
        
        # Finalize access log
        if conn_info and conn_info.get("log_id"):
            db = SessionLocal()
            try:
                log_entry = db.query(AccessLog).filter(AccessLog.id == conn_info["log_id"]).first()
                if log_entry:
                    log_entry.disconnect_time = datetime.datetime.utcnow()
                    duration_sec = int(time.time() - connect_time)
                    log_entry.duration = duration_sec
                    db.commit()
            except Exception as e:
                print(f"Error finalizing access log: {e}")
            finally:
                db.close()
        
        # Calculate time spent and increment total_time_seconds
        duration = int(time.time() - connect_time)
        if duration > 0:
            db_conn = SessionLocal()
            try:
                time_setting = db_conn.query(Settings).filter(Settings.key == "total_time_seconds").first()
                if not time_setting:
                    time_setting = Settings(key="total_time_seconds", value=str(duration))
                    db_conn.add(time_setting)
                else:
                    try:
                        time_setting.value = str(int(time_setting.value) + duration)
                    except ValueError:
                        time_setting.value = str(duration)
                db_conn.commit()
            except Exception as e:
                print(f"Error saving time spent: {e}")
            finally:
                db_conn.close()

# IMPORTANT: React SPA routing - MUST be registered LAST (catch-all route)
# This serves index.html for all non-API routes to support React Router
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    # Serve index.html for React Router (SPA)
    index_path = os.path.join(FRONTEND_PATH, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    else:
        # Development mode - frontend not built yet
        return HTMLResponse(
            content="""
            <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>⚠️ Frontend Not Built</h1>
                    <p>Please build the frontend first:</p>
                    <pre style="background: #f5f5f5; padding: 20px; border-radius: 8px; display: inline-block; text-align: left;">
cd frontend-react
npm run build
                    </pre>
                    <p>Or run in development mode:</p>
                    <pre style="background: #f5f5f5; padding: 20px; border-radius: 8px; display: inline-block; text-align: left;">
cd frontend-react
npm run dev
                    </pre>
                    <p>Then access at <a href="http://localhost:5050">http://localhost:5050</a></p>
                </body>
            </html>
            """,
            status_code=503
        )

