import Joi from 'joi-strict';

export class RetryError extends Error {
  constructor(kwargs = {}) {
    super();
    this.name = this.constructor.name;

    Joi.assert(kwargs, Joi.object().keys({
      maxFailureCount: Joi.number().integer().min(1).optional(),
      maxAgeInSec: Joi.number().integer().min(1).optional(),
      backoffInSec: Joi.alternatives(
        Joi.number().integer().min(0).max(900),
        Joi.function()
      ).optional(),
      onFailure: Joi.function().optional()
    }));

    const {
      maxFailureCount = 10,
      maxAgeInSec = Number.MAX_SAFE_INTEGER,
      backoffInSec = 0,
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
    this.backoffInSec = backoffInSec;
    this.onFailure = onFailure;
  }
}
