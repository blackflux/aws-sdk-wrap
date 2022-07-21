import Joi from 'joi-strict';

export const name = 'bad-output';

export const queue = 'one';

export const ingest = false;

export const schema = Joi.object().keys({
  name: Joi.string().valid('bad-output')
});

export const handler = async (payload, event, context) => [{ name: 'unknown-step' }];

export const next = ['step2'];
