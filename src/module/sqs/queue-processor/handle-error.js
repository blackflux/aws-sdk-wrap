import assert from 'assert';
import get from 'lodash.get';
import { prepareMessage } from '../prepare-message.js';
import { RetryError } from '../errors.js';
import { metaKey } from './payload.js';

export default async ({
  error, payload, payloadStripped, e, step, stepBus, dlqBus, logger
}) => {
  let err = error;
  if (!(err instanceof RetryError)) {
    if (step.retry === null) {
      return false;
    }
    err = step.retry;
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
  const temporary = failureCount < maxFailureCount
    && (Date.now() - Date.parse(timestamp)) / 1000 <= maxAgeInSec;
  const params = { ...kwargs, temporary };
  const [msgs, target] = await Promise.all([err.onFailure(params), err.target(params)]);
  assert(['queue', 'dlq', null].includes(target), 'Invalid target returned');
  const trace = get(payload, [metaKey, 'trace'], []);
  assert(Array.isArray(msgs), 'onFailure must return array of messages');
  if (target === 'queue') {
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
    stepBus.push(msgs.concat(msg), step, trace);
  } else if (target === 'dlq') {
    stepBus.push(msgs, step, trace);
    dlqBus.prepare([payload], step, trace);
  }
  return true;
};
