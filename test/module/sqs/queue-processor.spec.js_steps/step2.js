const Joi = require('joi-strict');

module.exports.queue = 'two';

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('step2')
});

module.exports.handler = async (payload, event, context) => [];

module.exports.next = [];
