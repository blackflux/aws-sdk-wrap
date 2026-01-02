import Joi from 'joi-strict';
import objectHash from 'object-hash-strict';

export const name = 'group-id-step2';

export const queue = 'two';

export const ingest = true;

export const groupIdFunction = (msg) => objectHash(msg);

export const schema = Joi.object().keys({
  name: Joi.string().valid('group-id-step2'),
  meta: Joi.string()
});

export const handler = async (payload, event, context) => [];

export const next = [];
