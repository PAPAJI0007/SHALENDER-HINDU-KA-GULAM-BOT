from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import os
import json

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
        self.settings = {
            "autoSpamAccept": False,
            "autoMessageAccept": False,
            "autoConvo": False
        }
        self.abuse_content = ""
        self.welcome_content = ""

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

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            parsed = json.loads(data)
            type_ = parsed.get("type")

            if type_ == "start":
                # फेसबुक मैसेंजर बॉट स्टार्ट लॉजिक यहाँ ऐड करें
                # उदाहरण: from facebook import GraphAPI; api = GraphAPI(cookie=parsed['cookieContent'])
                await manager.send_log("कुकी, प्रीफिक्स, और एडमिन ID के साथ बॉट शुरू हो रहा है...")
                manager.running = True
                await manager.send_status()
                await manager.send_log("बॉट शुरू! फेसबुक मैसेंजर इंटीग्रेशन यहाँ करें।")

            elif type_ == "stop":
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
