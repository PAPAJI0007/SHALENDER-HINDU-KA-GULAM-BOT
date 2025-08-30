module.exports = {
  name: 'send',
  async execute({ api, event, args, botSettings, broadcastLog }) {
    if (args[0] === 'sticker' && args[1] === 'start') {
      botSettings.stickerSpam = true;
      api.sendMessageMqtt('Sticker spam started.', event.threadID, event.messageID);
      broadcastLog('Sticker spam started');
    } else if (args[0] === 'sticker' && args[1] === 'stop') {
      botSettings.stickerSpam = false;
      api.sendMessageMqtt('Sticker spam stopped.', event.threadID, event.messageID);
      broadcastLog('Sticker spam stopped');
    } else {
      api.sendMessageMqtt('Usage: !send sticker start/stop', event.threadID, event.messageID);
    }
  }
};
