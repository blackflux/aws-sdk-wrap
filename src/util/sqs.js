const util = require('util');
const chunk = require('lodash.chunk');
const objectHash = require('object-hash');
const { SendMessageBatchError } = require('../resources/errors');

const sleep = util.promisify(setTimeout);

const sendBatch = async (sqsBatch, queueUrl, call, { maxRetries, backoffFunction, delaySeconds }) => {
  const pending = sqsBatch.reduce((p, msg) => {
    const id = objectHash(msg);
    return Object.assign(p, {
      [id]: {
        Id: id,
        MessageBody: JSON.stringify(msg),
        ...(delaySeconds === null ? {} : { DelaySeconds: delaySeconds })
      }
    });
  }, {});
  const response = [];
  for (let count = 0; count < maxRetries && Object.keys(pending).length !== 0; count += 1) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(backoffFunction(count));
    // eslint-disable-next-line no-await-in-loop
    const result = await call('sqs:sendMessageBatch', {
      Entries: Object.values(pending),
      QueueUrl: queueUrl
    });
    response.push(result);
    result.Successful.forEach((e) => delete pending[e.Id]);
  }
  return response;
};

module.exports = (call) => ({
  sendMessageBatch: async (msgs, queueUrl, {
    batchSize = 10,
    maxRetries = 10,
    backoffFunction = (count) => 30 * (count ** 2),
    delaySeconds = null
  } = {}) => {
    const result = await Promise.all(chunk(msgs, batchSize)
      .map((sqsBatch) => sendBatch(sqsBatch, queueUrl, call, {
        maxRetries,
        backoffFunction,
        delaySeconds
      })));
    if (msgs.length !== result.reduce((p, c) => p + c.reduce((prev, cur) => prev + cur.Successful.length, 0), 0)) {
      throw new SendMessageBatchError(result);
    }
    return result;
  }
});
