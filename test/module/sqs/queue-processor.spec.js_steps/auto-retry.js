const Joi = require('joi-strict');
const { RetryError } = require('../../../../src/module/sqs/errors');

module.exports.queue = 'one';

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('auto-retry'),
  retrySettings: Joi.object().optional()
});

module.exports.handler = async (payload, event, context) => {
  throw new RetryError(payload.retrySettings);
};

module.exports.next = ['auto-retry'];

module.exports.delay = 0;
