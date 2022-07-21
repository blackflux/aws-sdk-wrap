import Joi from 'joi-strict';

export const name = 'step3';

export const queue = 'two';

export const ingest = true;

export const schema = Joi.object().keys({
  name: Joi.string().valid('step3'),
  meta: Joi.string()
});

export const handler = async (payload, event, context) => [
  { name: 'step1', meta: 'meta1' },
  { name: 'step3', meta: 'meta3' }
];

export const next = ['step1', 'step3'];

export const delay = 15;
