const updateTrace = require('./update-trace');

module.exports = ({
  queues, getDeadLetterQueueUrl, messageBus, globalPool
}) => {
  const pending = [];
  const dlqCache = {};
  return {
    prepare: (msgs_, step, trace) => {
      const msgs = updateTrace(msgs_, step, trace);
      pending.push([queues[step.queue], msgs]);
    },
    propagate: async () => {
      if (pending.length === 0) {
        return;
      }
      const inProgress = pending.splice(0);
      const queueUrls = [...new Set(inProgress.map(([url]) => url))];
      const fns = queueUrls
        .filter((url) => !(url in dlqCache))
        .map((url) => async () => {
          dlqCache[url] = await getDeadLetterQueueUrl(url);
        });
      await globalPool(fns);
      inProgress.forEach(([url, msgs]) => {
        messageBus.addRaw(msgs, dlqCache[url]);
      });
    }
  };
};
