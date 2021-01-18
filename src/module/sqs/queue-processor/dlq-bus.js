module.exports = ({
  queues, dlqCache, getDeadLetterQueueUrl, messageBus, globalPool
}) => {
  const pending = [];
  return {
    prepare: (msgs, step) => {
      pending.push([step, msgs]);
    },
    propagate: async () => {
      if (pending.length === 0) {
        return;
      }
      const fns = pending.splice(0).map(([step, msgs]) => async () => {
        const queueUrl = queues[step.queue];
        const dlqUrl = await dlqCache.memoize(
          queueUrl,
          () => getDeadLetterQueueUrl(queueUrl)
        );
        messageBus.addRaw(msgs, dlqUrl);
      });
      await globalPool(fns);
    }
  };
};
