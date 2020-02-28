const Joi = require('joi-strict');

const DELAY_SECONDS = Symbol('delay-seconds');

module.exports.getDelaySeconds = (msg) => msg[DELAY_SECONDS];

module.exports.prepareMessage = (msg, opts) => {
  Joi.assert(opts, Joi.object().keys({
    // eslint-disable-next-line newline-per-chained-call
    delaySeconds: Joi.number().integer().min(0).max(15 * 60).optional()
  }));
  if (opts.delaySeconds !== undefined) {
    Object.defineProperty(msg, DELAY_SECONDS, {
      value: opts.delaySeconds,
      writable: false
    });
  }
};
