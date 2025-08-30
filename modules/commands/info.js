module.exports = {
  name: 'info',
  async execute({ api, event, broadcastLog }) {
    if (event.mentions && Object.keys(event.mentions).length > 0) {
      const userId = Object.keys(event.mentions)[0];
      api.getUserInfo([userId], (err, users) => {
        if (err) {
          api.sendMessageMqtt('Failed to fetch user info.', event.threadID, event.messageID);
          return;
        }
        const user = users[userId];
        const message = `Name: ${user.name}\nID: ${userId}\nProfile URL: ${user.profileUrl}`;
        api.sendMessageMqtt(message, event.threadID, event.messageID);
        broadcastLog(`Displayed info for user: ${userId}`);
      });
    } else {
      api.sendMessageMqtt('Please mention a user.', event.threadID, event.messageID);
    }
  }
};
