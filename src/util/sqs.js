const assert = require('assert');
const util = require('util');
const chunk = require('lodash.chunk');
const objectHash = require('object-hash');
const { abbrev } = require('lambda-monitor-logger');

const sleep = util.promisify(setTimeout);

const sendBatch = async (sqsBatch, queueUrl, call) => {
  const pending = sqsBatch.reduce((p, msg) => {
    const id = objectHash(msg);
    return Object.assign(p, {
      [id]: {
        Id: id,
        MessageBody: JSON.stringify(msg)
      }
    });
  }, {});
  const response = [];
  for (let count = 0; count < 10 && Object.keys(pending).length !== 0; count += 1) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(30 * (count ** 2));
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
  sendMessageBatch: async (msgs, queueUrl, batchSize = 10) => {
    const result = await Promise.all(chunk(msgs, batchSize)
      .map((sqsBatch) => sendBatch(sqsBatch, queueUrl, call)));
    assert(
      msgs.length === result
        .reduce((p, c) => p + c.reduce((prev, cur) => prev + cur.Successful.length, 0), 0),
      `SendMessageBatch Error: ${abbrev(result)}\n`
      + `Messages length: ${msgs.length}`
    );
    return result;
  }
});
