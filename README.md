# शेलेन्द्र हिन्दू का गुलाम बोट राम किशोर

## Overview
A Facebook bot with a web control panel, deployed on Render using Docker. The bot supports commands like !help, !uid, !loder, etc., restricted to the admin ID.

## Files
- `Dockerfile`: Builds the Docker image.
- `Procfile`: Defines the web process for Render.
- `requirements.txt`: Python dependencies.
- `index.html`: Web control panel.
- `app.py`: Main bot script (FastAPI + fbchat).
- `abuse.txt`: Sample abuse messages (upload your own via panel).
- `settings.json`: Default bot settings.

## Deployment on Render
1. Create a GitHub repo and push these files.
2. On Render, create a new Web Service, select "Docker" as runtime.
3. Link your GitHub repo.
4. Render will build from `Dockerfile` and run via `Procfile`.
5. Access at `https://shalender-hindu-ka-gulam-bot-ram.onrender.com`.
6. Use the control panel to:
   - Paste valid Facebook cookies.
   - Set prefix (e.g., !).
   - Set admin ID for restricted commands.
   - Upload `abuse.txt` for !loder and !autoconvo.

## Notes
- **Ephemeral Storage**: Render's file system is temporary. `settings.json` and `abuse.txt` reset on restart. Upload `abuse.txt` via panel each time or use external storage (e.g., MongoDB).
- **Websocket**: Connected to `wss://shalender-hindu-ka-gulam-bot-ram.onrender.com/ws` with auto-reconnect.
- **Cookies**: Use valid Facebook cookies or the bot won't login.
- **Commands**: Restricted commands (e.g., !antiout, !loder) require admin ID.
- **Debugging**: Check logs in the control panel or Render dashboard.

## Commands
- `!help`: List all commands
- `!uid`: Get user ID
- `!tid`: Get group ID
- `!info @mention`: Get user info
- `!groupinfo`: Get group info
- `!antiout on/off`: Toggle anti-out (admin only)
- `!groupnamelock on/off <name>`: Lock/unlock group name (admin only)
- `!nicknamelock on/off <nickname>`: Lock/unlock nicknames (admin only)
- `!send sticker start/stop`: Sticker spam (admin only)
- `!autospam accept`: Enable auto spam accept (admin only)
- `!automessage accept`: Enable auto message accept (admin only)
- `!loder target on <time> @user`: Target user with abuse messages (admin only)
- `!loder stop`: Stop targeting (admin only)
- `!autoconvo on/off <time>`: Auto conversation with timer (admin only)
- `!pair`: Pair random group members
- `!music <song name>`: Search YouTube for music

## Environment Variables
- `PORT`: Set by Render (default: 8000).
