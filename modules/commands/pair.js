module.exports = {
  name: 'pair',
  async execute({ api, event, broadcastLog }) {
    api.getThreadInfo(event.threadID, (err, info) => {
      if (err) {
        api.sendMessageMqtt('Failed to fetch group info.', event.threadID, event.messageID);
        return;
      }
      const members = info.participantIDs;
      if (members.length < 2) {
        api.sendMessageMqtt('Not enough members to pair.', event.threadID, event.messageID);
        return;
      }
      const random1 = members[Math.floor(Math.random() * members.length)];
      let random2 = members[Math.floor(Math.random() * members.length)];
      while (random2 === random1) {
        random2 = members[Math.floor(Math.random() * members.length)];
      }
      api.getUserInfo([random1, random2], (err, users) => {
        if (err) {
          api.sendMessageMqtt('Failed to fetch user info.', event.threadID, event.messageID);
          return;
        }
        const message = `Paired: ${users[random1].name} ❤️ ${users[random2].name}`;
        api.sendMessageMqtt(message, event.threadID, event.messageID);
        broadcastLog(`Paired users: ${random1} and ${random2}`);
      });
    });
  }
};
