const assert = require('assert');
const { prepareMessage } = require('../prepare-message');

module.exports = ({
  sendMessageBatch,
  queues,
  steps,
  globalPool
}) => {
  const tasks = [];
  const addRaw = (msgs, queueUrl) => {
    tasks.push([msgs, queueUrl]);
  };
  return {
    addRaw,
    addStepMessages: (messages) => {
      messages.forEach((msg) => {
        const queueUrl = queues[steps[msg.name].queue];
        assert(queueUrl !== undefined);
        const groupIdFunction = steps[msg.name].groupIdFunction;
        if (groupIdFunction !== null) {
          prepareMessage(msg, {
            groupId: groupIdFunction(msg)
          });
        }
        const delay = steps[msg.name].delay;
        assert(delay !== undefined);
        if (delay !== 0) {
          prepareMessage(msg, { delaySeconds: steps[msg.name].delay });
        }
        addRaw([msg], queueUrl);
      });
    },
    flush: async (full = true) => {
      if (tasks.length === 0) {
        return;
      }
      const groups = {};
      tasks.splice(0).forEach(([msgs, queueUrl]) => {
        if (groups[queueUrl] === undefined) {
          groups[queueUrl] = [];
        }
        groups[queueUrl].push(...msgs);
      });
      const fns = Object.entries(groups)
        .map(([queueUrl, messages]) => () => sendMessageBatch({ queueUrl, messages }));
      await globalPool(fns);
    }
  };
};
