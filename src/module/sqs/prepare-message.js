const assert = require('assert');
const Joi = require('joi-strict');

const URGENT = Symbol('urgent');
const GROUP_ID = Symbol('group-id');
const DELAY_SECONDS = Symbol('delay-seconds');

module.exports.getUrgent = (msg) => msg[URGENT];
module.exports.getGroupId = (msg) => msg[GROUP_ID];
module.exports.getDelaySeconds = (msg) => msg[DELAY_SECONDS];

module.exports.clone = (msg) => {
  const m = { ...msg };
  Object.getOwnPropertySymbols(msg).forEach((p) => {
    m[p] = msg[p];
  });
  return m;
};

module.exports.prepareMessage = (msg, opts) => {
  Joi.assert(opts, Joi.object().keys({
    urgent: Joi.boolean().optional(),
    groupId: Joi.string().optional(),
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
  if (opts.delaySeconds !== undefined) {
    Object.defineProperty(msg, DELAY_SECONDS, {
      value: opts.delaySeconds,
      writable: false
    });
  }
};
