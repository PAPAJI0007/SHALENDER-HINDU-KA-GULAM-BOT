module.exports = {
  name: 'autospam',
  async execute({ api, event, args, botSettings, broadcastLog }) {
    if (args[0] === 'accept') {
      botSettings.autoSpamAccept = true;
      api.sendMessageMqtt('Auto spam accept enabled.', event.threadID, event.messageID);
      broadcastLog('Auto spam accept enabled');
    } else {
      api.sendMessageMqtt('Usage: !autospam accept', event.threadID, event.messageID);
    }
  }
};
