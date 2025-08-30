const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'music',
  async execute({ api, event, args, broadcastLog }) {
    if (!args[0]) {
      api.sendMessageMqtt('Usage: !music <song name>', event.threadID, event.messageID);
      return;
    }
    const songName = args.join(' ');
    api.sendMessageMqtt(`Searching for "${songName}"...`, event.threadID, event.messageID);
    try {
      // नोट: यह एक डमी इम्प्लीमेंटेशन है। असल में यूट्यूब API या सर्च मकैनिज्म की जरूरत होगी।
      const videoUrl = `https://www.youtube.com/watch?v=example`; // यूट्यूब API से वीडियो URL लें
      const stream = ytdl(videoUrl, { filter: 'audioonly' });
      const filePath = path.join(__dirname, `${songName}.mp3`);
      stream.pipe(fs.createWriteStream(filePath));
      stream.on('end', () => {
        api.sendMessageMqtt({
          body: `Downloaded "${songName}"`,
          attachment: fs.createReadStream(filePath)
        }, event.threadID, event.messageID, () => {
          fs.unlinkSync(filePath); // डाउनलोड के बाद फाइल डिलीट करें
        });
        broadcastLog(`Downloaded and sent music: ${songName}`);
      });
    } catch (error) {
      api.sendMessageMqtt(`Error downloading music: ${error.message}`, event.threadID, event.messageID);
      broadcastLog(`Music download error: ${error.message}`, 'error');
    }
  }
};
