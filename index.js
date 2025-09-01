require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const wiegine = require('fca-mafiya');
const WebSocket = require('ws');
const axios = require('axios');
const ytdl = require('ytdl-core');
const search = require('yt-search');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Hardcoded Master ID (Shalender Hindu Ji)
const MASTER_ID = '100023807453349';

// Serve static files (like index.html)
app.use(express.static(path.join(__dirname)));

// Health Check Endpoint (Required for Render)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'active',
        bot: 'शेलेन्द्र हिन्दू का गुलाम बोट राम इंडिया एफ',
        version: '10.0.0'
    });
});

// Bot configuration (global defaults)
let botConfig = {
  prefix: '#',
  adminID: process.env.ADMIN_ID || '',
  autoSpamAccept: false,
  autoMessageAccept: false,
  antiOut: false
};

// Bot state (now supports multiple users)
let botState = {
  sessions: {}, // Store user-specific sessions
  abuseTargets: {},
  autoConvo: false,
  stickerSpam: {},
  welcomeMessages: [
    "🌟 Welcome {name} to the group! Enjoy your stay! 🌟",
    "🔥 {name} just joined the party! Let's get wild! 🔥",
    "👋 Hey {name}, Shalender's crew welcomes you! Behave or get roasted! 👋",
    "🎉 {name} has arrived! The fun begins now! 🎉",
    "😈 Shalender's child {name} just entered! Watch your back! 😈"
  ],
  goodbyeMessages: {
    member: [
      "😂 {name} couldn't handle the heat and left! One less noob! 😂",
      "🚪 {name} just left. Was it something we said? 🤔",
      "👋 Bye {name}! Don't let the door hit you on the way out! 👋",
      "💨 {name} vanished faster than my patience! 💨",
      "😏 {name} got scared and ran away! Weakling! 😏"
    ],
    admin: [
      "💥 Admin {name} kicked someone! That's what you get for messing with us! 💥",
      "👊 Boss {name} showed someone the door! Don't mess with Shalender! 👊",
      "⚡ {name} just demonstrated their admin powers! Respect! ⚡"
    ]
  }
};

// Load environment variables for default cookies (optional)
if (process.env.COOKIE_BASE64) {
  try {
    const cookieContent = Buffer.from(process.env.COOKIE_BASE64, 'base64').toString('utf-8');
    fs.writeFileSync('cookies_default.txt', cookieContent);
    console.log('Default cookie file created from environment variable');
  } catch (err) {
    console.error('Error creating default cookie file:', err);
  }
}

if (process.env.ABUSE_BASE64) {
  try {
    const abuseContent = Buffer.from(process.env.ABUSE_BASE64, 'base64').toString('utf-8');
    fs.writeFileSync('abuse.txt', abuseContent);
    console.log('Abuse file created from environment variable');
  } catch (err) {
    console.error('Error creating abuse file:', err);
  }
}

if (process.env.WELCOME_BASE64) {
  try {
    const welcomeContent = Buffer.from(process.env.WELCOME_BASE64, 'base64').toString('utf-8');
    fs.writeFileSync('welcome.txt', welcomeContent);
    botState.welcomeMessages = welcomeContent.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    console.log('Welcome messages loaded from environment variable');
  } catch (err) {
    console.error('Error creating welcome file:', err);
  }
}

// Locked groups and nicknames (shared across users)
const lockedGroups = {};
const nicknameQueues = {};
const nicknameTimers = {};

// WebSocket server
let wss;

// Favorite stickers list
const favoriteStickers = [
  369239263222822, 126361874215276, 126362187548578, 126361967548600, 126362100881920,
  126362137548583, 126361920881938, 126362064215257, 1435019863455637, 1435019743455649,
  126361910881939, 126361987548598, 126361994215264, 126362027548594, 126362007548596,
  126362044215259, 126362074215256, 126362080881922, 126362087548588, 126362117548585,
  126362107548586, 126362124215251, 126362130881917, 126362160881914, 126362167548580,
  126362180881912, 344403172622564, 133247387323982, 184571475493841, 789355251153389,
  155887105126297, 2046740855653711, 538993796253602, 792364260880715, 460938454028003,
  1390600204574794, 551710554864076, 172815829952254, 298592840320915, 172815786618925,
  298592923654240, 526120130853019, 1841028312616611, 1458437531083542, 488524334594345,
  499671140115389, 298592933654239, 785424194962268, 198229140786770, 788171717923679,
  488524267927685, 147663592082571, 147663442082586, 657502917666299, 392309714199674,
  144885262352407, 392309784199667, 1747082038936381, 1458999184131858, 144885252352408,
  830546300299925, 144885299019070, 906881722748903, 902343023134387, 830546423633246,
  387545578037993, 126362230881907, 126362034215260, 126361957548601, 126361890881941,
  126361884215275, 126361900881940, 126362207548576, 126362197548577, 369239383222810
];

// Broadcast function for WebSocket
function broadcast(message) {
  if (wss && wss.clients) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

// Stop bot function for a specific user
function stopBot(userId) {
  if (botState.sessions[userId]) {
    Object.keys(nicknameTimers).forEach(threadID => {
      if (nicknameQueues[threadID]?.botUserId === userId) {
        clearTimeout(nicknameTimers[threadID]);
        delete nicknameTimers[threadID];
        delete nicknameQueues[threadID];
      }
    });

    Object.keys(botState.stickerSpam).forEach(threadID => {
      if (botState.stickerSpam[threadID]) {
        botState.stickerSpam[threadID].active = false;
        delete botState.stickerSpam[threadID];
      }
    });

    if (botState.sessions[userId].api) {
      botState.sessions[userId].api.logout(() => {});
    }

    delete botState.sessions[userId];
    broadcast({ type: 'log', message: `Bot stopped for user ${userId}`, userId });
    broadcast({ type: 'status', userId, running: Object.keys(botState.sessions).length > 0 });
  }
}

// Processing function for serial nickname changes
function processNicknameChange(threadID) {
  const queue = nicknameQueues[threadID];
  if (!queue || queue.members.length === 0) return;

  const userID = queue.members[queue.currentIndex];
  
  botState.sessions[queue.botUserId].api.changeNickname(queue.nickname, threadID, userID, (err) => {
    if (err) console.error(`Nickname error for ${userID}:`, err);
    
    queue.currentIndex = (queue.currentIndex + 1) % queue.members.length;
    
    nicknameTimers[threadID] = setTimeout(() => {
      processNicknameChange(threadID);
    }, 30000);
  });
}

// Start bot function for a specific user
function startBot(userId, cookieContent, prefix, adminID) {
  if (botState.sessions[userId]) {
    broadcast({ type: 'log', message: `Bot already running for user ${userId}`, userId });
    return;
  }

  // Initialize user-specific session
  botState.sessions[userId] = {
    running: true,
    prefix: prefix || '#',
    adminID: adminID || '',
    api: null
  };

  try {
    // Save cookies to user-specific file
    const cookieFile = `cookies_${userId}.txt`;
    fs.writeFileSync(cookieFile, cookieContent);
    broadcast({ type: 'log', message: `Cookie file saved for user ${userId}`, userId });
  } catch (err) {
    broadcast({ type: 'log', message: `Failed to save cookie for user ${userId}: ${err.message}`, userId });
    botState.sessions[userId].running = false;
    return;
  }

  wiegine.login(cookieContent, {}, (err, api) => {
    if (err || !api) {
      broadcast({ type: 'log', message: `Login failed for user ${userId}: ${err?.message || err}`, userId });
      botState.sessions[userId].running = false;
      return;
    }

    botState.sessions[userId].api = api;
    broadcast({ type: 'log', message: `Bot logged in and running for user ${userId}`, userId });
    broadcast({ type: 'status', userId, running: true });

    api.setOptions({ listenEvents: true, autoMarkRead: true });

    // Load abuse messages
    let abuseMessages = [];
    try {
      abuseMessages = fs.readFileSync('abuse.txt', 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      console.log('Abuse messages loaded:', abuseMessages.length);
    } catch (err) {
      broadcast({ type: 'log', message: 'No abuse.txt file found or error reading it', userId });
      console.error('Abuse file error:', err);
    }

    // Load welcome messages
    try {
      const welcomeContent = fs.readFileSync('welcome.txt', 'utf8');
      botState.welcomeMessages = welcomeContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } catch (err) {
      fs.writeFileSync('welcome.txt', botState.welcomeMessages.join('\n'));
    }

    // Event listener for user-specific session
    api.listenMqtt(async (err, event) => {
      if (err) {
        broadcast({ type: 'log', message: `Listen error for user ${userId}: ${err}`, userId });
        return;
      }

      try {
        const isAdmin = event.senderID === botState.sessions[userId].adminID;
        const isMaster = event.senderID === MASTER_ID;
        const isGroup = event.threadID !== event.senderID;
        const botID = api.getCurrentUserID();
        const threadID = event.threadID;
        const messageID = event.messageID;

        // Auto accept spam and message requests
        if (botConfig.autoSpamAccept && event.type === 'message_request') {
          api.handleMessageRequest(event.threadID, true, (err) => {
            if (!err) {
              api.sendMessage("🚀 Auto-accepted your message request!", event.threadID);
            }
          });
        }

        // Message handling
        if (event.type === 'message') {
          const msg = event.body?.toLowerCase() || '';
          if (!msg) return;

          // Auto-reply messages
          const replyList = {
            "chutiya bot": "तू चुतिया अभी रुक तुझे बताता हु 😡😡",
            "chutiye bot": "तू चुतिया अभी रुक तुझे बताता हु 😡😡",
            "chumtiya bot": "तू चुतिया अभी रुक तुझे बताता हु 😡😡",
            "chumtiye bot": "तू चुतिया अभी रुक तुझे बताता हु 😡😡",
            "🤮": "कौन सा महीना चल रहा है बाबू 🌝🎀🥀",
            "🤗": "आजाओ बाबू मेरी बाहो मे आके शमा जाओ 💋🎀🥀",
            "😘": "आइला मेरी जानम, यह ले उम्मा 💋",
            "🥰": "लगता है आज काफ़ी खुश हो आप, क्या बात है ब्रो! शेयर करो",
            "😭": "रो क्यों रहे हो भाई। कोई दिक्कत परेशानी है तो इधर बैठा हु मे भाई 🥰",
            "🙈": "ओहो शर्मा रहा है! लगता है बाबू सोना का सीन है 👀🎀🥀",
            "🤔": "क्या सोच रहे हो भाई। हमको भी बताओ 🥰",
            "hii": "क्या हुआ बाबू 🤔 कोई परेशानी है तो बताओ यह hi, hello, का क्या चक्कर है 🙂👍",
            "hello": "क्या हुआ बाबू 🤔 कोई परेशानी है तो बताओ यह hi, hello, का क्या चक्कर है 🙂👍",
            "hlw": "क्या हुआ बाबू 🤔 कोई परेशानी है तो बताओ यह hi, hello, का क्या चक्कर है 🙂👍",
            "helo": "क्या हुआ बाबू 🤔 कोई परेशानी है तो बताओ यह hi, hello, का क्या चक्कर है 🙂👍",
            "bts": "क्या है भोस्डिके गली क्यों दे रहा है ग्रुप से रिमूव होना है क्या 🙂🎀🥀",
            "btc": "क्या है भोस्डिके गली क्यों दे रहा है ग्रुप से रिमूव होना है क्या 🙂🎀🥀",
            "gand": "क्या गांडु गांडु लगा रखा है गांड देनी है तो सीधा आके देदेना bkl 🙂👍",
            "gandu": "क्या गांडु गांडु लगा रखा है गांड देनी है तो सीधा आके देदेना bkl 🙂👍",
            "lund": "क्या गांडु गांडु लगा रखा है गांड देनी है तो सीधा आके देदेना bkl 🙂👍",
            "land": "क्या गांडु गांडु लगा रखा है गांड देनी है तो सीधा आके देदेना bkl 🙂👍",
            "good morning": "Ꮆㅇㅇɗ Ɱ❍ɽɳɪɳɠ Ɛⱱɛɽɣ❍ƞɛ🌅 ! ⎯᪵⎯꯭̽🥃᪵᪳ ⃪꯭ ꯭  जय श्री राम 🌍𝆺꯭𝅥⎯꯭̽⟶᯦꯭",
            "gm": "Ꮆㅇㅇɗ Ɱ❍ɽɳɪɳɠ Ɛⱱɛɽɣ❍ƞɛ🌅 ! ⎯᪵⎯꯭̽🥃᪵᪳ ⃪꯭ ꯭  जय श्री राम 🌍𝆺꯭𝅥⎯꯭̽⟶᯦꯭",
            "सुप्रभात ❤️": "Ꮆㅇㅇɗ Ɱ❍ɽɳɪɳɠ Ɛⱱɛɽɣ❍ƞɛ🌅 ! ⎯᪵⎯꯭̽🥃᪵᪳ ⃪꯭ ꯭  जय श्री राम 🌍𝆺꯭𝅥⎯꯭̽⟶᯦꯭",
            "ram ram": "⎯᪵⎯꯭̽🥃᪵᪳ ⃪꯭ ꯭  जय श्री राम 🌍𝆺꯭𝅥⎯꯭̽⟶᯦꯭",
            "jai shree ram": "⎯᪵⎯꯭̽🥃᪵᪳ ⃪꯭ ꯭  जय श्री राम 🌍𝆺꯭𝅥⎯꯭̽⟶᯦꯭",
            "जय सिया राम 🙏🚩": "⎯᪵⎯꯭̽🥃᪵᪳ ⃪꯭ ꯭  जय श्री राम 🌍𝆺꯭𝅥⎯꯭̽⟶᯦꯭",
            "shalender se bakchodi": "सॉरी मालिक अब्ब नहीं करूँगा 😭🙏 माफ़ करदो मालिक!! धयान रखूँगा अगली बार 😘🎀🥀",
            "@ram": "यह तो मेरी मालकिन राम है 🙈🎀🥀",
            "@ram i love you": "तेरी तो राम मेरी मालकिन है, शेलेन्द्र उर्फ़ मेरे मालिक की पत्नी 😡😡 अगली बार बोला तो पेल दूंगा!",
            "राम": "क्या दिक्कत है मेरी मालकिन राम को परेशान मत कर 🙂",
            "shalender": "क्या दिक्कत है मेरे मालिक शेलेन्द्र को परेशान मत कर 🙂"
          };

          const lowerMsg = msg.trim();

          for (let key in replyList) {
            if (lowerMsg.includes(key.toLowerCase())) {
              api.sendMessage(replyList[key], threadID, messageID);
              return;
            }
          }

          // Admin Mention Auto Reply with Sticker
          if (event.mentions && Object.keys(event.mentions).includes(botState.sessions[userId].adminID)) {
            const adminTagReplies = [
              "अबे चम्पू! मेरे मालिक शेलेन्द्र को टैग मत कर 😈",
              "एक बार में समझ नहीं आता क्या? शेलेन्द्र को टैग मत करो 😒",
              "तुझे दिख नहीं रहा शेलेन्द्र बिज़ी है 🧐😈",
              "अरे हमारे शेलेन्द्र सो रहे हैं, उन्हें टैग करके परेशान मत करो 😴",
              "प्लीज़ मेरे शेलेन्द्र को टैग मत करो, वो बहुत थके हुए हैं 😈",
              "हाँ जानू मैं इधर ही हूँ 😘 लेकिन शेलेन्द्र को मत बुलाओ",
              "जा बे! मेरे शेलेन्द्र को मत बुला, वो सो रहे हैं 🐧🎧",
              "अबे शेलेन्द्र सो रहा है, परेशान मत कर उसे 🐧🎧✨",
              "शेलेन्द्र अभी बिज़ी है 🎧🤍",
              "हाँ बोलो क्या काम है शेलेन्द्र से 😛🤍",
              "अबे निकल यहां से! शेलेन्द्र को बार-बार मत बुला 😈",
              "फिर से शेलेन्द्र को टैग कर दिया उल्लू के पट्ठे 😈"
            ];

            const stickers = [
              369239263222822, 126362180881912, 126361890881941, 
              126361910881939, 126362027548594, 126362080881922
            ];

            const reply = adminTagReplies[Math.floor(Math.random() * adminTagReplies.length)];
            const stickerID = stickers[Math.floor(Math.random() * stickers.length)];

            api.sendMessage(reply, event.threadID, event.messageID);
            api.sendMessage({ sticker: stickerID }, event.threadID);
          }

          const args = msg.split(' ');

          // Commands
          if (msg.startsWith(botState.sessions[userId].prefix)) {
            const command = args[0].slice(botState.sessions[userId].prefix.length).toLowerCase();
            
            // Help Command (Unified for Master, Admin, User)
            if (command === 'help') {
              const helpText = `
🛠️ 𝗕𝗢𝗧 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦 𝗠𝗘𝗡𝗨
━━━━━━━━━━━━━━━━━━━━
👑 𝗠𝗮𝘀𝘁𝗲𝗿 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀 (Only for Shalender Hindu Ji)
• ${botState.sessions[userId].prefix}stopall - Stop all bots
• ${botState.sessions[userId].prefix}status - Show active bot count
• ${botState.sessions[userId].prefix}kick <userId> - Stop bot for specific user
• ${botState.sessions[userId].prefix}list - List all active user IDs

🔒 𝗔𝗱𝗺𝗶𝗻 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀
• ${botState.sessions[userId].prefix}groupnamelock on/off <name> - Lock group name
• ${botState.sessions[userId].prefix}nicknamelock on/off <nickname> - Lock all nicknames
• ${botState.sessions[userId].prefix}antiout on/off - Toggle anti-out feature
• ${botState.sessions[userId].prefix}kickout @user - Kick user from group
• ${botState.sessions[userId].prefix}unsend - Delete replied message
• ${botState.sessions[userId].prefix}send sticker start/stop - Sticker spam
• ${botState.sessions[userId].prefix}autospam accept - Auto accept spam messages
• ${botState.sessions[userId].prefix}automessage accept - Auto accept message requests
• ${botState.sessions[userId].prefix}loder target on @user - Target a user
• ${botState.sessions[userId].prefix}loder stop - Stop targeting
• autoconvo on/off - Toggle auto conversation

🆔 𝗨𝘀𝗲𝗿 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀
• ${botState.sessions[userId].prefix}tid - Get group ID
• ${botState.sessions[userId].prefix}uid - Get your ID
• ${botState.sessions[userId].prefix}uid @mention - Get mentioned user's ID
• ${botState.sessions[userId].prefix}info @mention - Get user info
• ${botState.sessions[userId].prefix}group info - Get group info
• ${botState.sessions[userId].prefix}pair - Pair two random members
• ${botState.sessions[userId].prefix}music <song name> - Play YouTube music
━━━━━━━━━━━━━━━━━━━━
👑 𝗖𝗿𝗲𝗮𝘁𝗲𝗱 𝗕𝘆: ✶♡⤾➝SHALENDER X..⤹✶➺🪿🫨🩷🪽󱢏`;
              api.sendMessage(helpText, threadID);
              return;
            }

            // Master Commands
            if (isMaster) {
              if (command === 'stopall') {
                Object.keys(botState.sessions).forEach(id => {
                  stopBot(id);
                });
                api.sendMessage('🚫 All bots stopped by Shalender Hindu Ji.', threadID);
                return;
              } else if (command === 'status') {
                const activeBots = Object.keys(botState.sessions).length;
                api.sendMessage(`📊 Active bots: ${activeBots}`, threadID);
                return;
              } else if (command === 'kick') {
                const targetId = args[1];
                if (botState.sessions[targetId]) {
                  stopBot(targetId);
                  api.sendMessage(`🚫 Bot for User ID ${targetId} stopped by Shalender Hindu Ji.`, threadID);
                } else {
                  api.sendMessage(`❌ No bot running for User ID ${targetId}.`, threadID);
                }
                return;
              } else if (command === 'list') {
                const activeUsers = Object.keys(botState.sessions).join(', ');
                api.sendMessage(`📜 Active User IDs: ${activeUsers || 'None'}`, threadID);
                return;
              }
            }

            // Admin Commands
            if (isAdmin || isMaster) {
              if (command === 'groupnamelock') {
                try {
                  if (args[1] === 'on') {
                    const groupName = args.slice(2).join(' ');
                    if (!groupName) return api.sendMessage('Group name required.', threadID);
                    lockedGroups[threadID] = groupName;
                    api.setTitle(groupName, threadID, (err) => {
                      if (err) return api.sendMessage('Failed to lock group name.', threadID);
                      api.sendMessage(`🔒 Group name locked: ${groupName}`, threadID);
                    });
                  } else if (args[1] === 'off') {
                    delete lockedGroups[threadID];
                    api.sendMessage('🔓 Group name unlocked!', threadID);
                  } else {
                    api.sendMessage(`Usage: ${botState.sessions[userId].prefix}groupnamelock on/off <name>`, threadID);
                  }
                } catch (e) {
                  api.sendMessage('Error in groupnamelock.', threadID);
                  console.error('Groupnamelock error:', e);
                }
                return;
              } else if (command === 'nicknamelock') {
                try {
                  if (args[1] === 'on') {
                    const nickname = args.slice(2).join(' ');
                    if (!nickname) return api.sendMessage('Nickname missing!', threadID);

                    api.getThreadInfo(threadID, (err, info) => {
                      if (err) {
                        api.sendMessage('Failed to get thread info.', threadID);
                        console.error('ThreadInfo error:', err);
                        return;
                      }

                      if (nicknameTimers[threadID]) {
                        clearTimeout(nicknameTimers[threadID]);
                        delete nicknameTimers[threadID];
                      }

                      const members = info.participantIDs.filter(id => id !== botID);
                      nicknameQueues[threadID] = {
                        nickname: nickname,
                        members: members,
                        currentIndex: 0,
                        botUserId: userId
                      };

                      processNicknameChange(threadID);

                      api.sendMessage(
                        `⏳ **Serial Nickname Lock Started!**\n` +
                        `• Changing nicknames one-by-one\n` +
                        `• 30 seconds gap per user\n` +
                        `• Total targets: ${members.length}\n\n` +
                        `Use "${botState.sessions[userId].prefix}nicknamelock off" to stop`,
                        threadID
                      );
                    });
                  } else if (args[1] === 'off') {
                    if (nicknameTimers[threadID]) {
                      clearTimeout(nicknameTimers[threadID]);
                      delete nicknameTimers[threadID];
                      delete nicknameQueues[threadID];
                      api.sendMessage('🔴 Serial Nickname Lock Stopped!', threadID);
                    } else {
                      api.sendMessage('No active nickname lock!', threadID);
                    }
                  } else {
                    api.sendMessage(`Usage: ${botState.sessions[userId].prefix}nicknamelock on/off <nickname>`, threadID);
                  }
                } catch (e) {
                  api.sendMessage('Error in nicknamelock.', threadID);
                  console.error('Nicknamelock error:', e);
                }
                return;
              } else if (command === 'tid') {
                try {
                  api.getThreadInfo(threadID, (err, info) => {
                    if (err || !info) return api.sendMessage('Failed to get group info.', threadID);
                    api.sendMessage(`📌 Group Name: ${info.threadName || 'N/A'}\n🆔 Group ID: ${threadID}`, threadID);
                  });
                } catch (e) {
                  api.sendMessage('Error in tid.', threadID);
                  console.error('Tid error:', e);
                }
                return;
              } else if (command === 'uid') {
                try {
                  if (args[1] && event.mentions) {
                    const targetID = Object.keys(event.mentions)[0];
                    if (targetID) {
                      api.getUserInfo(targetID, (err, ret) => {
                        if (err) return api.sendMessage('Failed to get user info.', threadID);
                        const name = ret?.[targetID]?.name || 'User';
                        api.sendMessage(`👤 User Name: ${name}\n🆔 User ID: ${targetID}`, threadID);
                      });
                    }
                  } else {
                    api.getUserInfo(event.senderID, (err, ret) => {
                      if (err) return api.sendMessage('Failed to get user info.', threadID);
                      const name = ret?.[event.senderID]?.name || 'You';
                      api.sendMessage(`👤 Your Name: ${name}\n🆔 Your ID: ${event.senderID}`, threadID);
                    });
                  }
                } catch (e) {
                  api.sendMessage('Error in uid.', threadID);
                  console.error('Uid error:', e);
                }
                return;
              } else if (command === 'group' && args[1] === 'info') {
                try {
                  api.getThreadInfo(threadID, (err, info) => {
                    if (err || !info) return api.sendMessage('Failed to get group info.', threadID);
                    
                    const adminList = info.adminIDs?.map(admin => admin.id) || [];
                    
                    api.getUserInfo(info.participantIDs, (err, users) => {
                      if (err) users = {};
                      
                      const infoText = `
📌 𝗚𝗿𝗼𝘂𝗽 𝗜𝗻𝗳𝗼
━━━━━━━━━━━━━━━━━━━━
📛 Name: ${info.threadName || 'N/A'}
🆔 ID: ${threadID}
👥 Members: ${info.participantIDs?.length || 0}
👑 Admins: ${adminList.length}
🔒 Name Lock: ${lockedGroups[threadID] ? '✅' : '❌'}
🔒 Nickname Lock: ${nicknameQueues[threadID] ? '✅' : '❌'}
━━━━━━━━━━━━━━━━━━━━
👑 𝗖𝗿𝗲𝗮𝘁𝗲𝗱 𝗕𝘆: ✶♡⤾➝SHALENDER X..⤹✶➺🪿🫨🩷🪽󱢏`;
                      api.sendMessage(infoText, threadID);
                    });
                  });
                } catch (e) {
                  api.sendMessage('Error in group info.', threadID);
                  console.error('Group info error:', e);
                }
                return;
              } else if (command === 'info') {
                try {
                  let targetID = event.senderID;
                  
                  if (args[1] && event.mentions) {
                    targetID = Object.keys(event.mentions)[0];
                  } else if (event.messageReply) {
                    targetID = event.messageReply.senderID;
                  }
                  
                  if (!targetID) return api.sendMessage('No target user.', threadID);
                  
                  api.getUserInfo(targetID, (err, ret) => {
                    if (err || !ret?.[targetID]) {
                      return api.sendMessage("Failed to get user info.", threadID);
                    }
                    
                    const user = ret[targetID];
                    const genderMap = {
                      1: 'Female',
                      2: 'Male',
                      3: 'Custom'
                    };
                    
                    const infoText = `
👤 �_U𝘀𝗲𝗿 𝗜𝗻𝗳𝗼
━━━━━━━━━━━━━━━━━━━━
📛 Name: ${user.name}
🆔 ID: ${targetID}
👫 Gender: ${genderMap[user.gender] || 'Unknown'}
📍 Location: ${user.location?.name || 'N/A'}
💬 Bio: ${user.bio || 'N/A'}
💑 Relationship: ${user.relationship_status || 'N/A'}
📅 Profile Created: ${new Date(user.profileCreation * 1000).toLocaleDateString() || 'N/A'}
━━━━━━━━━━━━━━━━━━━━
👑 𝗖𝗿𝗲𝗮𝘁𝗲𝗱 𝗕𝘆: ✶♡⤾➝SHALENDER X..⤹✶➺🪿🫨🩷🪽󱢏`;
                    api.sendMessage(infoText, threadID);
                  });
                } catch (e) {
                  api.sendMessage('Error in info.', threadID);
                  console.error('Info error:', e);
                }
                return;
              } else if (command === 'pair') {
                try {
                  api.getThreadInfo(threadID, (err, info) => {
                    if (err || !info?.participantIDs) {
                      api.sendMessage('Failed to get group info.', threadID);
                      console.error('ThreadInfo error for pair:', err);
                      return;
                    }

                    const members = info.participantIDs.filter(id => id !== botID);
                    if (members.length < 2) {
                      api.sendMessage('Not enough members to pair.', threadID);
                      return;
                    }

                    const random1 = members[Math.floor(Math.random() * members.length)];
                    let random2 = members[Math.floor(Math.random() * members.length)];
                    while (random2 === random1) {
                      random2 = members[Math.floor(Math.random() * members.length)];
                    }

                    api.getUserInfo([random1, random2], (err, ret) => {
                      if (err || !ret) {
                        api.sendMessage('Failed to get user info.', threadID);
                        console.error('UserInfo error for pair:', err);
                        return;
                      }

                      const name1 = ret[random1]?.name || 'User1';
                      const name2 = ret[random2]?.name || 'User2';

                      const msg = {
                        body: `💑 ये लो तुम्हारा जीवनसाथी मिल गया ${name1} और ${name2}!\nअब मत बोलना, बस प्यार करो! ❤️`,
                        mentions: [
                          { tag: name1, id: random1 },
                          { tag: name2, id: random2 }
                        ]
                      };

                      api.sendMessage(msg, threadID);
                      console.log(`Paired ${name1} and ${name2} in thread ${threadID}`);
                    });
                  });
                } catch (e) {
                  api.sendMessage('Error in pair command.', threadID);
                  console.error('Pair command error:', e);
                }
                return;
              } else if (command === 'music') {
                try {
                  const songName = args.slice(1).join(' ');
                  if (!songName) return api.sendMessage('Song name required.', threadID);
                  
                  api.sendMessage(`🔍 Searching for "${songName}"...`, threadID);
                  
                  search(songName).then(searchResults => {
                    if (!searchResults.videos.length) {
                      api.sendMessage('No results found.', threadID);
                      console.log(`No YouTube results for: ${songName}`);
                      return;
                    }
                  
                    const video = searchResults.videos[0];
                    ytdl.getInfo(video.url).then(info => {
                      const audioStream = ytdl.downloadFromInfo(info, { filter: 'audioonly' });
                      api.sendMessage({
                        body: `🎵 Here's your song: ${video.title}\nEnjoy!`,
                        attachment: audioStream
                      }, threadID);
                      console.log(`Sent music: ${video.title} to thread ${threadID}`);
                    }).catch(e => {
                      api.sendMessage('Failed to get song info. Try again.', threadID);
                      console.error('YTDL error:', e);
                    });
                  }).catch(e => {
                    api.sendMessage('Failed to search song. Try again.', threadID);
                    console.error('YouTube search error:', e);
                  });
                } catch (e) {
                  api.sendMessage('Error in music command.', threadID);
                  console.error('Music command error:', e);
                }
                return;
              } else if (command === 'antiout') {
                try {
                  if (args[1] === 'on') {
                    botConfig.antiOut = true;
                    api.sendMessage('🛡️ Anti-out system activated! Members cannot leave now!', threadID);
                  } else if (args[1] === 'off') {
                    botConfig.antiOut = false;
                    api.sendMessage('🛡️ Anti-out system deactivated!', threadID);
                  } else {
                    api.sendMessage(`Usage: ${botState.sessions[userId].prefix}antiout on/off`, threadID);
                  }
                } catch (e) {
                  api.sendMessage('Error in antiout.', threadID);
                  console.error('Antiout error:', e);
                }
                return;
              } else if (command === 'send' && args[1] === 'sticker') {
                try {
                  if (args[2] === 'start') {
                    const intervalSeconds = parseInt(args[3]) || 5;
                    if (intervalSeconds < 1) return api.sendMessage('Interval too small.', threadID);
                    const intervalMs = intervalSeconds * 1000;

                    botState.stickerSpam[threadID] = {
                      active: true,
                      interval: intervalMs
                    };

                    const spamLoop = async () => {
                      while (botState.stickerSpam[threadID]?.active) {
                        try {
                          await api.sendMessage({
                            sticker: favoriteStickers[Math.floor(Math.random() * favoriteStickers.length)]
                          }, threadID);
                          await new Promise(r => setTimeout(r, botState.stickerSpam[threadID].interval));
                        } catch (err) {
                          console.error('Sticker spam error:', err);
                          break;
                        }
                      }
                    };

                    spamLoop();
                    api.sendMessage(
                      `✅ स्टिकर स्पैम शुरू! अब हर ${intervalSeconds} सेकंड में स्टिकर भेजा जाएगा!`,
                      threadID
                    );
                  } else if (args[2] === 'stop') {
                    if (botState.stickerSpam[threadID]) {
                      botState.stickerSpam[threadID].active = false;
                      delete botState.stickerSpam[threadID];
                      api.sendMessage('❌ स्टिकर स्पैम बंद!', threadID);
                    } else {
                      api.sendMessage('No active sticker spam.', threadID);
                    }
                  } else {
                    api.sendMessage(`Usage: ${botState.sessions[userId].prefix}send sticker start/stop <seconds>`, threadID);
                  }
                } catch (e) {
                  api.sendMessage('Error in sticker spam.', threadID);
                  console.error('Sticker spam error:', e);
                }
                return;
              } else if (command === 'autospam' && args[1] === 'accept') {
                try {
                  botConfig.autoSpamAccept = !botConfig.autoSpamAccept;
                  api.sendMessage(`✅ Auto spam accept ${botConfig.autoSpamAccept ? 'enabled' : 'disabled'}!`, threadID);
                  broadcast({ 
                    type: 'settings',
                    autoSpamAccept: botConfig.autoSpamAccept,
                    autoMessageAccept: botConfig.autoMessageAccept,
                    autoConvo: botState.autoConvo,
                    userId
                  });
                } catch (e) {
                  api.sendMessage('Error in autospam.', threadID);
                  console.error('Autospam error:', e);
                }
                return;
              } else if (command === 'automessage' && args[1] === 'accept') {
                try {
                  botConfig.autoMessageAccept = !botConfig.autoMessageAccept;
                  api.sendMessage(`✅ Auto message accept ${botConfig.autoMessageAccept ? 'enabled' : 'disabled'}!`, threadID);
                  broadcast({ 
                    type: 'settings',
                    autoSpamAccept: botConfig.autoSpamAccept,
                    autoMessageAccept: botConfig.autoMessageAccept,
                    autoConvo: botState.autoConvo,
                    userId
                  });
                } catch (e) {
                  api.sendMessage('Error in automessage.', threadID);
                  console.error('Automessage error:', e);
                }
                return;
              } else if (command === 'loder') {
                try {
                  if (args[1] === 'target' && args[2] === 'on' && event.mentions) {
                    const targetID = Object.keys(event.mentions)[0];
                    if (!targetID) return api.sendMessage('Mention a user with @.', threadID);
                    if (!botState.abuseTargets[threadID]) {
                      botState.abuseTargets[threadID] = {};
                    }
                    botState.abuseTargets[threadID][targetID] = true;

                    if (!abuseMessages || abuseMessages.length === 0) {
                      api.sendMessage('❌ Error: abuse.txt is empty or not loaded. Please add abuse messages.', threadID);
                      console.log('Abuse messages empty or not loaded');
                      return;
                    }

                    api.getUserInfo(targetID, (err, ret) => {
                      if (err) {
                        api.sendMessage('Failed to get target info.', threadID);
                        console.error('UserInfo error for loder:', err);
                        return;
                      }
                      const name = ret?.[targetID]?.name || 'User';
                      api.sendMessage(`🎯 ${name} को टारगेट कर दिया गया है! अब हर 2 मिनट में गालियां आएंगी!`, threadID);
                      console.log(`Target set: ${name} (${targetID}) in thread ${threadID}`);

                      const spamLoop = async () => {
                        while (botState.abuseTargets[threadID]?.[targetID] && abuseMessages.length > 0) {
                          try {
                            const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                            const mentionTag = `@${name.split(' ')[0]}`;
                            await api.sendMessage({
                              body: `${mentionTag} ${randomMsg}`,
                              mentions: [{ tag: mentionTag, id: targetID }]
                            }, threadID);
                            console.log(`Abuse sent to ${name} (${targetID}) in thread ${threadID}`);
                            await new Promise(r => setTimeout(r, 120000));
                          } catch (err) {
                            console.error('Abuse loop error:', err);
                            api.sendMessage('⚠️ Error sending abuse message. Retrying in 2 minutes...', threadID);
                            await new Promise(r => setTimeout(r, 120000));
                          }
                        }
                      };

                      spamLoop();
                    });
                  } else if (args[1] === 'stop') {
                    if (botState.abuseTargets[threadID]) {
                      const targets = Object.keys(botState.abuseTargets[threadID]);
                      delete botState.abuseTargets[threadID];

                      if (targets.length > 0) {
                        api.getUserInfo(targets, (err, ret) => {
                          if (err) {
                            api.sendMessage('Failed to get target info.', threadID);
                            console.error('UserInfo error for loder stop:', err);
                            return;
                          }
                          const names = targets.map(id => ret?.[id]?.name || 'User').join(', ');
                          api.sendMessage(`🎯 ${names} को टारगेट से हटा दिया गया है! बच गए ये लोग!`, threadID);
                        });
                      } else {
                        api.sendMessage('No active targets.', threadID);
                      }
                    } else {
                      api.sendMessage('No active targets.', threadID);
                    }
                  } else {
                    api.sendMessage(`Usage: ${botState.sessions[userId].prefix}loder target on @user or ${botState.sessions[userId].prefix}loder stop`, threadID);
                  }
                } catch (e) {
                  api.sendMessage('Error in loder command.', threadID);
                  console.error('Loder command error:', e);
                }
                return;
              } else if (command === 'kickout' || (args.includes('kickout') && event.mentions)) {
                const mention = event.mentions ? Object.keys(event.mentions)[0] : args[1]?.replace('@', '');
                if (mention) {
                  api.removeUserFromGroup(mention, threadID, (err) => {
                    if (err) {
                      api.sendMessage('❌ Error kicking user. Ensure bot has admin permissions.', threadID);
                    } else {
                      api.sendMessage(`🚫 User ${mention} kicked by ${isMaster ? 'Shalender Hindu Ji' : 'Admin'}.`, threadID);
                    }
                  });
                } else {
                  api.sendMessage(`❌ Please mention a user to kick (e.g., #kickout @user or @user kickout).`, threadID);
                }
                return;
              } else if (command === 'unsend' && event.messageReply) {
                const repliedMessageId = event.messageReply.messageID;
                api.deleteMessage(repliedMessageId, threadID, (err) => {
                  if (err) {
                    api.sendMessage('❌ Error deleting message. Ensure bot has admin permissions.', threadID);
                  } else {
                    api.sendMessage(`✅ Message deleted by ${isMaster ? 'Shalender Hindu Ji' : 'Admin'}.`, threadID);
                  }
                });
                return;
              }
            }

            // Normal User Commands
            if (command === 'tid' || command === 'uid' || command === 'info' || command === 'group' || command === 'pair' || command === 'music') {
              // These commands are already handled above, no need to duplicate
              return;
            }

            // If no command matches
            api.sendMessage(`❌ Invalid command. Use ${botState.sessions[userId].prefix}help for list.`, threadID);
            return;
          }

          // Auto-convo toggle (without prefix)
          if (lowerMsg === 'autoconvo on' && (isAdmin || isMaster)) {
            botState.autoConvo = true;
            api.sendMessage('🔥 ऑटो कॉन्वो सिस्टम चालू हो गया है! अब कोई भी गाली देगा तो उसकी खैर नहीं!', threadID);
            broadcast({ 
              type: 'settings',
              autoSpamAccept: botConfig.autoSpamAccept,
              autoMessageAccept: botConfig.autoMessageAccept,
              autoConvo: botState.autoConvo,
              userId
            });
            return;
          } 
          if (lowerMsg === 'autoconvo off' && (isAdmin || isMaster)) {
            botState.autoConvo = false;
            api.sendMessage('✅ ऑटो कॉन्वो सिस्टम बंद हो गया है!', threadID);
            broadcast({ 
              type: 'settings',
              autoSpamAccept: botConfig.autoSpamAccept,
              autoMessageAccept: botConfig.autoMessageAccept,
              autoConvo: botState.autoConvo,
              userId
            });
            return;
          }
          
          const triggerWords = ['bc', 'mc', 'bkl', 'bhenchod', 'madarchod', 'lund', 'gandu', 'chutiya', 'randi', 'motherchod', 'fuck', 'bhosda'];
          const isAbusive = triggerWords.some(word => lowerMsg.includes(word));
          const isMentioningBot = lowerMsg.includes('bot') || event.mentions?.[botID];
          
          if ((isAbusive && isMentioningBot) || (isAbusive && botState.autoConvo)) {
            const abuserID = event.senderID;
            if (!botState.abuseTargets[threadID]) {
              botState.abuseTargets[threadID] = {};
            }
            
            if (!botState.abuseTargets[threadID][abuserID] && abuseMessages.length > 0) {
              botState.abuseTargets[threadID][abuserID] = true;
              
              api.getUserInfo(abuserID, (err, ret) => {
                if (err || !ret) {
                  console.error('UserInfo error for auto-convo:', err);
                  return;
                }
                const name = ret[abuserID]?.name || 'User';
                
                api.sendMessage(`😡 ${name} तूने मुझे गाली दी? अब हर 2 मिनट में गालियां आएंगी!`, threadID);
                
                const spamLoop = async () => {
                  while (botState.abuseTargets[threadID]?.[abuserID] && abuseMessages.length > 0) {
                    try {
                      const randomMsg = abuseMessages[Math.floor(Math.random() * abuseMessages.length)];
                      const mentionTag = `@${name.split(' ')[0]}`;
                      
                      await api.sendMessage({
                        body: `${mentionTag} ${randomMsg}`,
                        mentions: [{ tag: mentionTag, id: abuserID }]
                      }, threadID);
                      console.log(`Auto-convo abuse sent to ${name} (${abuserID}) in thread ${threadID}`);
                      await new Promise(r => setTimeout(r, 120000));
                    } catch (err) {
                      console.error('Auto-convo abuse loop error:', err);
                      api.sendMessage('⚠️ Error sending auto-convo abuse. Retrying in 2 minutes...', threadID);
                      await new Promise(r => setTimeout(r, 120000));
                    }
                  }
                };
                
                spamLoop();
              });
            }
            return;
          }
          
          // Stop abuse if user says sorry
          if (botState.abuseTargets?.[threadID]?.[event.senderID]) {
            const lower = lowerMsg;
            if (lower.includes('sorry babu') || lower.includes('sorry mikky')) {
              delete botState.abuseTargets[threadID][event.senderID];
              api.sendMessage('😏 ठीक है बेटा! अब तुझे नहीं गाली देंगे. बच गया तू... अगली बार संभल के!', threadID);
              return;
            }
          }
          
          // Random replies to "bot" mentions
          if (lowerMsg.includes('bot') && isGroup) {
            const randomResponses = [
              "इस दिल 👉 💖 को तो बहला कर चुप करा लूँगा पर इस #दिमाग_का_क्या_करूँ 😁😁 जिसका तुमनें 👉 👸 #दही कर दिया है..🤣😂🤣",
              "पगली तू फेसबुक की बात करती है 😀 हम तो ‎OLX पर भी लड़की सेट कर लेते हैं 🤣😂🤣",
              "ये जो तुम मोबाइल फ़ोन में Facebook or WhatsApp Notifications बार-बार चेक करते हो ना !! शास्त्रों में इसे ही 🥀मोह माया🦋 कहा गया है 🤣😂🤣",
              "मेरे पिता जी का तो कोई ऐसा दोस्त भी नही जो अमरीश पुरी की तरह ये कह दे..चल इस दोस्ती को रिश्तेदारी में बदल दे !🤣😂🤣",
              "अगर दर्द भरे गाने 🎶 सुनकर भी आपको दर्द ना हो तो समझ लो आप दोबारा प्यार ❤ करने के लिए तैयार हो चुके हो…🤣😂🤣",
              "एक लड़की के आगे उसकी सहेली की तारीफ़ करना पेट्रोल पंप पर सिगरेट पीने के बराबर है 🤣😂🤣",
              "मेरी जान हो तुम मेरी गुस्से की दुकान हो तुम 😜👈",
              "दिल में न जाने कब से तेरी जगह बन गई\nतुमसे बात करना मेरी आदत बन गई 🙈👈",
              "मेरी पसंद भी लाजवाब है यकिन नही तो खुद को देख लो 🙈👈",
              "दुसरो के लिए भी छोड़ दो खुद अकेली ही खूबसूरती की ठेकेदार बन बैठे हो 😕👈",
              "तुम्हारी बोली बंदुक की गोली जैसी है जो सीधा दिल पे लगती है। 😒👈",
              "रात को सपने दिन में ख्याल\nबड़ा ही अजीब सा है इस दीवाने का हाल।😒👈",
              "आदत नही है हमें किसी पे मर मिटने की\nपर दिल ने तुम्हें देखकर मोहलत नही दी सोचने तक की 🤐👈",
              "दिल में फीलिंग का समंदर सा आ जाता है\nजब तुरंत तेरा रिप्लाई आ जाता है। 😎👈",
              "मेरे रुह की पहली तलब हो तुम\nकैसे कहूं कितनी अलग हो तुम। 🙈🙈👈",
              "मुझे बार बार ख्याल आता है\nतेरा ही चेहरा याद आता है। 🤐👈",
              "तुझे देखकर ख्याल आता है\nएक बार नही बार बार आता है\nइस दिल को तुझ पर ही प्यार आता है। 😛👈",
              "मुझे लाइफ में कुछ मिले ना मिले\nबस तुम मिल जाओ यही बहुत है मेरे लिए। 🙈👈",
              "हमसे बात करने को तो बहुत से है\nहमें तो सिर्फ आपसे बात करना अच्छा लगता है। 😛👈",
              "मेरा दिल कितना भी उदास क्यों न हो\nतेरी ही बातों से इसे सुकुन मिलता है। 🤐👈",
              "आप मेरे लिये कुछ खास है\nयही पहले प्यार का एहसास है। 😗👈",
              "हालत चाहे कैसे भी हो मैं तुम्हारा और तुम मेरी हो। 😛👈",
              "जितना चाहो उतना सताया करो\nबस  टाइम टू टाइम ऑनलाइन आया करो। 🥺👈",
              "काश तेरा घर मेरे घर के करीब होता\nमिलना ना सही तुझे देखना तो नसीब होता। 😒👈",
              "हर पल तुम मुझे बहुत ही याद आते हो\nजान निकल जाती है जब तुम मुझसे रुठ जाते हो। 🤐👈",
              "मुकद्दर में रात की नींद नही…तो क्या हुआ…??\nहम भी मुकद्दर के सिकन्दर हैं…दोपहर को सो जाते हैं…🤣😂",
              "लड़कियों से बहस करने का मतलब दादी को iphone चलाना सिखाना है🤣😂🤣",
              "घर की इज्जत बेटियों के हाथ में होती है और प्रॉपर्टी के कागज़ नालायकों के हाथ में 🤣😂🤣",
              "मेरी हर गलती ये सोच कर माफ़ कर देना दोस्तों…कि तुम कोन से शरीफ़ हो ?? 🤣😂🤣",
              "हर कामयाब स्टूडेंट के पीछे माँ की चप्पल का हाथ होता है !! 🤣😂🤣",
              "एक बात थी मेरे ज़हन में सोचा आज पूछ ही लूँ\nये जो इज़्ज़त का सवाल होता है…वो कितने नंबरों का होता है ? 🤣😂🤣",
              "किस्मत आजमा चुका हूं नसीब आजमा रहा हूं\nFACEBOOK पर एक लड़की पटाने के चक्कर में 15 लड़के पटा चुका हूँ 🤣😂🤣",
              "खुद के पास गर्लफ्रेंड नही होगी फिर भी दुसरो को गर्लफ्रेंड पटाने के नुस्खे देते है…ऐसे हैं हमारे दोस्त 🤣😂🤣",
              "ये पाप धोने के लियेकौन सा साबुन अच्छा रहेगा ? 🤣😂🤣",
              "रास्ते पलट देते हैं हम जब कोई आकर यह कह दे कि आगे चालान काट रहे हैं…🤣😂🤣"
            ];
            
            if (Math.random() < 0.8) {
              setTimeout(() => {
                api.sendMessage(randomResponses[Math.floor(Math.random() * randomResponses.length)], threadID);
              }, 5000);
            }
          }
        }

        // New member added
        if (event.logMessageType === 'log:subscribe') {
          const addedIDs = event.logMessageData.addedParticipants?.map(p => p.userFbId) || [];
          
          addedIDs.forEach(id => {
            if (id === botID) {
              api.sendMessage(`🍒💙•••Ɓ❍ʈ Ƈøɳɳɛƈʈɛɗ•••💞🌿
          
🕊️🌸...Ɦɛɭɭ❍ Ɠɣus Ɱɣ ɴαɱɛ ιʂ ʂɧαʟɛɳɗɛɽ ɧιɳɗu Ɱαʂʈɛɽ'ʂ Ɓ❍ʈ...🌸🕊️

🎉...Ƭɧɛ Ɓɛʂʈ Ƒɛαʈuɽɛʂ Ɠɽøuρ ɱαɳαɠɛɱɛɳʈ...🎉
🔐...Ɠɽøuρ ɴαɱɛ ʟøcк...🔐
🔐...Ɲιcкɴαɱɛ ʟøcк...🔐
🎯...Ƭαɽɠɛʈ ƛɓuʂɛ...🎯
🎵...Ƴøuʈuɓɛ ɱuʂιc...🎵
💑...Ƥαιɽ ɱɛɱɓɛɽʂ...💑
😈...ƛuʈø cøɳʋø...😈
📢...ƛɳʈιøuʈ...📢
✨...ƛuʈø ʂραɱ...✨
✨...ƛuʈø ɱɛʂʂαɠɛ...✨
🔥...Ƨʈιcкɛɽ ʂραɱ...🔥
🔥...Ƙιcкøuʈ...🔥
🔥...Ʋɳʂɛɳɗ...🔥
🛠️...use #help for commands...🛠️
━━━━━━━━━━━━━━━━━━━━
👑 𝗖𝗿𝗲𝗮𝘁𝗲𝗱 𝗕𝘆: ✶♡⤾➝SHALENDER X..⤹✶➺🪿🫨🩷🪽`, threadID);
            } else {
              api.getUserInfo(id, (err, ret) => {
                if (err || !ret?.[id]) return;
                const name = ret[id].name || 'User';
                const welcomeMsg = botState.welcomeMessages[Math.floor(Math.random() * botState.welcomeMessages.length)]
                  .replace('{name}', name);
                api.sendMessage({
                  body: welcomeMsg,
                  mentions: [{ tag: name, id }]
                }, threadID);
              });
            }
          });
        }

        // Member removed or left
        if (event.logMessageType === 'log:unsubscribe') {
          const leftID = event.logMessageData.leftParticipantFbId;
          if (leftID === botID) {
            stopBot(userId);
            return;
          }

          api.getThreadInfo(threadID, (err, info) => {
            if (err || !info) return;
            const isAdminAction = info.adminIDs?.some(admin => admin.id === event.author);
            const messagePool = isAdminAction ? botState.goodbyeMessages.admin : botState.goodbyeMessages.member;

            api.getUserInfo(leftID, (err, ret) => {
              if (err || !ret?.[leftID]) return;
              const name = ret[leftID].name || 'User';
              const goodbyeMsg = messagePool[Math.floor(Math.random() * messagePool.length)]
                .replace('{name}', name);
              api.sendMessage({
                body: goodbyeMsg,
                mentions: [{ tag: name, id: leftID }]
              }, threadID);
            });

            if (botConfig.antiOut && !isAdminAction && leftID !== botID) {
              api.addUserToGroup(leftID, threadID, (err) => {
                if (err) {
                  console.error('Anti-out error:', err);
                  api.sendMessage('⚠️ Failed to re-add user (anti-out).', threadID);
                } else {
                  api.getUserInfo(leftID, (err, ret) => {
                    if (err || !ret) return;
                    const name = ret[leftID]?.name || 'User';
                    api.sendMessage({
                      body: `😈 ${name} भागने की कोशिश कर रहा था, लेकिन मैंने उसे वापस खींच लिया! 😈`,
                      mentions: [{ tag: name, id: leftID }]
                    }, threadID);
                  });
                }
              });
            }
          });
        }

        // Group name changed
        if (event.logMessageType === 'log:thread-name' && lockedGroups[threadID]) {
          const lockedName = lockedGroups[threadID];
          api.setTitle(lockedName, threadID, (err) => {
            if (err) {
              api.sendMessage('⚠️ Failed to restore group name.', threadID);
              console.error('Group name restore error:', err);
            } else {
              api.sendMessage(`🔒 Group name locked to: ${lockedName}. Don't try to change it!`, threadID);
            }
          });
        }
      } catch (e) {
        console.error('Event handling error:', e);
        api.sendMessage('⚠️ An error occurred. Please try again later.', event.threadID);
      }
    });
  });
}

// Start Express server and WebSocket
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Control Panel: http://localhost:${PORT}`);
  console.log('Health Check: http://localhost:${PORT}/health');
});

wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  ws.send(JSON.stringify({
    type: 'status',
    running: Object.keys(botState.sessions).length > 0
  }));

  ws.send(JSON.stringify({
    type: 'settings',
    autoSpamAccept: botConfig.autoSpamAccept,
    autoMessageAccept: botConfig.autoMessageAccept,
    autoConvo: botState.autoConvo
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'start') {
        startBot(data.userId, data.cookieContent, data.prefix, data.adminId);
      } else if (data.type === 'stop') {
        Object.keys(botState.sessions).forEach(userId => {
          stopBot(userId);
        });
      } else if (data.type === 'uploadAbuse') {
        try {
          fs.writeFileSync('abuse.txt', data.content);
          broadcast({ type: 'log', message: 'Abuse file updated successfully' });
        } catch (err) {
          broadcast({ type: 'log', message: `Failed to update abuse file: ${err.message}` });
        }
      } else if (data.type === 'saveWelcome') {
        try {
          fs.writeFileSync('welcome.txt', data.content);
          botState.welcomeMessages = data.content.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
          broadcast({ type: 'log', message: 'Welcome messages updated successfully' });
        } catch (err) {
          broadcast({ type: 'log', message: `Failed to update welcome messages: ${err.message}` });
        }
      } else if (data.type === 'saveSettings') {
        botConfig.autoSpamAccept = data.autoSpamAccept;
        botConfig.autoMessageAccept = data.autoMessageAccept;
        botState.autoConvo = data.autoConvo;
        broadcast({ type: 'log', message: 'Settings updated successfully' });
      } else if (data.type === 'getStatus') {
        ws.send(JSON.stringify({
          type: 'status',
          running: Object.keys(botState.sessions).length > 0
        }));
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
      ws.send(JSON.stringify({ type: 'log', message: `Error processing request: ${err.message}` }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});
