import util from 'util';
import crypto from 'crypto';
import chunk from 'lodash.chunk';
import get from 'lodash.get';
import objectScan from 'object-scan';
import Joi from 'joi-strict';
import objectHash from 'object-hash-strict';
import { getGroupId, getDeduplicationId, getDelaySeconds } from './prepare-message.js';
import { SendMessageBatchError, MessageCollisionError } from '../../resources/errors.js';

const msgRaw = Symbol('msg-raw');

const sleep = util.promisify(setTimeout);

const sendBatch = async (sqsBatch, queueUrl, {
  call,
  getService,
  maxRetries,
  backoffFunction,
  logger
}) => {
  const pending = [...sqsBatch];
  const response = [];
  for (let count = 0; count < maxRetries && pending.length !== 0; count += 1) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(backoffFunction(count));
    // eslint-disable-next-line no-await-in-loop
    const result = await call('SQS:SendMessageBatchCommand', {
      Entries: pending,
      QueueUrl: queueUrl
    });
    response.push(result);
    (result.Successful || []).forEach((e) => {
      pending.splice(pending.findIndex(({ Id }) => Id === e.Id), 1);
    });
    if (pending.length !== 0 && logger !== null) {
      logger.warn(`Failed to submit (some) message(s)\nRetrying: [${
        pending
          .map(({ Id, MessageBody }) => `( Id = ${Id} , MD5 = ${
            crypto.createHash('md5').update(MessageBody).digest('hex')
          } )`)
          .join(', ')
      }]`);
    }
  }
  return response;
};

const transformMessages = ({ messages, batchDelaySeconds }) => {
  const result = {};
  for (let idx = 0; idx < messages.length; idx += 1) {
    const msg = messages[idx];
    const msgGroupId = getGroupId(msg);
    const msgDeduplicationId = getDeduplicationId(msg);
    const msgDelaySeconds = getDelaySeconds(msg);
    const delaySeconds = msgDelaySeconds === undefined ? batchDelaySeconds : msgDelaySeconds;
    const id = objectHash(
      delaySeconds === null ? msg : { msg, delaySeconds },
      { allowUndefined: true }
    );
    if (result[id] !== undefined) {
      throw new MessageCollisionError(JSON.stringify(result[id]));
    }
    result[id] = {
      Id: id,
      MessageBody: JSON.stringify(msg),
      [msgRaw]: msg,
      ...(msgGroupId === undefined ? {} : {
        MessageGroupId: msgGroupId,
        MessageDeduplicationId: objectHash({
          timestamp: new Date().toISOString(),
          id
        })
      }),
      ...(msgDeduplicationId === undefined ? {} : {
        MessageDeduplicationId: msgDeduplicationId
      }),
      ...(delaySeconds === null ? {} : { DelaySeconds: delaySeconds })
    };
  }
  return Object.values(result);
};

export default ({ call, getService, logger }) => async (opts) => {
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
  const batchDelaySeconds = get(opts, 'delaySeconds', null);

  const messageChunks = chunk(transformMessages({ messages, batchDelaySeconds }), batchSize);
  const result = await Promise.all(messageChunks
    .map((sqsBatch) => sendBatch(sqsBatch, queueUrl, {
      call,
      getService,
      maxRetries,
      backoffFunction,
      logger
    })));
  if (messages.length !== result.reduce((p, c) => p + c
    .reduce((prev, cur) => prev + (cur.Successful || []).length, 0), 0)) {
    const failedIds = objectScan(['[*][*].Failed[*].Id'], ({ rtn: 'value' }))(result);
    const failedMessages = objectScan(['[*][*].Id'], ({
      filterFn: ({ value }) => failedIds.includes(value),
      rtn: 'parent'
    }))(messageChunks);
    throw new SendMessageBatchError(JSON.stringify(result), {
      failedMessages: failedMessages.map((msg) => msg[msgRaw])
    });
  }
  return result;
};
