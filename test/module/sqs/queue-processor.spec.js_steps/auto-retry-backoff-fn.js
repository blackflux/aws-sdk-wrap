const Joi = require('joi-strict');
const { RetryError } = require('../../../../src/module/sqs/errors');

module.exports.queue = 'one';

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('auto-retry-backoff-fn')
});

module.exports.handler = async (payload, event, context) => {
  throw new RetryError({
    backoffInSec: ({ failureCount }) => Math.min(failureCount * 10, 15 * 60)
  });
};

module.exports.next = ['auto-retry-backoff-fn'];

module.exports.delay = 0;
