from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import fbchat
from fbchat.models import *
import requests
import threading
import time
import logging

# लॉगिंग सेटअप
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS मिडलवेयर (WebSocket के लिए)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://shalender-hindu-ka-gulam-bot.onrender.com", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HTML फाइल सर्व करने के लिए
with open("index.html", "r") as f:
    html_content = f.read()

@app.get("/")
async def get():
    logger.debug("Root endpoint hit")
    return HTMLResponse(html_content)

# WebSocket मैनेजर
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.running = False
        self.client = None
        self.settings = {"autoSpamAccept": False, "autoMessageAccept": False, "autoConvo": False}
        self.abuse_content = ""
        self.welcome_content = ""
        self.prefix = "!"

    async def connect(self, websocket: WebSocket):
        logger.debug("New WebSocket connection")
        await websocket.accept()
        self.active_connections.append(websocket)
        await self.send_status(websocket)
        await self.send_settings(websocket)

    def disconnect(self, websocket: WebSocket):
        logger.debug("WebSocket disconnected")
        self.active_connections.remove(websocket)

    async def send_log(self, message: str):
        logger.debug(f"Sending log: {message}")
        for connection in self.active_connections:
            try:
                await connection.send_json({"type": "log", "message": message})
            except Exception as e:
                logger.error(f"Failed to send log: {e}")

    async def send_status(self, websocket: WebSocket = None):
        logger.debug(f"Sending status: running={self.running}")
        data = {"type": "status", "running": self.running}
        if websocket:
            await websocket.send_json(data)
        else:
            for connection in self.active_connections:
                await websocket.send_json(data)

    async def send_settings(self, websocket: WebSocket = None):
        logger.debug("Sending settings")
        data = {"type": "settings", **self.settings}
        if websocket:
            await websocket.send_json(data)
        else:
            for connection in self.active_connections:
                await websocket.send_json(data)

    async def reconnect(self):
        logger.debug("Attempting WebSocket reconnect")
        for connection in self.active_connections:
            try:
                await connection.close()
                self.active_connections.remove(connection)
            except Exception as e:
                logger.error(f"Reconnect failed: {e}")
        self.running = False
        self.client = None

manager = ConnectionManager()

# सर्वर को एक्टिव रखने के लिए पिंग
def keep_alive():
    while True:
        try:
            response = requests.get("https://shalender-hindu-ka-gulam-bot.onrender.com")
            logger.info(f"Ping sent, status: {response.status_code}")
        except Exception as e:
            logger.error(f"Ping failed: {e}")
        time.sleep(300)

threading.Thread(target=keep_alive, daemon=True).start()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    logger.debug("WebSocket endpoint started")
    await manager.connect(websocket)
    while True:
        try:
            while True:
                data = await websocket.receive_text()
                logger.debug(f"Received data: {data}")
                parsed = json.loads(data)
                type_ = parsed.get("type")

                if type_ == "start":
                    try:
                        cookie_content = parsed["cookieContent"]
                        manager.prefix = parsed.get("prefix", "!")
                        admin_id = parsed.get("adminId", "")

                        try:
                            cookies = json.loads(cookie_content)
                            manager.client = fbchat.Client("", "", session_cookies=cookies)
                            await manager.send_log("कुकी से लॉगिन सफल! बॉट शुरू हो रहा है...")
                            manager.running = True
                            await manager.send_status()

                            def handle_message(author_id, message):
                                if message.startswith(manager.prefix):
                                    command = message[len(manager.prefix):].split()[0].lower()
                                    args = message[len(manager.prefix) + len(command):].strip()
                                    if command == "help":
                                        manager.client.send(Message(text="उपलब्ध कमांड्स: !help, !groupnamelock, !nicknamelock, !tid, !uid, !info, !group info, !pair, !music, !antiout, !send sticker, !autospam, !automessage, !loder target, !loder stop, autoconvo"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"हेल्प कमांड रिसीव: {author_id}")
                                    elif command == "groupnamelock":
                                        manager.client.send(Message(text="ग्रुप नाम लॉक सेट हो गया!"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"Groupnamelock कमांड रिसीव: {author_id}")
                                    elif command == "nicknamelock":
                                        manager.client.send(Message(text="निकनेम लॉक सेट हो गया!"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"Nicknamelock कमांड रिसीव: {author_id}")
                                    elif command == "tid":
                                        manager.client.send(Message(text=f"ग्रुप ID: {author_id}"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"TID कमांड रिसीव: {author_id}")
                                    elif command == "uid":
                                        manager.client.send(Message(text=f"तुम्हारा UID: {author_id}"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"UID कमांड रिसीव: {author_id}")
                                    elif command == "info":
                                        manager.client.send(Message(text="बॉट इंफो: यह एक कस्टम बॉट है!"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"Info कमांड रिसीव: {author_id}")
                                    elif command == "group info":
                                        manager.client.send(Message(text="ग्रुप इंफो: यह ग्रुप सक्रिय है!"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"Group info कमांड रिसीव: {author_id}")
                                    elif command == "pair":
                                        manager.client.send(Message(text="पेयरिंग शुरू हो गई!"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"Pair कमांड रिसीव: {author_id}")
                                    elif command == "music" and args:
                                        manager.client.send(Message(text=f"यूट्यूब से गाना चल रहा है: {args}"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"Music कमांड रिसीव: {args}")
                                    elif command == "antiout":
                                        manager.client.send(Message(text="एंटी-आउट एक्टिवेट हो गया!"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"Antiout कमांड रिसीव: {author_id}")
                                    elif command == "send sticker" and args:
                                        manager.client.send(Message(text=f"स्टिकर भेजा जा रहा है: {args}"), thread_id=author_id, thread_type=ThreadType.GROUP)  # स्टिकर ID की जरूरत होगी
                                        await manager.send_log(f"Send sticker कमांड रिसीव: {args}")
                                    elif command == "autospam":
                                        manager.client.send(Message(text="ऑटो-स्पैम एक्टिवेट हो गया!"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"Autospam कमांड रिसीव: {author_id}")
                                    elif command == "automessage":
                                        manager.client.send(Message(text="ऑटो-मेसेज एक्टिवेट हो गया!"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"Automessage कमांड रिसीव: {author_id}")
                                    elif command == "loder target" and args:
                                        manager.client.send(Message(text=f"लोडर टारगेट सेट: {args}"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"Loder target कमांड रिसीव: {args}")
                                    elif command == "loder stop":
                                        manager.client.send(Message(text="लोडर बंद हो गया!"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"Loder stop कमांड रिसीव: {author_id}")
                                    elif command == "autoconvo":
                                        manager.client.send(Message(text="ऑटो-कन्वो एक्टिवेट हो गया!"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"Autoconvo कमांड रिसीव: {author_id}")
                                    else:
                                        manager.client.send(Message(text="अज्ञात कमांड। !help आजमाएं।"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                        await manager.send_log(f"अज्ञात कमांड: {command}")

                            @manager.client.listen('onMessage')
                            async def on_message(author_id, message_object, thread_id, thread_type, **kwargs):
                                message = message_object.text
                                if message and author_id != manager.client.uid:
                                    await handle_message(thread_id, message)

                            manager.client.listen()

                        except fbchat.FBchatException as e:
                            await manager.send_log(f"लॉगिन फेल: {str(e)}")
                            manager.running = False
                            await manager.send_status()

                    except json.JSONDecodeError:
                        await manager.send_log("कुकी कॉन्टेंट गलत फॉर्मेट में है।")

                elif type_ == "stop":
                    if manager.client:
                        manager.client.stop_listening()
                        manager.client.logout()
                        manager.client = None
                    await manager.send_log("बॉट बंद हो रहा है...")
                    manager.running = False
                    await manager.send_status()

        except WebSocketDisconnect:
            logger.warning("WebSocket disconnected, attempting reconnect...")
            await manager.reconnect()
            await manager.connect(websocket)
        except Exception as e:
            await manager.send_log(f"अनजान त्रुटि: {str(e)}")
            logger.error(f"Exception: {e}")
            await manager.reconnect()
            await manager.connect(websocket)
