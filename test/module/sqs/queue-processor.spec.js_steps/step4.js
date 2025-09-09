import Joi from 'joi-strict';

export const name = 'step4';

export const queue = 'two';

export const ingest = true;

export const schema = Joi.object().keys({
  name: Joi.string().valid('step4'),
  meta: Joi.string()
});

export const handler = async (payload, event, context) => [
  { name: 'step1', meta: 'meta1' },
  { name: 'step4', meta: 'meta4' }
];

export const next = ['step1', 'step4'];
