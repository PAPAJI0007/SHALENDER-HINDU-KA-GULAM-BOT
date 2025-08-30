module.exports = {
  name: 'nicknamelock',
  async execute({ api, event, args, botSettings, broadcastLog }) {
    if (args[0] === 'on' && args[1]) {
      botSettings.nicknameLock = true;
      botSettings.lockedNickname = args.slice(1).join(' ');
      api.getThreadInfo(event.threadID, (err, info) => {
        if (err) return;
        info.participantIDs.forEach(id => {
          api.changeNickname(botSettings.lockedNickname, id, event.threadID);
        });
        api.sendMessageMqtt(`Nickname locked to: ${botSettings.lockedNickname}`, event.threadID, event.messageID);
        broadcastLog(`Locked nicknames to: ${botSettings.lockedNickname}`);
      });
    } else if (args[0] === 'off') {
      botSettings.nicknameLock = false;
      botSettings.lockedNickname = '';
      api.sendMessageMqtt('Nickname lock disabled', event.threadID, event.messageID);
      broadcastLog('Nickname lock disabled');
    } else {
      api.sendMessageMqtt('Usage: !nicknamelock on/off <nickname>', event.threadID, event.messageID);
    }
  }
};
