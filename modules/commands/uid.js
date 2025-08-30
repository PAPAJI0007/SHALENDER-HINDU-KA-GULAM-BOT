module.exports = {
  name: 'uid',
  async execute({ api, event, args, broadcastLog }) {
    if (event.mentions && Object.keys(event.mentions).length > 0) {
      const userId = Object.keys(event.mentions)[0];
      api.sendMessageMqtt(`User ID: ${userId}`, event.threadID, event.messageID);
      broadcastLog(`Displayed user ID: ${userId}`);
    } else {
      api.sendMessageMqtt(`Your ID: ${event.senderID}`, event.threadID, event.messageID);
      broadcastLog(`Displayed sender ID: ${event.senderID}`);
    }
  }
};
