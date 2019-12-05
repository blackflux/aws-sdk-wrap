const Joi = require('joi-strict');

module.exports.queueUrl = process.env.QUEUE_URL_DUMMY;

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('step2')
});

module.exports.handler = async (payload, event) => [];

module.exports.next = [];
