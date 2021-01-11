const Joi = require('joi-strict');

module.exports.queue = 'one';

module.exports.timeout = 1;

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('delay-step'),
  delay: Joi.number().integer().min(0)
});

module.exports.before = async (context, payloads, events) => [];
module.exports.handler = async (payload, event, context) => new Promise(
  (resolve) => setTimeout(() => resolve([]), payload.delay)
);
module.exports.after = async (context) => [];

module.exports.next = [];
