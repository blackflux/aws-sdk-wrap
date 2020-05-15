const Joi = require('joi-strict');
const { prepareMessage } = require('../../../../src/module/sqs/queue-processor/prepare-message');

module.exports.queue = 'one';

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('step1'),
  meta: Joi.string()
});

module.exports.handler = async (payload, event, context) => {
  const msg = { name: 'step2' };
  prepareMessage(msg, { delaySeconds: 10 });
  return [msg];
};

module.exports.next = ['step2'];
