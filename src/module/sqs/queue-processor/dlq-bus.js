module.exports = ({
  queues, getDeadLetterQueueUrl, messageBus, globalPool
}) => {
  const pending = [];
  const url2dlqUrl = {};
  return {
    prepare: (msgs, step) => {
      pending.push([queues[step.queue], msgs]);
    },
    propagate: async () => {
      if (pending.length === 0) {
        return;
      }
      const inProgress = pending.splice(0);
      const queueUrls = [...new Set(inProgress.map(([url]) => url))];
      const fns = queueUrls
        .filter((url) => !(url in url2dlqUrl))
        .map((url) => async () => {
          url2dlqUrl[url] = await getDeadLetterQueueUrl(url);
        });
      await globalPool(fns);
      inProgress.forEach(([url, msgs]) => {
        messageBus.addRaw(msgs, url2dlqUrl[url]);
      });
    }
  };
};
