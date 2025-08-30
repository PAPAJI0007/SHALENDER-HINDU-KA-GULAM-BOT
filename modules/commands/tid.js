module.exports = {
  name: 'tid',
  async execute({ api, event, broadcastLog }) {
    api.sendMessageMqtt(`Group ID: ${event.threadID}`, event.threadID, event.messageID);
    broadcastLog(`Displayed thread ID: ${event.threadID}`);
  }
};
