module.exports = {
  name: 'automessage',
  async execute({ api, event, args, botSettings, broadcastLog }) {
    if (args[0] === 'accept') {
      botSettings.autoMessageAccept = true;
      api.sendMessageMqtt('Auto message accept enabled.', event.threadID, event.messageID);
      broadcastLog('Auto message accept enabled');
    } else {
      api.sendMessageMqtt('Usage: !automessage accept', event.threadID, event.messageID);
    }
  }
};
