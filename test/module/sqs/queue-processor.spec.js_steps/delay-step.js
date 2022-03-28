import Joi from 'joi-strict';

export const name = 'delay-step';

export const queue = 'one';

export const timeout = 1;

export const schema = Joi.object().keys({
  name: Joi.string().valid('delay-step'),
  delay: Joi.number().integer().min(0)
});

export const before = async (context, payloads) => [];
export const handler = async (payload, event, context) => new Promise(
  (resolve) => {
    setTimeout(() => resolve([]), payload.delay);
  }
);
export const after = async (context) => [];

export const next = [];
