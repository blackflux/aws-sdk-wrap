const assert = require('assert');
const get = require('lodash.get');
const { prepareMessage } = require('../prepare-message');
const errors = require('../errors');
const { metaKey } = require('./payload');

module.exports = async ({
  error, payload, payloadStripped, e, step, stepBus, dlqBus, logger
}) => {
  let err = error;
  if (!(err instanceof errors.RetryError)) {
    if (step.retry === null) {
      throw err;
    } else {
      err = step.retry;
    }
  }
  const maxFailureCount = err.maxFailureCount;
  const maxAgeInSec = err.maxAgeInSec;
  const backoffInSec = err.backoffInSec;
  const failureCount = get(payload, [metaKey, 'failureCount'], 0) + 1;
  const timestamp = get(
    payload,
    [metaKey, 'timestamp'],
    new Date(
      Number.parseInt(get(e, ['attributes', 'SentTimestamp'], Date.now()), 10)
    ).toISOString()
  );
  const kwargs = {
    logger,
    limits: {
      maxFailureCount,
      maxAgeInSec
    },
    meta: {
      failureCount,
      timestamp
    },
    payload: payloadStripped,
    error
  };
  const delaySeconds = typeof backoffInSec === 'function'
    ? backoffInSec(kwargs.meta)
    : backoffInSec;
  if (
    failureCount >= maxFailureCount
    || (Date.now() - Date.parse(timestamp)) / 1000 > maxAgeInSec
  ) {
    const msgs = await err.onFailure({ ...kwargs, temporary: false });
    assert(Array.isArray(msgs), 'onFailure must return array of messages');
    stepBus.push(msgs, step);
    dlqBus.prepare([payload], step);
  } else {
    const msgs = await err.onFailure({ ...kwargs, temporary: true });
    assert(Array.isArray(msgs), 'onFailure must return array of messages');
    const msg = {
      ...payload,
      [metaKey]: {
        failureCount,
        timestamp
      }
    };
    if (delaySeconds !== 0) {
      prepareMessage(msg, { delaySeconds });
    }
    stepBus.push(msgs.concat(msg), step);
  }
};
