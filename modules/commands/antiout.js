module.exports = {
  name: 'antiout',
  async execute({ api, event, args, botSettings, broadcastLog }) {
    if (args[0] === 'on') {
      botSettings.antiout = true;
      api.sendMessageMqtt('Anti-out enabled.', event.threadID, event.messageID);
      broadcastLog('Anti-out enabled');
    } else if (args[0] === 'off') {
      botSettings.antiout = false;
      api.sendMessageMqtt('Anti-out disabled.', event.threadID, event.messageID);
      broadcastLog('Anti-out disabled');
    } else {
      api.sendMessageMqtt('Usage: !antiout on/off', event.threadID, event.messageID);
    }
  }
};
