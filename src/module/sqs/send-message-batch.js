const util = require('util');
const chunk = require('lodash.chunk');
const get = require('lodash.get');
const Joi = require('joi-strict');
const objectHash = require('object-hash');
const { getDelaySeconds } = require('./queue-processor/prepare-message');
const { SendMessageBatchError, MessageCollisionError } = require('../../resources/errors');

const sleep = util.promisify(setTimeout);

const sendBatch = async (sqsBatch, queueUrl, {
  call,
  getService,
  maxRetries,
  backoffFunction,
  delaySeconds: batchDelaySeconds,
  logger
}) => {
  const pending = sqsBatch.reduce((p, msg) => {
    const id = objectHash(msg);
    const msgDelaySeconds = getDelaySeconds(msg);
    const delaySeconds = msgDelaySeconds === undefined ? batchDelaySeconds : msgDelaySeconds;
    if (p[id] !== undefined) {
      throw new MessageCollisionError(JSON.stringify(p[id]));
    }
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
    if (Object.keys(pending).length !== 0 && logger !== null) {
      logger.warn(`Failed to submit (some) message(s)\nRetrying: [${
        Object
          .values(pending)
          .map(({ Id, MessageBody }) => `( Id = ${Id} , MD5 = ${getService('util.crypto').md5(MessageBody, 'hex')} )`)
          .join(', ')
      }]`);
    }
  }
  return response;
};

module.exports = ({ call, getService, logger }) => async (opts) => {
  Joi.assert(opts, Joi.object().keys({
    messages: Joi.array(),
    queueUrl: Joi.string(),
    batchSize: Joi.number()
      .integer()
      .min(1)
      .max(10) // AWS sqs:sendMessageBatch restriction
      .optional(),
    maxRetries: Joi.number().integer().optional(),
    backoffFunction: Joi.function().optional(),
    delaySeconds: Joi.number().integer().optional()
  }));
  const messages = get(opts, 'messages');
  const queueUrl = get(opts, 'queueUrl');
  const batchSize = get(opts, 'batchSize', 10);
  const maxRetries = get(opts, 'maxRetries', 10);
  const backoffFunction = get(opts, 'backoffFunction', (count) => 30 * (count ** 2));
  const delaySeconds = get(opts, 'delaySeconds', null);

  const result = await Promise.all(chunk(messages, batchSize)
    .map((sqsBatch) => sendBatch(sqsBatch, queueUrl, {
      call,
      getService,
      maxRetries,
      backoffFunction,
      delaySeconds,
      logger
    })));
  if (messages.length !== result.reduce((p, c) => p + c.reduce((prev, cur) => prev + cur.Successful.length, 0), 0)) {
    throw new SendMessageBatchError(JSON.stringify(result));
  }
  return result;
};
