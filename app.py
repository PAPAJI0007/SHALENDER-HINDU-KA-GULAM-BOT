import asyncio
import os
import subprocess
from fastapi import FastAPI, WebSocket
from fbchat import Client, Message, ThreadType
import requests
from PIL import Image
import yt_dlp

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

    async def send_log(self, msg):
        print(f"[LOG] {msg}")
        for ws in list(self.connections):
            try:
                await ws.send_json({"type": "log", "message": msg})
            except:
                self.connections.remove(ws)

manager = Manager()

@app.get("/")
async def root():
    return {"message": "Bot is running on Render ✅ https://shalender-hindu-ka-gulam-bot.onrender.com"}

@app.websocket("/")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    manager.connections.add(ws)
    await manager.send_log("✅ WebSocket connected @ shalender-hindu-ka-gulam-bot.onrender.com")
    try:
        while True:
            await ws.receive_text()
    except:
        manager.connections.remove(ws)
        await manager.send_log("❌ WebSocket disconnected")

# ================= FBCHAT BOT =================
class Bot(Client):
    def onMessage(self, author_id, message_object, thread_id, thread_type, **kwargs):
        message = message_object.text
        if message and author_id != self.uid:
            handle_message(author_id, thread_id, message, thread_type)

def send_reply(thread_id, thread_type, text):
    manager.client.send(
        Message(text=text),
        thread_id=thread_id,
        thread_type=thread_type
    )

def handle_message(author_id, thread_id, message, thread_type):
    if not message.startswith(manager.prefix):
        if manager.auto_convo:
            send_reply(thread_id, thread_type, "🤖 Auto reply: Hello! I'm active.")
        return

    command = message[len(manager.prefix):].split()[0].lower()
    args = message[len(manager.prefix) + len(command):].strip()

    if command == "help":
        send_reply(thread_id, thread_type,
            "Commands: !help, !tid, !uid, !info, !group info, !pair, !music [url], "
            "!antiout, !send sticker [url], !autospam, !automessage [msg], "
            "!loder target [msg], !loder stop, !autoconvo")
        asyncio.run_coroutine_threadsafe(manager.send_log(f"📩 Help used by {author_id}"), loop)

    elif command == "tid":
        send_reply(thread_id, thread_type, f"Thread ID: {thread_id}")

    elif command == "uid":
        send_reply(thread_id, thread_type, f"User ID: {author_id}")

    elif command == "info":
        send_reply(thread_id, thread_type, f"Bot running with prefix {manager.prefix}")

    elif command == "group" and args.startswith("info"):
        send_reply(thread_id, thread_type, f"Group info: ID {thread_id}, Type {thread_type}")

    elif command == "pair":
        send_reply(thread_id, thread_type, "🔗 Pairing successful!")

    elif command == "music":
        if not args:
            send_reply(thread_id, thread_type, "❌ Please provide YouTube URL")
            return
        send_reply(thread_id, thread_type, "🎵 Downloading music...")
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
            send_reply(thread_id, thread_type, "✅ Music downloaded (Render limit: file not sent)")
        except Exception as e:
            send_reply(thread_id, thread_type, f"❌ Music error: {e}")

    elif command == "antiout":
        send_reply(thread_id, thread_type, "🚫 Antiout enabled (dummy)")

    elif command == "send" and args.startswith("sticker"):
        url = args.replace("sticker", "").strip()
        if not url:
            send_reply(thread_id, thread_type, "❌ Please provide image URL")
            return
        send_reply(thread_id, thread_type, "🖼 Downloading sticker...")
        try:
            r = requests.get(url, stream=True)
            with open("sticker.jpg", "wb") as f:
                f.write(r.content)
            img = Image.open("sticker.jpg")
            img.save("sticker.webp", "WEBP")
            send_reply(thread_id, thread_type, "✅ Sticker created (Render limit: not sent)")
        except Exception as e:
            send_reply(thread_id, thread_type, f"❌ Sticker error: {e}")

    elif command == "autospam":
        manager.auto_spam = not manager.auto_spam
        send_reply(thread_id, thread_type, f"🔁 AutoSpam {'enabled' if manager.auto_spam else 'disabled'}")

    elif command == "automessage":
        if args:
            manager.auto_message = args
            send_reply(thread_id, thread_type, f"💬 AutoMessage set: {args}")
        else:
            manager.auto_message = None
            send_reply(thread_id, thread_type, "❌ AutoMessage cleared")

    elif command == "loder":
        if args.startswith("target"):
            manager.loder_target = args.replace("target", "").strip()
            send_reply(thread_id, thread_type, f"⚡ Loder started: {manager.loder_target}")
        elif args.startswith("stop"):
            manager.loder_target = None
            send_reply(thread_id, thread_type, "🛑 Loder stopped")

    elif command == "autoconvo":
        manager.auto_convo = not manager.auto_convo
        send_reply(thread_id, thread_type, f"🤖 AutoConvo {'enabled' if manager.auto_convo else 'disabled'}")

# ================== START BOT ==================
# 🔑 यहाँ अपनी FB ID और पासवर्ड डाल
manager.client = Bot("YOUR_FB_EMAIL", "YOUR_FB_PASSWORD")
