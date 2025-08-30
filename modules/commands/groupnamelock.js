module.exports = {
  name: 'groupnamelock',
  async execute({ api, event, args, botSettings, broadcastLog }) {
    if (args[0] === 'on' && args[1]) {
      botSettings.groupNameLock = true;
      botSettings.lockedGroupName = args.slice(1).join(' ');
      api.setTitle(botSettings.lockedGroupName, event.threadID);
      api.sendMessageMqtt(`Group name locked to: ${botSettings.lockedGroupName}`, event.threadID, event.messageID);
      broadcastLog(`Locked group name to: ${botSettings.lockedGroupName}`);
    } else if (args[0] === 'off') {
      botSettings.groupNameLock = false;
      botSettings.lockedGroupName = '';
      api.sendMessageMqtt('Group name lock disabled', event.threadID, event.messageID);
      broadcastLog('Group name lock disabled');
    } else {
      api.sendMessageMqtt('Usage: !groupnamelock on/off <name>', event.threadID, event.messageID);
    }
  }
};
