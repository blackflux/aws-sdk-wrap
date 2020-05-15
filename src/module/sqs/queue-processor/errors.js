const assert = require('assert');

class RetryError extends Error {
  constructor({
    maxFailureCount = 10,
    maxAgeInSec = Number.MAX_SAFE_INTEGER,
    // todo: add support for function (!)
    delayInSec = 0,
    onTemporaryFailure = () => {},
    onPermanentFailure = ({
      logger,
      limits,
      meta,
      payload
    }) => {
      logger.warn(`Permanent Retry Failure\n${JSON.stringify({ limits, meta, payload })}`);
    }
  } = {}) {
    super();
    this.name = this.constructor.name;

    assert(Number.isInteger(maxFailureCount) && maxFailureCount >= 0);
    assert(Number.isInteger(maxAgeInSec) && maxAgeInSec >= 0);
    assert(Number.isInteger(delayInSec) && delayInSec >= 0 && delayInSec <= 15 * 60);
    assert(typeof onTemporaryFailure === 'function');
    assert(typeof onPermanentFailure === 'function');
    this.maxFailureCount = maxFailureCount;
    this.maxAgeInSec = maxAgeInSec;
    this.delayInSec = delayInSec;
    this.onTemporaryFailure = onTemporaryFailure;
    this.onPermanentFailure = onPermanentFailure;
  }
}
module.exports.RetryError = RetryError;
