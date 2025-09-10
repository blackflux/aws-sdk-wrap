import Joi from 'joi-strict';

export class RetryError extends Error {
  constructor(kwargs = {}) {
    super();
    this.name = this.constructor.name;

    Joi.assert(kwargs, Joi.object().keys({
      maxCycleLength: Joi.number().integer().min(1).optional(),
      maxFailureCount: Joi.number().integer().min(1).optional(),
      maxAgeInSec: Joi.number().integer().min(1).optional(),
      backoffInSec: Joi.alternatives(
        Joi.number().integer().min(0).max(900),
        Joi.function()
      ).optional(),
      onFailure: Joi.function().optional(),
      target: Joi.function().optional()
    }));

    const {
      maxCycleLength = 100, // step count in longest, detected cycle
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
      },
      target = ({ temporary }) => (temporary === false ? 'dlq' : 'queue')
    } = kwargs;

    this.maxCycleLength = maxCycleLength;
    this.maxFailureCount = maxFailureCount;
    this.maxAgeInSec = maxAgeInSec;
    this.backoffInSec = backoffInSec;
    this.onFailure = onFailure;
    this.target = target;
  }
}
