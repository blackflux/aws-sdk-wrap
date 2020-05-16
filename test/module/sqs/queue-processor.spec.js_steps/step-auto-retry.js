const Joi = require('joi-strict');

module.exports.queue = 'one';

module.exports.retry = {
  maxFailureCount: 10
};

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('step-auto-retry')
});

module.exports.handler = async (payload, event, context) => {
  throw new Error();
};

module.exports.next = ['step-auto-retry'];

module.exports.delay = 0;
