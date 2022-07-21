import Joi from 'joi-strict';

export const name = 'disallowed-output';

export const queue = 'one';

export const ingest = false;

export const schema = Joi.object().keys({
  name: Joi.string().valid('disallowed-output')
});

export const handler = async (payload, event, context) => [{ name: 'step2' }];

export const next = [];
