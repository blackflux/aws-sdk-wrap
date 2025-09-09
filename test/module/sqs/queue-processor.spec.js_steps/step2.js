import Joi from 'joi-strict';

export const name = 'step2';

export const queue = 'one';

export const ingest = false;

export const schema = Joi.object().keys({
  name: Joi.string().valid('step2')
});

export const handler = async (payload, event, context) => [];

export const next = [];
