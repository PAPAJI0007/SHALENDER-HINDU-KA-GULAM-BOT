module.exports = {
  name: 'autoconvo',
  async execute({ api, event, args, botSettings, broadcastLog }) {
    if (args[0] === 'on' && args[1]) {
      const time = parseInt(args[1]);
      botSettings.autoconvo = true;
      api.sendMessageMqtt(`Auto conversation enabled for ${time} seconds.`, event.threadID, event.messageID);
      broadcastLog(`Auto conversation enabled for ${time} seconds`);
    } else if (args[0] === 'off') {
      botSettings.autoconvo = false;
      api.sendMessageMqtt('Auto conversation disabled.', event.threadID, event.messageID);
      broadcastLog('Auto conversation disabled');
    } else {
      api.sendMessageMqtt('Usage: !autoconvo on/off <time>', event.threadID, event.messageID);
    }
  }
};
