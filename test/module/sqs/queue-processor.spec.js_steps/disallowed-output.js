const Joi = require('joi-strict');

module.exports.name = 'disallowed-output';

module.exports.queue = 'one';

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('disallowed-output')
});

module.exports.handler = async (payload, event, context) => [{ name: 'step2' }];

module.exports.next = [];
