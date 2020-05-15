const Joi = require('joi-strict');
const { RetryError } = require('../../../../src/module/sqs/queue-processor/errors');

module.exports.queue = 'one';

module.exports.retry = new RetryError();

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('step-auto-retry')
});

module.exports.handler = async (payload, event, context) => {
  throw new Error();
};

module.exports.next = ['step-auto-retry'];

module.exports.delay = 0;
