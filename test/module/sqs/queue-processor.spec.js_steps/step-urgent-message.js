const axios = require('axios');
const Joi = require('joi-strict');
const { prepareMessage } = require('../../../../src/module/sqs/prepare-message');

module.exports.name = 'step-urgent-message';

module.exports.queue = 'one';

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('step-urgent-message')
});

module.exports.before = async (context, payloads) => {
  const msg = { name: 'step1', meta: 'before' };
  prepareMessage(msg, { urgent: true });
  return [msg];
};
module.exports.handler = async (payload, event, context) => {
  await axios.get('https://api.github.com/users/mapbox');
  return [{ name: 'step1', meta: 'handler' }];
};
module.exports.after = async (context) => [];

module.exports.next = ['step1'];

module.exports.delay = 0;
