import Joi from 'joi-strict';

export const name = 'step-auto-retry';

export const queue = 'one';

export const ingest = false;

export const retry = {
  maxFailureCount: 10
};

export const schema = Joi.object().keys({
  name: Joi.string().valid('step-auto-retry')
});

export const handler = async (payload, event, context) => {
  throw new Error();
};

export const next = ['step-auto-retry'];

export const delay = 0;
