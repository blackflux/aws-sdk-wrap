const Joi = require('joi-strict');

const GROUP_ID = Symbol('group-id');
const DELAY_SECONDS = Symbol('delay-seconds');

module.exports.getGroupId = (msg) => msg[GROUP_ID];
module.exports.getDelaySeconds = (msg) => msg[DELAY_SECONDS];

module.exports.prepareMessage = (msg, opts) => {
  Joi.assert(opts, Joi.object().keys({
    // eslint-disable-next-line newline-per-chained-call
    groupId: Joi.string().optional(),
    // eslint-disable-next-line newline-per-chained-call
    delaySeconds: Joi.number().integer().min(0).max(15 * 60).optional()
  }));
  if (opts.groupId !== undefined) {
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
