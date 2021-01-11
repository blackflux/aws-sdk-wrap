const Joi = require('joi-strict');

module.exports.queue = 'two';

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('parallel-step'),
  meta: Joi.string()
});

module.exports.before = async (context, payloads, events) => {
  // eslint-disable-next-line no-console
  console.log(payloads);
  // eslint-disable-next-line no-console
  console.log(events);
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
