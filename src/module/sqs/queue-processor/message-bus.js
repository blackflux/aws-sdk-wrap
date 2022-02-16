const assert = require('assert');
const { prepareMessage, getUrgent } = require('../prepare-message');

const prepareGroupId = (msg, steps) => {
  const groupIdFunction = steps[msg.name].groupIdFunction;
  if (groupIdFunction !== null) {
    const groupId = groupIdFunction(msg);
    assert(typeof groupId === 'string', msg);
    prepareMessage(msg, { groupId });
  }
};

const prepareDeduplicationId = (msg, steps) => {
  const deduplicationIdFunction = steps[msg.name].deduplicationIdFunction;
  if (deduplicationIdFunction !== null) {
    const deduplicationId = deduplicationIdFunction(msg);
    assert(typeof deduplicationId === 'string', msg);
    prepareMessage(msg, { deduplicationId });
  }
};

const prepareDelay = (msg, steps) => {
  const delay = steps[msg.name].delay;
  assert(delay !== undefined);
  if (delay !== 0) {
    prepareMessage(msg, { delaySeconds: steps[msg.name].delay });
  }
};

module.exports = ({
  sendMessageBatch,
  queues,
  steps,
  globalPool
}) => {
  const tasks = [];
  const addRaw = (msgs, queueUrl) => {
    tasks.push([[...msgs], queueUrl]);
  };
  return {
    addDlqMessages: (msgs, queueUrl) => {
      msgs.forEach((msg) => {
        prepareGroupId(msg, steps);
        prepareDeduplicationId(msg, steps);
      });
      return addRaw(msgs, queueUrl);
    },
    addStepMessages: (messages) => {
      messages.forEach((msg) => {
        const queueUrl = queues[steps[msg.name].queue];
        assert(queueUrl !== undefined);
        prepareGroupId(msg, steps);
        prepareDeduplicationId(msg, steps);
        prepareDelay(msg, steps);
        addRaw([msg], queueUrl);
      });
    },
    flush: async (complete) => {
      assert(typeof complete === 'boolean');
      if (tasks.length === 0) {
        return;
      }
      const groups = {};
      for (let tIdx = 0; tIdx < tasks.length; tIdx += 1) {
        const [msgs, queueUrl] = tasks[tIdx];
        for (let mIdx = msgs.length - 1; mIdx >= 0; mIdx -= 1) {
          const msg = msgs[mIdx];
          if (complete === true || getUrgent(msg) === true) {
            if (!(queueUrl in groups)) {
              groups[queueUrl] = [];
            }
            groups[queueUrl].push(msg);
            msgs.splice(mIdx, 1);
          }
        }
        if (msgs.length === 0) {
          tasks.splice(tIdx, 1);
          tIdx -= 1;
        }
      }
      const fns = Object.entries(groups)
        .map(([queueUrl, messages]) => async () => sendMessageBatch({ queueUrl, messages }));
      await globalPool(fns);
    }
  };
};
