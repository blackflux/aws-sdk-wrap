import axios from 'axios';
import Joi from 'joi-strict';
import { prepareMessage } from '../../../../src/module/sqs/prepare-message.js';

export const name = 'step-urgent-message';

export const queue = 'one';

export const schema = Joi.object().keys({
  name: Joi.string().valid('step-urgent-message')
});

export const before = async (context, payloads) => {
  const msg = { name: 'step1', meta: 'before' };
  prepareMessage(msg, { urgent: true });
  return [msg];
};
export const handler = async (payload, event, context) => {
  await axios.get('https://api.github.com/users/mapbox');
  return [{ name: 'step1', meta: 'handler' }];
};
export const after = async (context) => [];

export const next = ['step1'];

export const delay = 0;
