const Joi = require('joi-strict');
const { prepareMessage } = require('../../../../src/module/sqs/prepare-message');

module.exports.queueUrl = process.env.QUEUE_URL_ONE;

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('step1'),
  meta: Joi.string()
});

module.exports.handler = async (payload, event) => {
  const msg = { name: 'step2' };
  prepareMessage(msg, { delaySeconds: 10 });
  return [msg];
};

module.exports.next = ['step2'];
