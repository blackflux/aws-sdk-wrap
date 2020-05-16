const assert = require('assert');

class RetryError extends Error {
  constructor({
    maxFailureCount = 10,
    maxAgeInSec = Number.MAX_SAFE_INTEGER,
    delayInSec = 0,
    onTemporaryFailure = () => [],
    onPermanentFailure = ({
      logger,
      limits,
      meta,
      payload
    }) => {
      logger.warn(`Permanent Retry Failure\n${JSON.stringify({ limits, meta, payload })}`);
      return [];
    }
  } = {}) {
    super();
    this.name = this.constructor.name;

    assert(Number.isInteger(maxFailureCount) && maxFailureCount >= 0, 'maxFailureCount');
    assert(Number.isInteger(maxAgeInSec) && maxAgeInSec >= 0, 'maxAgeInSec');
    assert(
      typeof delayInSec === 'function'
      || (Number.isInteger(delayInSec) && delayInSec >= 0 && delayInSec <= 15 * 60),
      'delayInSec'
    );
    assert(typeof onTemporaryFailure === 'function', 'onTemporaryFailure');
    assert(typeof onPermanentFailure === 'function', 'onPermanentFailure');
    this.maxFailureCount = maxFailureCount;
    this.maxAgeInSec = maxAgeInSec;
    this.delayInSec = delayInSec;
    this.onTemporaryFailure = onTemporaryFailure;
    this.onPermanentFailure = onPermanentFailure;
  }
}
module.exports.RetryError = RetryError;
