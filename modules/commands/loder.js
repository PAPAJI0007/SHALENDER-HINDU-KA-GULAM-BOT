module.exports = {
  name: 'loder',
  async execute({ api, event, args, botSettings, broadcastLog }) {
    if (args[0] === 'target' && args[1] === 'on' && args[2] && event.mentions && Object.keys(event.mentions).length > 0) {
      const time = parseInt(args[2]);
      const userId = Object.keys(event.mentions)[0];
      botSettings.loderTarget = { userId, time };
      api.sendMessageMqtt(`Targeting user ${userId} for ${time} seconds.`, event.threadID, event.messageID);
      broadcastLog(`Targeting user ${userId} for ${time} seconds`);
    } else if (args[0] === 'stop') {
      botSettings.loderTarget = null;
      api.sendMessageMqtt('Targeting stopped.', event.threadID, event.messageID);
      broadcastLog('Targeting stopped');
    } else {
      api.sendMessageMqtt('Usage: !loder target on <time> @user | !loder stop', event.threadID, event.messageID);
    }
  }
};
