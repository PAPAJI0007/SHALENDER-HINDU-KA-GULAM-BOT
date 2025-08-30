module.exports = {
  name: 'groupinfo',
  async execute({ api, event, broadcastLog }) {
    api.getThreadInfo(event.threadID, (err, info) => {
      if (err) {
        api.sendMessageMqtt('Failed to fetch group info.', event.threadID, event.messageID);
        return;
      }
      const message = `Group Name: ${info.threadName}\nID: ${event.threadID}\nMembers: ${info.participantIDs.length}`;
      api.sendMessageMqtt(message, event.threadID, event.messageID);
      broadcastLog(`Displayed group info for thread: ${event.threadID}`);
    });
  }
};
