import json
import os
import logging
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from typing import Dict, List
from pathlib import Path
from fbchat_asyncio import Client, Message, ThreadType, Mention, Sticker
import random
import time
import yt_dlp as youtube_dl  # YouTube ke liye yt-dlp ka use

# Logging setup - Debugging ke liye detailed logs
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI()

# Bot settings - In-memory storage with file persistence
bot_settings = {
    "autoSpamAccept": False,  # Auto spam messages accept
    "autoMessageAccept": False,  # Auto message requests accept
    "prefix": "!",  # Command prefix
    "admin_id": "",  # Admin ka Facebook ID
    "running": False,  # Bot running status
    "antiout": False,  # Anti-kick feature
    "group_name_lock": False,  # Group name lock
    "nickname_lock": False,  # Nickname lock
    "sticker_spam": False,  # Sticker spam feature
    "loder_target": None,  # Loder target user ID
    "autoconvo": False  # Auto conversation feature
}
abuse_messages: List[str] = []  # Abuse messages ka list

# File paths - Settings aur abuse messages ke liye
SETTINGS_FILE = Path("settings.json")
ABUSE_FILE = Path("abuse.txt")

# Settings load karo - Agar file exist kare toh
def load_settings():
    global bot_settings
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r") as f:
                bot_settings.update(json.load(f))
            logger.info("Settings loaded from file")
        except Exception as e:
            logger.error(f"Failed to load settings: {e}", exc_info=True)

# Settings save karo
def save_settings():
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(bot_settings, f, indent=2)
        logger.info("Settings saved to file")
    except Exception as e:
        logger.error(f"Failed to save settings: {e}", exc_info=True)

# Abuse messages load karo
def load_abuse_messages():
    global abuse_messages
    if ABUSE_FILE.exists():
        try:
            with open(ABUSE_FILE, "r") as f:
                abuse_messages = [line.strip() for line in f if line.strip()]
            logger.info(f"Loaded {len(abuse_messages)} abuse messages")
        except Exception as e:
            logger.error(f"Failed to load abuse messages: {e}", exc_info=True)

# Abuse messages save karo
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

# Custom Facebook Bot class - fbchat-asyncio ke saath
class FacebookBot(Client):
    def __init__(self, session_cookies: dict, prefix: str, admin_id: str):
        try:
            logger.info(f"Initializing with cookies: {session_cookies}")
            if not session_cookies or not isinstance(session_cookies, dict):
                raise ValueError("Session cookies must be a non-empty dictionary")
            if not all(key in session_cookies for key in ['c_user', 'xs']):
                raise ValueError("Cookies must contain 'c_user' and 'xs' keys")
            super().__init__("", "", session_cookies=session_cookies)
            self.prefix = prefix
            self.admin_id = admin_id
            self.running = False
            self.listen_task = None
            self.sticker_task = None
            self.loder_task = None
            self.autoconvo_task = None
        except Exception as e:
            logger.error(f"Failed to initialize शेलेन्द्र हिन्दू का गुलाम बोट राम किशोर: {e}", exc_info=True)
            raise

    async def start(self):
        # Bot ko start karo aur listen task shuru karo
        try:
            if not await self.isLoggedIn():
                logger.error("Login check failed with provided cookies")
                raise ValueError("Login failed with provided cookies. Please check and use valid session cookies.")
            self.running = True
            self.listen_task = asyncio.create_task(self.listen())
            logger.info("शेलेन्द्र हिन्दू का गुलाम बोट राम किशोर started successfully")
            return True
        except Exception as e:
            logger.error(f"Bot start failed: {e}", exc_info=True)
            return False

    async def stop(self):
        # Bot ko stop karo aur saare tasks cancel karo
        self.listening = False
        if self.listen_task:
            self.listen_task.cancel()
            try:
                await self.listen_task
            except asyncio.CancelledError:
                pass
        if self.sticker_task:
            self.sticker_task.cancel()
            try:
                await self.sticker_task
            except asyncio.CancelledError:
                pass
        if self.loder_task:
            self.loder_task.cancel()
            try:
                await self.loder_task
            except asyncio.CancelledError:
                pass
        if self.autoconvo_task:
            self.autoconvo_task.cancel()
            try:
                await self.autoconvo_task
            except asyncio.CancelledError:
                pass
        try:
            await self.logout()
        except Exception as e:
            logger.error(f"Logout failed: {e}", exc_info=True)
        self.running = False
        logger.info("शेलेन्द्र हिन्दू का गुलाम बोट राम किशोर stopped")

    async def onMessage(self, mid, author_id, message_object, thread_id, thread_type, **kwargs):
        # Naye messages handle karo
        try:
            await self.markAsDelivered(thread_id, message_object.uid)
            await self.markAsRead(thread_id)

            if bot_settings["autoSpamAccept"]:
                await self.acceptPendingMessages()
            if bot_settings["autoMessageAccept"]:
                await self.acceptMessageRequests()

            if author_id != self.uid and message_object.text:
                msg = message_object.text
                if msg.startswith(self.prefix):
                    command = msg[len(self.prefix):].strip().split()
                    if command:
                        await self.handle_command(command, author_id, message_object, thread_id, thread_type)
        except Exception as e:
            logger.error(f"Error in onMessage: {e}", exc_info=True)

    async def onNameChanged(self, thread_id, new_name, author_id, **kwargs):
        # Group name change handle karo
        if bot_settings["group_name_lock"] and author_id != self.uid:
            await self.changeThreadTitle(bot_settings.get("locked_group_name", ""), thread_id)

    async def onNicknameChanged(self, thread_id, user_id, new_nickname, author_id, **kwargs):
        # Nickname change handle karo
        if bot_settings["nickname_lock"] and author_id != self.uid:
            await self.changeNickname(bot_settings.get("locked_nickname", ""), user_id, thread_id)

    async def onPersonRemoved(self, removed_id, author_id, thread_id, **kwargs):
        # Group se user remove hone ka handle karo
        if bot_settings["antiout"] and author_id != self.uid and removed_id != self.uid:
            await self.addUsersToGroup([removed_id], thread_id=thread_id)

    async def sticker_spam(self, thread_id, thread_type):
        # Sticker spam karo
        while bot_settings["sticker_spam"]:
            try:
                await self.send(Sticker("369239263222822"), thread_id=thread_id, thread_type=thread_type)
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Sticker spam error: {e}", exc_info=True)
                break

    async def loder_target(self, user_id, thread_id, thread_type, duration):
        # Target user ko abuse messages bhejo
        end_time = time.time() + int(duration)
        while time.time() < end_time and bot_settings["loder_target"]:
            try:
                message = random.choice(abuse_messages) if abuse_messages else "No abuse messages available"
                await self.send(Message(text=message, mentions=[Mention(user_id, length=len(message))]), 
                                thread_id=thread_id, thread_type=thread_type)
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Loder target error: {e}", exc_info=True)
                break

    async def autoconvo(self, thread_id, thread_type, duration):
        # Auto conversation messages bhejo
        end_time = time.time() + int(duration)
        while time.time() < end_time and bot_settings["autoconvo"]:
            try:
                message = random.choice(abuse_messages) if abuse_messages else "Hello!"
                await self.send(Message(text=message), thread_id=thread_id, thread_type=thread_type)
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Autoconvo error: {e}", exc_info=True)
                break

    async def handle_command(self, command: list, author_id: str, message_object, thread_id: str, thread_type):
        # Commands process karo
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
                    user_info = (await self.fetchUserInfo(user_id))[user_id]
                    if user_info:
                        response = f"User Info: Name - {user_info.name}, Friend: {user_info.is_friend}"
                    else:
                        response = "User info not found"
                else:
                    response = "Mention a user for info"

            elif cmd == "groupinfo":
                if thread_type == ThreadType.GROUP:
                    thread_info = (await self.fetchThreadInfo(thread_id))[thread_id]
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
                        await self.changeThreadTitle(bot_settings["locked_group_name"], thread_id)
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
                        for user_id in (await self.fetchThreadInfo(thread_id))[thread_id].participants:
                            await self.changeNickname(bot_settings["locked_nickname"], user_id, thread_id)
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
                        self.sticker_task = asyncio.create_task(self.sticker_spam(thread_id, thread_type))
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
                        self.loder_task = asyncio.create_task(self.loder_target(user_id, thread_id, thread_type, duration))
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
                        self.autoconvo_task = asyncio.create_task(self.autoconvo(thread_id, thread_type, duration))
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
                    participants = (await self.fetchThreadInfo(thread_id))[thread_id].participants
                    if len(participants) >= 2:
                        user1, user2 = random.sample(participants, 2)
                        user1_info = (await self.fetchUserInfo(user1))[user1]
                        user2_info = (await self.fetchUserInfo(user2))[user2]
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
                            await self.send(Message(text=response), thread_id=thread_id, thread_type=thread_type)
                            return
                        else:
                            response = "No results found"
                except Exception as e:
                    response = f"Error downloading music: {str(e)}"

            if response:
                await self.send(Message(text=response), thread_id=thread_id, thread_type=thread_type)
        except Exception as e:
            logger.error(f"Error in handle_command: {e}", exc_info=True)
            await self.send(Message(text=f"Command error: {str(e)}"), thread_id=thread_id, thread_type=thread_type)

# Global bot instance
bot_instance = None

# Serve HTML - Web interface ke liye
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

# WebSocket endpoint - Bot control ke liye
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
                await websocket.send_text(json.dumps({"type": "log",
