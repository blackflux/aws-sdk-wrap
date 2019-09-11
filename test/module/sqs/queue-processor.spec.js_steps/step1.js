const Joi = require('joi-strict');

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('step1')
});

module.exports.handler = async (payload, event) => [{ name: 'step2' }];

module.exports.next = ['step2'];
