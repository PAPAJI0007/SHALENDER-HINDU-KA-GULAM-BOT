from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import os
import json
import fbchat
from fbchat.models import *
import requests
import threading
import time
import logging

# लॉगिंग सेटअप
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# HTML फाइल सर्व करने के लिए
with open("index.html", "r") as f:
    html_content = f.read()

@app.get("/")
async def get():
    return HTMLResponse(html_content)

# WebSocket मैनेजर
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.running = False
        self.client = None  # fbchat क्लाइंट
        self.settings = {
            "autoSpamAccept": False,
            "autoMessageAccept": False,
            "autoConvo": False
        }
        self.abuse_content = ""
        self.welcome_content = ""
        self.prefix = "!"

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        await self.send_status(websocket)
        await self.send_settings(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_log(self, message: str):
        for connection in self.active_connections:
            await connection.send_json({"type": "log", "message": message})

    async def send_status(self, websocket: WebSocket = None):
        data = {"type": "status", "running": self.running}
        if websocket:
            await websocket.send_json(data)
        else:
            for connection in self.active_connections:
                await connection.send_json(data)

    async def send_settings(self, websocket: WebSocket = None):
        data = {"type": "settings", **self.settings}
        if websocket:
            await websocket.send_json(data)
        else:
            for connection in self.active_connections:
                await connection.send_json(data)

manager = ConnectionManager()

# सर्वर को एक्टिव रखने के लिए पिंग
def keep_alive():
    while True:
        try:
            requests.get("https://shalender-hindu-ka-gulam-bot.onrender.com")
            logger.info("Ping sent to keep server alive")
        except Exception as e:
            logger.error(f"Ping failed: {e}")
        time.sleep(600)  # 10 मिनट

threading.Thread(target=keep_alive, daemon=True).start()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            parsed = json.loads(data)
            type_ = parsed.get("type")

            if type_ == "start":
                try:
                    cookie_content = parsed["cookieContent"]
                    manager.prefix = parsed.get("prefix", "!")
                    admin_id = parsed.get("adminId", "")

                    # कुकी से लॉगिन (JSON फॉर्मेट मान रहा हूं)
                    try:
                        cookies = json.loads(cookie_content)
                        manager.client = fbchat.Client(
                            email="",  # डमी, कुकी से लॉगिन होगा
                            password="",  # डमी
                            session_cookies=cookies
                        )
                        await manager.send_log("कुकी से लॉगिन सफल! बॉट शुरू हो रहा है...")
                        manager.running = True
                        await manager.send_status()

                        # कमांड हैंडलिंग (बेसिक उदाहरण)
                        def handle_message(author_id, message):
                            if message.startswith(manager.prefix):
                                command = message[len(manager.prefix):].split()[0].lower()
                                args = message[len(manager.prefix) + len(command):].strip()
                                if command == "help":
                                    manager.client.send(Message(text="उपलब्ध कमांड्स: !help, !groupnamelock, !nicknamelock, !tid, !uid, !info, !group info, !pair, !music, !antiout, !send sticker, !autospam, !automessage, !loder target, !loder stop, autoconvo"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                elif command == "music" and args:
                                    manager.client.send(Message(text=f"यूट्यूब से गाना चल रहा है: {args}"), thread_id=author_id, thread_type=ThreadType.GROUP)
                                # अन्य कमांड्स के लिए लॉजिक ऐड कर

                        # मैसेज लिसनर
                        @manager.client.listen('onMessage')
                        async def on_message(author_id, message_object, thread_id, thread_type, **kwargs):
                            message = message_object.text
                            if message and author_id != manager.client.uid:  # अपने मैसेज से बचें
                                await handle_message(thread_id, message)
                                await manager.send_log(f"कमांड रिसीव: {message} से {author_id}")

                        manager.client.listen()

                    except fbchat.FBchatException as e:
                        await manager.send_log(f"लॉगिन फेल: {str(e)}")
                        manager.running = False
                        await manager.send_status()

                except json.JSONDecodeError:
                    await manager.send_log("कुकी कॉन्टेंट गलत फॉर्मेट में है (JSON चाहिए)।")

            elif type_ == "stop":
                if manager.client:
                    manager.client.stop_listening()
                    manager.client.logout()
                    manager.client = None
                await manager.send_log("बॉट बंद हो रहा है...")
                manager.running = False
                await manager.send_status()

            elif type_ == "uploadAbuse":
                manager.abuse_content = parsed["content"]
                await manager.send_log("अब्यूज फाइल अपलोड की गई।")

            elif type_ == "saveWelcome":
                manager.welcome_content = parsed["content"]
                await manager.send_log("वेलकम मैसेजेस सेव किए गए।")

            elif type_ == "saveSettings":
                manager.settings = {
                    "autoSpamAccept": parsed["autoSpamAccept"],
                    "autoMessageAccept": parsed["autoMessageAccept"],
                    "autoConvo": parsed["autoConvo"]
                }
                await manager.send_log("सेटिंग्स सेव की गईं।")
                await manager.send_settings()

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        if manager.client:
            manager.client.stop_listening()
            manager.client.logout()
            manager.client = None
            manager.running = False
            await manager.send_status()
    except Exception as e:
        await manager.send_log(f"अनजान त्रुटि: {str(e)}")
