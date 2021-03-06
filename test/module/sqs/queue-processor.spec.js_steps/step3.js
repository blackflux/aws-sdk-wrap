const Joi = require('joi-strict');

module.exports.queue = 'two';

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('step3'),
  meta: Joi.string()
});

module.exports.handler = async (payload, event, context) => [
  { name: 'step1', meta: 'meta1' },
  { name: 'step3', meta: 'meta3' }
];

module.exports.next = ['step1', 'step3'];

module.exports.delay = 15;
