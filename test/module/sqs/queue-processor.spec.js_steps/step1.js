import Joi from 'joi-strict';
import { prepareMessage } from '../../../../src/module/sqs/prepare-message.js';

export const name = 'step1';

export const queue = 'one';

export const schema = Joi.object().keys({
  name: Joi.string().valid('step1'),
  meta: Joi.string()
});

export const handler = async (payload, event, context) => {
  const msg = { name: 'step2' };
  prepareMessage(msg, { delaySeconds: 10 });
  return [msg];
};

export const next = ['step2'];
