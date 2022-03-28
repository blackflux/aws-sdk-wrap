import assert from 'assert';
import Joi from 'joi-strict';

const URGENT = Symbol('urgent');
const GROUP_ID = Symbol('group-id');
const DEDUPLICATION_ID = Symbol('deduplication-id');
const DELAY_SECONDS = Symbol('delay-seconds');

export const getUrgent = (msg) => msg[URGENT];
export const getGroupId = (msg) => msg[GROUP_ID];
export const getDeduplicationId = (msg) => msg[DEDUPLICATION_ID];
export const getDelaySeconds = (msg) => msg[DELAY_SECONDS];

export const clone = (msg) => {
  const m = { ...msg };
  Object.getOwnPropertySymbols(msg).forEach((p) => {
    m[p] = msg[p];
  });
  return m;
};

export const prepareMessage = (msg, opts) => {
  Joi.assert(opts, Joi.object().keys({
    urgent: Joi.boolean().optional(),
    groupId: Joi.string().optional(),
    deduplicationId: Joi.string().optional(),
    // eslint-disable-next-line newline-per-chained-call
    delaySeconds: Joi.number().integer().min(0).max(15 * 60).optional()
  }));
  if (opts.urgent !== undefined) {
    Object.defineProperty(msg, URGENT, {
      value: opts.urgent,
      writable: false
    });
  }
  if (opts.groupId !== undefined) {
    assert(
      typeof opts.groupId === 'string' && opts.groupId.length <= 128 && opts.groupId.length !== 0,
      `Invalid Message Group Id ( MessageGroupId = ${opts.groupId} )`
    );
    Object.defineProperty(msg, GROUP_ID, {
      value: opts.groupId,
      writable: false
    });
  }
  if (opts.deduplicationId !== undefined) {
    assert(
      typeof opts.deduplicationId === 'string'
      && opts.deduplicationId.length <= 128
      && opts.deduplicationId.length !== 0,
      `Invalid Message Group Id ( MessageDeduplicationId = ${opts.deduplicationId} )`
    );
    Object.defineProperty(msg, DEDUPLICATION_ID, {
      value: opts.deduplicationId,
      writable: false
    });
  }
  if (opts.delaySeconds !== undefined) {
    Object.defineProperty(msg, DELAY_SECONDS, {
      value: opts.delaySeconds,
      writable: false
    });
  }
};
