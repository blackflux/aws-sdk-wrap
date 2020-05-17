const Joi = require('joi-strict');

class RetryError extends Error {
  constructor(kwargs = {}) {
    super();
    this.name = this.constructor.name;

    Joi.assert(kwargs, Joi.object().keys({
      maxFailureCount: Joi.number().integer().min(1).optional(),
      maxAgeInSec: Joi.number().integer().min(1).optional(),
      delayInSec: Joi.alternatives(
        Joi.number().integer().min(0).max(900),
        Joi.function()
      ).optional(),
      onFailure: Joi.function().optional()
    }));

    const {
      maxFailureCount = 10,
      maxAgeInSec = Number.MAX_SAFE_INTEGER,
      delayInSec = 0,
      onFailure = ({
        temporary,
        logger,
        limits,
        meta,
        payload
      }) => {
        if (temporary === false) {
          logger.warn(`Permanent Retry Failure\n${JSON.stringify({ limits, meta, payload })}`);
        }
        return [];
      }
    } = kwargs;

    this.maxFailureCount = maxFailureCount;
    this.maxAgeInSec = maxAgeInSec;
    this.delayInSec = delayInSec;
    this.onFailure = onFailure;
  }
}
module.exports.RetryError = RetryError;
