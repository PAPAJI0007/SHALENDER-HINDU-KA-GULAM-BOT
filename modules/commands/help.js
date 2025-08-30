module.exports = {
  name: 'help',
  async execute({ api, event, args, broadcastLog }) {
    const commands = [
      '!help - Show all commands',
      '!groupnamelock on/off <name> - Lock/unlock group name',
      '!nicknamelock on/off <nickname> - Lock/unlock all nicknames',
      '!tid - Get group ID',
      '!uid - Get your ID',
      '!uid @mention - Get mentioned user\'s ID',
      '!info @mention - Get user information',
      '!groupinfo - Get group information',
      '!antiout on/off - Toggle anti-out feature',
      '!send sticker start/stop - Sticker spam',
      '!autospam accept - Auto accept spam messages',
      '!automessage accept - Auto accept message requests',
      '!loder target on <time> @user - Target a user with timer',
      '!loder stop - Stop targeting',
      '!autoconvo on/off <time> - Toggle auto conversation with timer',
      '!pair - Pair two random group members',
      '!music <song name> - Download music from YouTube'
    ];
    const message = `Available Commands:\n${commands.join('\n')}`;
    api.sendMessageMqtt(message, event.threadID, event.messageID);
    broadcastLog(`Displayed help menu in thread ${event.threadID}`);
  }
};
