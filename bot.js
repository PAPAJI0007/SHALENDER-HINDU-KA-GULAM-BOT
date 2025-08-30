const fs = require('fs');
const path = require('path');
const { login } = require('ws3-fca');
const WebSocket = require('ws');
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// सेटिंग्स और अब्यूज मैसेज
let botSettings = {
  autoSpamAccept: false,
  autoMessageAccept: false,
  prefix: '!',
  adminId: '',
  running: false,
  antiout: false,
  groupNameLock: false,
  nicknameLock: false,
  stickerSpam: false,
  loderTarget: null,
  autoconvo: false,
  lockedGroupName: '',
  lockedNickname: ''
};
let abuseMessages = [];

// फाइल पाथ्स
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const ABUSE_FILE = path.join(__dirname, 'abuse.txt');

// सेटिंग्स लोड करना
function loadSettings() {
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      botSettings = { ...botSettings, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
      console.log('Settings loaded');
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }
}

// सेटिंग्स सेव करना
function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(botSettings, null, 2));
    console.log('Settings saved');
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// अब्यूज मैसेज लोड करना
function loadAbuseMessages() {
  if (fs.existsSync(ABUSE_FILE)) {
    try {
      abuseMessages = fs.readFileSync(ABUSE_FILE, 'utf8').split('\n').filter(line => line.trim());
      console.log(`Loaded ${abuseMessages.length} abuse messages`);
    } catch (e) {
      console.error('Failed to load abuse messages:', e);
    }
  }
}

// अब्यूज मैसेज सेव करना
function saveAbuseMessages(content) {
  try {
    abuseMessages = content.split('\n').filter(line => line.trim());
    fs.writeFileSync(ABUSE_FILE, content);
    console.log(`Saved ${abuseMessages.length} abuse messages`);
  } catch (e) {
    console.error('Failed to save abuse messages:', e);
  }
}

loadSettings();
loadAbuseMessages();

// WebSocket लॉग भेजना
function broadcastLog(message, type = 'log') {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, message }));
    }
  });
}

// कुकीज लोड करना
let credentials;
if (process.env.APPSTATE) {
  try {
    credentials = { appState: JSON.parse(process.env.APPSTATE) };
  } catch (err) {
    broadcastLog('Invalid APPSTATE environment variable. Please upload valid cookies.', 'error');
    process.exit(1);
  }
} else {
  try {
    credentials = { appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8')) };
  } catch (err) {
    broadcastLog('appstate.json missing or invalid. Please upload cookies via control panel.', 'error');
    process.exit(1);
  }
}

// ws3-fca लॉगिन
let apiInstance = null;
login(credentials, {
  online: true,
  updatePresence: true,
  selfListen: false,
  randomUserAgent: false
}, async (err, api) => {
  if (err) {
    broadcastLog(`Login error: ${err.message}`, 'error');
    return;
  }

  apiInstance = api;
  broadcastLog(`Logged in as Shalender Hindu Ka Gulam Ram India F Bot (${api.getCurrentUserID()})`);
  botSettings.running = true;
  wss.clients.forEach(client => {
    client.send(JSON.stringify({ type: 'status', running: true }));
    client.send(JSON.stringify({ type: 'settings', ...botSettings }));
  });

  // कमांड्स लोड करना
  const commandsDir = path.join(__dirname, 'modules', 'commands');
  const commands = new Map();

  if (!fs.existsSync(commandsDir)) fs.mkdirSync(commandsDir, { recursive: true });

  for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
    const command = require(path.join(commandsDir, file));
    if (command.name && typeof command.execute === 'function') {
      commands.set(command.name, command);
      broadcastLog(`Loaded command: ${command.name}`);
    }
  }

  // WebSocket कनेक्शन हैंडल करना
  wss.on('connection', ws => {
    ws.send(JSON.stringify({ type: 'log', message: 'WebSocket client connected' }));
    ws.send(JSON.stringify({ type: 'status', running: botSettings.running }));
    ws.send(JSON.stringify({ type: 'settings', ...botSettings }));
  });

  wss.on('message', async message => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'start') {
        botSettings.prefix = data.prefix || '!';
        botSettings.adminId = data.adminId || '';
        try {
          credentials.appState = JSON.parse(data.cookieContent);
          fs.writeFileSync('appstate.json', JSON.stringify(credentials.appState, null, 2));
          broadcastLog('Cookies updated via control panel');
          // री-लॉगिन अगर जरूरी हो
          if (!apiInstance) {
            login(credentials, { online: true, updatePresence: true, selfListen: false, randomUserAgent: false }, (err, newApi) => {
              if (err) {
                broadcastLog(`Re-login error: ${err.message}`, 'error');
                return;
              }
              apiInstance = newApi;
              broadcastLog(`Re-logged in as ${apiInstance.getCurrentUserID()}`);
            });
          }
        } catch (e) {
          broadcastLog(`Invalid cookie JSON: ${e.message}`, 'error');
        }
      } else if (data.type === 'stop') {
        botSettings.running = false;
        botSettings.stickerSpam = false;
        botSettings.loderTarget = null;
        botSettings.autoconvo = false;
        saveSettings();
        broadcastLog('Shalender Hindu Ka Gulam Ram India F Bot stopped');
        wss.clients.forEach(client => {
          client.send(JSON.stringify({ type: 'status', running: false }));
        });
        process.exit(0);
      } else if (data.type === 'uploadAbuse') {
        saveAbuseMessages(data.content);
        broadcastLog(`Uploaded ${abuseMessages.length} abuse messages`);
      } else if (data.type === 'saveSettings') {
        botSettings.autoSpamAccept = data.autoSpamAccept;
        botSettings.autoMessageAccept = data.autoMessageAccept;
        saveSettings();
        broadcastLog('Settings saved');
        wss.clients.forEach(client => {
          client.send(JSON.stringify({ type: 'settings', ...botSettings }));
        });
      }
    } catch (e) {
      broadcastLog(`WebSocket message error: ${e.message}`, 'error');
    }
  });

  // मैसेज लिसनर
  api.listenMqtt(async (err, event) => {
    if (err || !event.body || event.type !== 'message') return;

    if (botSettings.autoSpamAccept && event.isSpam) {
      api.acceptMessageRequest(event.threadID);
    }
    if (botSettings.autoMessageAccept && event.isMessageRequest) {
      api.acceptMessageRequest(event.threadID);
    }

    if (!event.body.startsWith(botSettings.prefix)) return;

    const args = event.body.slice(botSettings.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = commands.get(commandName);
    if (!command) {
      return api.sendMessageMqtt('❌ Unknown command.', event.threadID, event.messageID);
    }

    try {
      await command.execute({ api, event, args, botSettings, abuseMessages, broadcastLog });
    } catch (error) {
      broadcastLog(`Error in ${commandName}: ${error.message}`, 'error');
      api.sendMessageMqtt('❌ Command execution failed.', event.threadID, event.messageID);
    }
  });

  // ग्रुप इवेंट्स (नेम चेंज, निकनेम चेंज, एंटी-आउट)
  api.listenMqtt(async (err, event) => {
    if (err) return;

    if (event.type === 'event') {
      if (botSettings.groupNameLock && event.logMessageType === 'log:thread-name' && event.author !== api.getCurrentUserID()) {
        api.setTitle(botSettings.lockedGroupName, event.threadID);
        broadcastLog(`Reverted group name to: ${botSettings.lockedGroupName}`);
      }
      if (botSettings.nicknameLock && event.logMessageType === 'log:user-nickname' && event.author !== api.getCurrentUserID()) {
        api.changeNickname(botSettings.lockedNickname, event.logMessageData.participant_id, event.threadID);
        broadcastLog(`Reverted nickname for ${event.logMessageData.participant_id} to: ${botSettings.lockedNickname}`);
      }
      if (botSettings.antiout && event.logMessageType === 'log:unsubscribe' && event.author !== api.getCurrentUserID()) {
        api.addUserToGroup(event.logMessageData.leftParticipantFbId, event.threadID);
        broadcastLog(`Added back user ${event.logMessageData.leftParticipantFbId} due to antiout`);
      }
    }
  });
});

// HTML सर्व करना
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// WebSocket रूट के लिए
app.get('/ws', (req, res) => {
  res.status(200).send('WebSocket endpoint');
});

// सर्वर शुरू करो
server.listen(process.env.PORT || 3000, () => {
  broadcastLog(`Web server running on port ${process.env.PORT || 3000} for Shalender Hindu Ka Gulam Ram India F Bot`);
});
