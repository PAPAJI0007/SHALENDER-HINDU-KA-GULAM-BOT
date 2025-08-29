import asyncio
import os
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import requests
from PIL import Image
import yt_dlp
from guppy import Client, Message

app = FastAPI()
loop = asyncio.get_event_loop()

class Manager:
    def __init__(self):
        self.prefix = "!"
        self.connections = set()
        self.client = None
        self.auto_spam = False
        self.auto_message = None
        self.loder_target = None
        self.auto_convo = False
        self.admin_id = None
        self.abuse_messages = []
        self.welcome_messages = [
            "🌟 {name} को ग्रुप में स्वागत है! आनंद लें! 🌟",
            "🔥 {name} पार्टी में शामिल हुआ! मजा शुरू! 🔥",
            "👋 हे {name}, शेलेन्द्र के क्रू का स्वागत है! शिष्ट रहें वरना भुना दिए जाओगे! 👋",
            "🎉 {name} आ गए! मस्ती शुरू! 🎉",
            "😈 शेलेन्द्र के बच्चे {name} ने प्रवेश किया! सावधान रहें! 😈"
        ]

    async def send_log(self, msg):
        print(f"[LOG] {msg}")
        for ws in list(self.connections):
            try:
                await ws.send_json({"type": "log", "message": msg})
            except Exception as e:
                self.connections.remove(ws)
                print(f"WebSocket error: {e}")

    async def send_status(self, running):
        for ws in list(self.connections):
            try:
                await ws.send_json({"type": "status", "running": running})
            except Exception as e:
                self.connections.remove(ws)
                print(f"Status send error: {e}")

    async def send_settings(self):
        for ws in list(self.connections):
            try:
                await ws.send_json({
                    "type": "settings",
                    "autoSpamAccept": self.auto_spam,
                    "autoMessageAccept": bool(self.auto_message),
                    "autoConvo": self.auto_convo
                })
            except Exception as e:
                self.connections.remove(ws)
                print(f"Settings send error: {e}")

manager = Manager()

@app.get("/")
async def root():
    return {"message": "बोट चल रहा है Render पर ✅ https://shalender-hindu-ka-gulam-bot.onrender.com"}

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    manager.connections.add(ws)
    await manager.send_log("✅ WebSocket कनेक्टेड @ shalender-hindu-ka-gulam-bot.onrender.com")
    await manager.send_status(manager.client is not None)
    await manager.send_settings()
    try:
        while True:
            data = await ws.receive_json()
            if data["type"] == "start":
                manager.prefix = data.get("prefix", "!")
                manager.admin_id = data.get("adminId")
                try:
                    session_cookies = json.loads(data["cookieContent"])
                    manager.client = Bot(session_cookies=session_cookies)
                    manager.client.listen()
                    await manager.send_log("✅ बोट शुरू हो गया")
                    await manager.send_status(True)
                except json.JSONDecodeError as e:
                    await manager.send_log(f"⚠️ कुकी फाइल त्रुटि: {str(e)}")
            elif data["type"] == "stop":
                if manager.client:
                    manager.client.stop_listening()
                    manager.client = None
                await manager.send_log("🛑 बोट बंद हो गया")
                await manager.send_status(False)
            elif data["type"] == "uploadAbuse":
                manager.abuse_messages = [line.strip() for line in data["content"].splitlines() if line.strip()]
                await manager.send_log(f"✅ {len(manager.abuse_messages)} अपमान संदेश अपलोड हुए")
            elif data["type"] == "saveWelcome":
                manager.welcome_messages = [line.strip() for line in data["content"].splitlines() if line.strip()]
                await manager.send_log(f"✅ {len(manager.welcome_messages)} स्वागत संदेश सहेजे गए")
            elif data["type"] == "saveSettings":
                manager.auto_spam = data["autoSpamAccept"]
                manager.auto_message = data["autoMessageAccept"]
                manager.auto_convo = data["autoConvo"]
                await manager.send_log("✅ सेटिंग्स सहेजी गईं")
                await manager.send_settings()
    except WebSocketDisconnect:
        manager.connections.remove(ws)
        await manager.send_log("❌ WebSocket डिस्कनेक्टेड")
    except Exception as e:
        await manager.send_log(f"⚠️ WebSocket त्रुटि: {str(e)}")

class Bot(Client):
    def onMessage(self, author_id, message_object, thread_id, thread_type, **kwargs):
        message = message_object.text
        if message and author_id != self.uid:
            handle_message(author_id, thread_id, message, thread_type)

def send_reply(thread_id, thread_type, text):
    if manager.client:
        try:
            manager.client.send(
                Message(text=text),
                thread_id=thread_id,
                thread_type=thread_type
            )
        except Exception as e:
            print(f"Send error: {e}")

def handle_message(author_id, thread_id, message, thread_type):
    if not message.startswith(manager.prefix):
        if manager.auto_convo and author_id != manager.admin_id:
            send_reply(thread_id, thread_type, "🤖 ऑटो जवाब: मैं सक्रिय हूँ!")
        return

    command = message[len(manager.prefix):].split()[0].lower()
    args = message[len(manager.prefix) + len(command):].strip()

    if command == "help":
        send_reply(thread_id, thread_type,
            "कमांड्स: !help, !tid, !uid, !info, !group info, !pair, !music [url], "
            "!antiout, !send sticker [url], !autospam, !automessage [msg], "
            "!loder target [msg], !loder stop, !autoconvo, !view")
        asyncio.run_coroutine_threadsafe(manager.send_log(f"📩 {author_id} ने मदद का उपयोग किया"), loop)

    elif command == "tid":
        send_reply(thread_id, thread_type, f"थ्रेड ID: {thread_id}")

    elif command == "uid":
        send_reply(thread_id, thread_type, f"उपयोगकर्ता ID: {author_id}")

    elif command == "info":
        send_reply(thread_id, thread_type, f"बोट चल रहा है प्रीफिक्स {manager.prefix} के साथ")

    elif command == "group" and args.startswith("info"):
        send_reply(thread_id, thread_type, f"ग्रुप जानकारी: ID {thread_id}, प्रकार {thread_type}")

    elif command == "pair":
        send_reply(thread_id, thread_type, "🔗 पेयरिंग सफल!")

    elif command == "music":
        if not args:
            send_reply(thread_id, thread_type, "❌ कृपया YouTube URL दें")
            return
        send_reply(thread_id, thread_type, "🎵 संगीत डाउनलोड हो रहा है...")
        try:
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': 'song.%(ext)s',
                'quiet': True,
                'noplaylist': True,
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([args])
            send_reply(thread_id, thread_type, "✅ संगीत डाउनलोड हो गया (Render सीमा: फाइल नहीं भेजी)")
            if os.path.exists("song.mp3"):
                os.remove("song.mp3")
        except Exception as e:
            send_reply(thread_id, thread_type, f"❌ संगीत त्रुटि: {e}")

    elif command == "antiout":
        send_reply(thread_id, thread_type, "🚫 एंटीआउट सक्रिय (डमी)")

    elif command == "send" and args.startswith("sticker"):
        url = args.replace("sticker", "").strip()
        if not url:
            send_reply(thread_id, thread_type, "❌ कृपया छवि URL दें")
            return
        send_reply(thread_id, thread_type, "🖼 स्टीकर डाउनलोड हो रहा है...")
        try:
            r = requests.get(url, stream=True)
            with open("sticker.jpg", "wb") as f:
                f.write(r.content)
            img = Image.open("sticker.jpg")
            img.save("sticker.webp", "WEBP")
            send_reply(thread_id, thread_type, "✅ स्टीकर बनाया गया (Render सीमा: नहीं भेजा)")
            os.remove("sticker.jpg")
            os.remove("sticker.webp")
        except Exception as e:
            send_reply(thread_id, thread_type, f"❌ स्टीकर त्रुटि: {e}")

    elif command == "autospam":
        manager.auto_spam = not manager.auto_spam
        send_reply(thread_id, thread_type, f"🔁 ऑटोस्पैम {'सक्रिय' if manager.auto_spam else 'निष्क्रिय'}")

    elif command == "automessage":
        if args:
            manager.auto_message = args
            send_reply(thread_id, thread_type, f"💬 ऑटोमेसेज सेट: {args}")
        else:
            manager.auto_message = None
            send_reply(thread_id, thread_type, "❌ ऑटोमेसेज हटाया गया")

    elif command == "loder":
        if args.startswith("target"):
            manager.loder_target = args.replace("target", "").strip()
            send_reply(thread_id, thread_type, f"⚡ लोडर शुरू: {manager.loder_target}")
        elif args.startswith("stop"):
            manager.loder_target = None
            send_reply(thread_id, thread_type, "🛑 लोडर बंद")

    elif command == "autoconvo":
        manager.auto_convo = not manager.auto_convo
        send_reply(thread_id, thread_type, f"🤖 ऑटोकॉन्वो {'सक्रिय' if manager.auto_convo else 'निष्क्रिय'}")

    elif command == "view":
        status_msg = f"बोट स्थिति:\n- चल रहा है: {'हां' if manager.client else 'नहीं'}\n- ऑटोस्पैम: {'चालू' if manager.auto_spam else 'बंद'}\n- ऑटोकॉन्वो: {'चालू' if manager.auto_convo else 'बंद'}\n- लोडर टारगेट: {manager.loder_target or 'कोई नहीं'}"
        send_reply(thread_id, thread_type, status_msg)

if __name__ == "__main__":
    if os.getenv("FB_C_USER") and os.getenv("FB_XS"):
        session_cookies = {
            "c_user": os.getenv("FB_C_USER"),
            "xs": os.getenv("FB_XS")
        }
        manager.client = Bot(session_cookies=session_cookies)
        manager.client.listen()
