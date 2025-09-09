import Joi from 'joi-strict';

export const name = 'parallel-step';

export const queue = 'one';

export const ingest = false;

export const schema = Joi.object().keys({
  name: Joi.string().valid('parallel-step'),
  meta: Joi.string()
});

export const before = async (context, payloads) => {
  // eslint-disable-next-line no-console
  console.log(payloads);
  context.store = [];
  return [];
};

export const handler = async (payload, event, context) => {
  context.store.push(payload);
  return [];
};

export const after = async (context) => context.store;

export const next = ['parallel-step'];

export const delay = 15;
