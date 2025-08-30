import json
import os
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import requests
from typing import Dict, List
from pathlib import Path
from fbchat import Client, Message, ThreadType, Mention, Sticker
import threading
import random
import time
import yt_dlp as youtube_dl  # Using yt-dlp for better performance

# Logging setup
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI()

# In-memory storage (with file persistence)
bot_settings = {
    "autoSpamAccept": False,
    "autoMessageAccept": False,
    "prefix": "!",
    "admin_id": "",
    "running": False,
    "antiout": False,
    "group_name_lock": False,
    "nickname_lock": False,
    "sticker_spam": False,
    "loder_target": None,
    "autoconvo": False
}
abuse_messages: List[str] = []

# File paths (Render has ephemeral storage, so reload on start)
SETTINGS_FILE = Path("settings.json")
ABUSE_FILE = Path("abuse.txt")

# Load settings if exist
def load_settings():
    global bot_settings
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r") as f:
                bot_settings.update(json.load(f))
            logger.info("Settings loaded from file")
        except Exception as e:
            logger.error(f"Failed to load settings: {e}", exc_info=True)

# Save settings
def save_settings():
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(bot_settings, f, indent=2)
        logger.info("Settings saved to file")
    except Exception as e:
        logger.error(f"Failed to save settings: {e}", exc_info=True)

# Load abuse messages if exist
def load_abuse_messages():
    global abuse_messages
    if ABUSE_FILE.exists():
        try:
            with open(ABUSE_FILE, "r") as f:
                abuse_messages = [line.strip() for line in f if line.strip()]
            logger.info(f"Loaded {len(abuse_messages)} abuse messages")
        except Exception as e:
            logger.error(f"Failed to load abuse messages: {e}", exc_info=True)

# Save abuse messages
def save_abuse_messages(content: str):
    global abuse_messages
    try:
        abuse_messages = [line.strip() for line in content.splitlines() if line.strip()]
        with open(ABUSE_FILE, "w") as f:
            f.write(content)
        logger.info(f"Saved {len(abuse_messages)} abuse messages")
    except Exception as e:
        logger.error(f"Failed to save abuse messages: {e}", exc_info=True)

load_settings()
load_abuse_messages()

# Custom Facebook Bot
class FacebookBot(Client):
    def __init__(self, session_cookies: dict, prefix: str, admin_id: str):
        try:
            super().__init__("", "", session_cookies=session_cookies)
            self.prefix = prefix
            self.admin_id = admin_id
            self.running = False
            self.listen_thread = None
            self.sticker_thread = None
            self.loder_thread = None
            self.autoconvo_thread = None
        except Exception as e:
            logger.error(f"Failed to initialize शेलेन्द्र हिन्दू का गुलाम बोट राम किशोर: {e}", exc_info=True)
            raise

    def start(self):
        try:
            self.running = True
            self.listen_thread = threading.Thread(target=self.listen)
            self.listen_thread.daemon = True
            self.listen_thread.start()
            logger.info("शेलेन्द्र हिन्दू का गुलाम बोट राम किशोर started successfully")
            return True
        except Exception as e:
            logger.error(f"Bot start failed: {e}", exc_info=True)
            return False

    def stop(self):
        self.listening = False
        if self.listen_thread:
            self.listen_thread.join(timeout=5)
        if self.sticker_thread:
            self.sticker_thread.join(timeout=5)
        if self.loder_thread:
            self.loder_thread.join(timeout=5)
        if self.autoconvo_thread:
            self.autoconvo_thread.join(timeout=5)
        try:
            self.logout()
        except Exception as e:
            logger.error(f"Logout failed: {e}", exc_info=True)
        self.running = False
        logger.info("शेलेन्द्र हिन्दू का गुलाम बोट राम किशोर stopped")

    def onMessage(self, mid, author_id, message_object, thread_id, thread_type, **kwargs):
        try:
            self.markAsDelivered(thread_id, message_object.uid)
            self.markAsRead(thread_id)

            if bot_settings["autoSpamAccept"]:
                self.acceptPendingMessages()
            if bot_settings["autoMessageAccept"]:
                self.acceptMessageRequests()

            if author_id != self.uid and message_object.text:
                msg = message_object.text
                if msg.startswith(self.prefix):
                    command = msg[len(self.prefix):].strip().split()
                    if command:
                        self.handle_command(command, author_id, message_object, thread_id, thread_type)
        except Exception as e:
            logger.error(f"Error in onMessage: {e}", exc_info=True)

    def onNameChanged(self, thread_id, new_name, author_id, **kwargs):
        if bot_settings["group_name_lock"] and author_id != self.uid:
            self.changeThreadTitle(bot_settings.get("locked_group_name", ""), thread_id)

    def onNicknameChanged(self, thread_id, user_id, new_nickname, author_id, **kwargs):
        if bot_settings["nickname_lock"] and author_id != self.uid:
            self.changeNickname(bot_settings.get("locked_nickname", ""), user_id, thread_id)

    def onPersonRemoved(self, removed_id, author_id, thread_id, **kwargs):
        if bot_settings["antiout"] and author_id != self.uid and removed_id != self.uid:
            self.addUsersToGroup([removed_id], thread_id=thread_id)

    def sticker_spam(self, thread_id, thread_type):
        while bot_settings["sticker_spam"]:
            try:
                self.send(Sticker("369239263222822"), thread_id=thread_id, thread_type=thread_type)
                time.sleep(1)
            except Exception as e:
                logger.error(f"Sticker spam error: {e}", exc_info=True)
                break

    def loder_target(self, user_id, thread_id, thread_type, duration):
        end_time = time.time() + int(duration)
        while time.time() < end_time and bot_settings["loder_target"]:
            try:
                message = random.choice(abuse_messages) if abuse_messages else "No abuse messages available"
                self.send(Message(text=message, mentions=[Mention(user_id, length=len(message))]), 
                          thread_id=thread_id, thread_type=thread_type)
                time.sleep(1)
            except Exception as e:
                logger.error(f"Loder target error: {e}", exc_info=True)
                break

    def autoconvo(self, thread_id, thread_type, duration):
        end_time = time.time() + int(duration)
        while time.time() < end_time and bot_settings["autoconvo"]:
            try:
                message = random.choice(abuse_messages) if abuse_messages else "Hello!"
                self.send(Message(text=message), thread_id=thread_id, thread_type=thread_type)
                time.sleep(5)
            except Exception as e:
                logger.error(f"Autoconvo error: {e}", exc_info=True)
                break

    def handle_command(self, command: list, author_id: str, message_object, thread_id: str, thread_type):
        try:
            cmd = command[0].lower()
            args = command[1:]
            response = None

            if cmd == "help":
                response = "Available commands: !help, !uid, !tid, !info, !groupinfo, !antiout, !groupnamelock, !nicknamelock, !send, !autospam, !automessage, !loder, !autoconvo, !pair, !music"

            elif cmd == "uid":
                if message_object.mentions:
                    uid = message_object.mentions[0].thread_id
                    response = f"User ID: {uid}"
                else:
                    response = f"Your ID: {author_id}"

            elif cmd == "tid":
                response = f"Group ID: {thread_id}"

            elif cmd == "info":
                if message_object.mentions:
                    user_id = message_object.mentions[0].thread_id
                    user_info = self.fetchUserInfo(user_id)[user_id]
                    if user_info:
                        response = f"User Info: Name - {user_info.name}, Friend: {user_info.is_friend}"
                    else:
                        response = "User info not found"
                else:
                    response = "Mention a user for info"

            elif cmd == "groupinfo":
                if thread_type == ThreadType.GROUP:
                    thread_info = self.fetchThreadInfo(thread_id)[thread_id]
                    if thread_info:
                        response = f"Group Info: Name - {thread_info.name}, Participants: {len(thread_info.participants)}"
                    else:
                        response = "Group info not found"
                else:
                    response = "Use in a group for group info"

            elif cmd == "antiout":
                if author_id == bot_settings["admin_id"]:
                    if args and args[0] == "on":
                        bot_settings["antiout"] = True
                        response = "Antiout enabled"
                    elif args and args[0] == "off":
                        bot_settings["antiout"] = False
                        response = "Antiout disabled"
                    else:
                        response = f"Antiout status: {'on' if bot_settings['antiout'] else 'off'}"
                else:
                    response = "Admin only command"

            elif cmd == "groupnamelock":
                if author_id == bot_settings["admin_id"]:
                    if args and args[0] == "on" and len(args) > 1:
                        bot_settings["group_name_lock"] = True
                        bot_settings["locked_group_name"] = " ".join(args[1:])
                        self.changeThreadTitle(bot_settings["locked_group_name"], thread_id)
                        response = f"Group name locked to: {bot_settings['locked_group_name']}"
                    elif args and args[0] == "off":
                        bot_settings["group_name_lock"] = False
                        response = "Group name lock disabled"
                    else:
                        response = "Usage: !groupnamelock on/off <name>"
                else:
                    response = "Admin only command"

            elif cmd == "nicknamelock":
                if author_id == bot_settings["admin_id"]:
                    if args and args[0] == "on" and len(args) > 1:
                        bot_settings["nickname_lock"] = True
                        bot_settings["locked_nickname"] = " ".join(args[1:])
                        for user_id in self.fetchThreadInfo(thread_id)[thread_id].participants:
                            self.changeNickname(bot_settings["locked_nickname"], user_id, thread_id)
                        response = f"Nickname locked to: {bot_settings['locked_nickname']}"
                    elif args and args[0] == "off":
                        bot_settings["nickname_lock"] = False
                        response = "Nickname lock disabled"
                    else:
                        response = "Usage: !nicknamelock on/off <nickname>"
                else:
                    response = "Admin only command"

            elif cmd == "send" and args and args[0] == "sticker":
                if author_id == bot_settings["admin_id"]:
                    if args[1] == "start":
                        bot_settings["sticker_spam"] = True
                        self.sticker_thread = threading.Thread(target=self.sticker_spam, args=(thread_id, thread_type))
                        self.sticker_thread.daemon = True
                        self.sticker_thread.start()
                        response = "Sticker spam started"
                    elif args[1] == "stop":
                        bot_settings["sticker_spam"] = False
                        response = "Sticker spam stopped"
                    else:
                        response = "Usage: !send sticker start/stop"
                else:
                    response = "Admin only command"

            elif cmd == "autospam":
                if author_id == bot_settings["admin_id"]:
                    if args and args[0] == "accept":
                        bot_settings["autoSpamAccept"] = True
                        response = "Auto spam accept enabled"
                    else:
                        response = "Usage: !autospam accept"
                else:
                    response = "Admin only command"

            elif cmd == "automessage":
                if author_id == bot_settings["admin_id"]:
                    if args and args[0] == "accept":
                        bot_settings["autoMessageAccept"] = True
                        response = "Auto message accept enabled"
                    else:
                        response = "Usage: !automessage accept"
                else:
                    response = "Admin only command"

            elif cmd == "loder":
                if author_id == bot_settings["admin_id"]:
                    if args and args[0] == "target" and args[1] == "on" and len(args) > 2 and message_object.mentions:
                        duration = args[2]
                        user_id = message_object.mentions[0].thread_id
                        bot_settings["loder_target"] = user_id
                        self.loder_thread = threading.Thread(target=self.loder_target, args=(user_id, thread_id, thread_type, duration))
                        self.loder_thread.daemon = True
                        self.loder_thread.start()
                        response = f"Targeting user {user_id} for {duration} seconds"
                    elif args and args[0] == "stop":
                        bot_settings["loder_target"] = None
                        response = "Targeting stopped"
                    else:
                        response = "Usage: !loder target on <time> @user | !loder stop"
                else:
                    response = "Admin only command"

            elif cmd == "autoconvo":
                if author_id == bot_settings["admin_id"]:
                    if args and args[0] == "on" and len(args) > 1:
                        duration = args[1]
                        bot_settings["autoconvo"] = True
                        self.autoconvo_thread = threading.Thread(target=self.autoconvo, args=(thread_id, thread_type, duration))
                        self.autoconvo_thread.daemon = True
                        self.autoconvo_thread.start()
                        response = f"Auto conversation started for {duration} seconds"
                    elif args and args[0] == "off":
                        bot_settings["autoconvo"] = False
                        response = "Auto conversation stopped"
                    else:
                        response = "Usage: !autoconvo on/off <time>"
                else:
                    response = "Admin only command"

            elif cmd == "pair":
                if thread_type == ThreadType.GROUP:
                    participants = self.fetchThreadInfo(thread_id)[thread_id].participants
                    if len(participants) >= 2:
                        user1, user2 = random.sample(participants, 2)
                        user1_info = self.fetchUserInfo(user1)[user1]
                        user2_info = self.fetchUserInfo(user2)[user2]
                        response = f"Pair: {user1_info.name} ❤️ {user2_info.name}"
                    else:
                        response = "Not enough participants to pair"
                else:
                    response = "Use in a group for pairing"

            elif cmd == "music" and args:
                song_name = " ".join(args)
                try:
                    ydl_opts = {'format': 'bestaudio', 'outtmpl': '%(title)s.%(ext)s', 'quiet': True}
                    with youtube_dl.YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(f"ytsearch:{song_name}", download=False)
                        if info["entries"]:
                            video_url = info["entries"][0]["webpage_url"]
                            response = f"Found: {video_url}"
                            self.send(Message(text=response), thread_id=thread_id, thread_type=thread_type)
                            return
                        else:
                            response = "No results found"
                except Exception as e:
                    response = f"Error downloading music: {str(e)}"

            if response:
                self.send(Message(text=response), thread_id=thread_id, thread_type=thread_type)
        except Exception as e:
            logger.error(f"Error in handle_command: {e}", exc_info=True)
            self.send(Message(text=f"Command error: {str(e)}"), thread_id=thread_id, thread_type=thread_type)

# Global bot instance
bot_instance = None

# Serve HTML
@app.get("/")
async def get_root():
    try:
        with open("index.html", "r") as f:
            html = f.read()
        logger.info("Served index.html")
        return HTMLResponse(html)
    except FileNotFoundError:
        logger.error("index.html not found")
        return HTMLResponse("Error: index.html not found", status_code=404)
    except Exception as e:
        logger.error(f"Error serving root: {e}", exc_info=True)
        return HTMLResponse("Server Error", status_code=500)

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    global bot_instance

    await websocket.send_text(json.dumps({"type": "settings", **bot_settings}))
    logger.info("WebSocket connection established")

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "log", "message": "Invalid JSON data"}))
                logger.error("Invalid JSON received")
                continue

            if msg["type"] == "start":
                cookie_content = msg.get("cookieContent", "")
                prefix = msg.get("prefix", "!")
                admin_id = msg.get("adminId", "")

                if not cookie_content:
                    await websocket.send_text(json.dumps({"type": "log", "message": "Cookie is required"}))
                    logger.warning("Start requested without cookie")
                    continue

                try:
                    session_cookies = json.loads(cookie_content)
                except json.JSONDecodeError:
                    await websocket.send_text(json.dumps({"type": "log", "message": "Invalid cookie JSON"}))
                    logger.error("Invalid cookie JSON")
                    continue

                bot_settings["prefix"] = prefix
                bot_settings["admin_id"] = admin_id
                save_settings()  # Save updated settings

                try:
                    bot_instance = FacebookBot(session_cookies, prefix, admin_id)
                except Exception as e:
                    await websocket.send_text(json.dumps({"type": "log", "message": f"Failed to initialize शेलेन्द्र हिन्दू का गुलाम बोट राम किशोर: {str(e)}"}))
                    logger.error(f"Bot initialization failed: {e}", exc_info=True)
                    continue

                if bot_instance.start():
                    bot_settings["running"] = True
                    await websocket.send_text(json.dumps({"type": "log", "message": f"शेलेन्द्र हिन्दू का गुलाम बोट राम किशोर started with prefix: {prefix} and admin ID: {admin_id}"}))
                    await websocket.send_text(json.dumps({"type": "status", "running": True}))
                    logger.info(f"Bot started with prefix: {prefix} and admin ID: {admin_id}")
                else:
                    await websocket.send_text(json.dumps({"type": "log", "message": "Failed to start bot: Invalid cookie or login error"}))
                    bot_settings["running"] = False
                    logger.error("Bot start failed: Invalid cookie or login error")

            elif msg["type"] == "stop":
                if bot_instance:
                    bot_instance.stop()
                bot_settings["running"] = False
                await websocket.send_text(json.dumps({"type": "log", "message": "शेलेन्द्र हिन्दू का गुलाम बोट राम किशोर stopped"}))
                await websocket.send_text(json.dumps({"type": "status", "running": False}))
                logger.info("Bot stopped")

            elif msg["type"] == "uploadAbuse":
                content = msg.get("content", "")
                if content:
                    save_abuse_messages(content)
                    await websocket.send_text(json.dumps({"type": "log", "message": f"Abuse file uploaded with {len(abuse_messages)} messages"}))
                    logger.info("Abuse file uploaded")
                else:
                    await websocket.send_text(json.dumps({"type": "log", "message": "No content in abuse file"}))
                    logger.warning("Abuse upload with no content")

            elif msg["type"] == "saveSettings":
                bot_settings["autoSpamAccept"] = msg.get("autoSpamAccept", False)
                bot_settings["autoMessageAccept"] = msg.get("autoMessageAccept", False)
                save_settings()
                await websocket.send_text(json.dumps({"type": "log", "message": "Settings saved"}))
                await websocket.send_text(json.dumps({"type": "settings", **bot_settings}))
                logger.info("Settings saved")

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        await websocket.send_text(json.dumps({"type": "log", "message": f"Server error: {str(e)}"}))

# Implicit mention: Bot name updated in log messages

# For standalone run (uvicorn integration for Render/Docker)
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"Starting शेलेन्द्र हिन्दू का गुलाम बोट राम किशोर on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, wsPingInterval=20, wsPingTimeout=20, logLevel="debug")
