const Joi = require('joi-strict');

module.exports.queue = 'two';

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('parallel-step'),
  meta: Joi.string()
});

module.exports.before = async (context, payloads) => {
  context.store = [];
  return [];
};

module.exports.handler = async (payload, event, context) => {
  context.store.push(payload);
  return [];
};

module.exports.after = async (context) => context.store;

module.exports.next = ['parallel-step'];

module.exports.delay = 15;
